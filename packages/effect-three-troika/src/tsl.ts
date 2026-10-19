/**
 * troika labels drawn with three's node materials (TSL), for `WebGPURenderer` on either
 * of its backends. troika still lays the text out and builds the glyphs' distance fields
 * (`getTextRenderInfo`, on its own canvas); only its shader is replaced. Each label is
 * one instanced quad per glyph, as troika's `GlyphsGeometry` is, and its material ports
 * troika's `TextDerivedMaterial.js` (troika-three-text 0.52.5, MIT): the glyph's atlas
 * cell and channel, exponential decoding to a signed distance, anti-aliasing from
 * `fwidth`, the outline as a first pass with its own distance offset and blur, and
 * curving round a cylinder. A material the scene lends (`label({ material })`) is copied
 * into its node-material class, as three's `NodeLibrary.fromMaterial` does, so lit labels
 * stay lit; the copy follows the scene's in-place changes before each draw.
 *
 * Not ported: troika's clip rectangle, inner stroke, outline offsets and orientation
 * (`LabelNode` has none of them), its debug view, and shadow-casting depth materials.
 *
 * @module
 */
import type { HostedLabel, LabelLayout, LabelNode } from '@opsydyn/effect-three';
import {
  Box3,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  type Intersection,
  LinearFilter,
  type Material,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Raycaster,
  RGBAFormat,
  Sphere,
  type Texture,
  Vector2,
} from 'three';
import {
  attribute,
  clamp,
  cos,
  float,
  floor,
  faceDirection,
  fwidth,
  length,
  materialOpacity,
  max,
  mix,
  mod,
  materialNormal,
  positionGeometry,
  pow,
  select,
  sin,
  smoothstep,
  texture,
  transformNormalToView,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  MeshPhongNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  MeshToonNodeMaterial,
  type NodeMaterial,
} from 'three/webgpu';
import {
  getTextRenderInfo,
  type TextRenderInfo,
} from 'troika-three-text/dist/troika-three-text.esm.js';

import { glyphSize, layoutArgs } from './layout.ts';

// ATLAS

/** A byte copy of troika's atlas, and the atlas version it was read at. */
type AtlasCopy = { readonly texture: DataTexture; readonly version: number };

const atlasCopies = new WeakMap<Texture, AtlasCopy>();

/** Bottom row first, as WebGL's `readPixels` returns them. */
const flipRows = (top: Uint8ClampedArray, width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(top.length);
  const row = width * 4;
  for (let y = 0; y < height; y++)
    bytes.set(top.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  return bytes;
};

/**
 * The atlas canvas's bytes. troika draws glyphs into it with WebGL, four to a texel, one
 * per channel; uploaded as an image it would go through premultiplied alpha, which marks
 * the R, G and B glyphs where the A glyph is thin, so read the bytes instead (troika's own
 * Safari workaround does the same).
 */
const canvasBytes = (canvas: HTMLCanvasElement): Uint8Array => {
  const gl = canvas.getContext('webgl') ?? canvas.getContext('webgl2');
  if (gl !== null) {
    const bytes = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    return bytes;
  }
  const context = canvas.getContext('2d');
  if (context === null) return new Uint8Array(canvas.width * canvas.height * 4);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return flipRows(image.data, canvas.width, canvas.height);
};

/**
 * The current byte copy of an atlas, read again only when troika has added glyphs (it
 * marks its texture for upload then). Every label of a glyph size shares one.
 */
const atlasCopy = (atlas: Texture): DataTexture => {
  const known = atlasCopies.get(atlas);
  if (known !== undefined && known.version === atlas.version) return known.texture;
  const canvas = atlas.image as HTMLCanvasElement;
  const copy = new DataTexture(canvasBytes(canvas), canvas.width, canvas.height, RGBAFormat);
  copy.minFilter = LinearFilter;
  copy.magFilter = LinearFilter;
  copy.generateMipmaps = false;
  copy.flipY = false;
  copy.needsUpdate = true;
  known?.texture.dispose();
  atlasCopies.set(atlas, { texture: copy, version: atlas.version });
  return copy;
};

// MATERIALS

/** troika's own material, used when the scene lends none: white, two-sided. */
const defaultBase = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, transparent: true });

/** The node-material class for each material kind, as three's standard node library maps them. */
const nodeClasses: Readonly<Record<string, new () => NodeMaterial>> = {
  MeshBasicMaterial: MeshBasicNodeMaterial,
  MeshLambertMaterial: MeshLambertNodeMaterial,
  MeshPhongMaterial: MeshPhongNodeMaterial,
  MeshStandardMaterial: MeshStandardNodeMaterial,
  MeshPhysicalMaterial: MeshPhysicalNodeMaterial,
  MeshToonMaterial: MeshToonNodeMaterial,
};

/** Kept as the label sets them, whatever the lent material says. */
const ownKeys = new Set(['uuid', 'transparent', 'depthWrite', 'forceSinglePass']);

/**
 * Copies the lent material's settings onto its node-material twin, as
 * `NodeLibrary.fromMaterial` does once; run before each draw, so values the scene changes
 * in place (a colour, a roughness) follow. Its `version` comes too, so a change that needs
 * a new shader rebuilds this one.
 */
const follow = (target: NodeMaterial, base: Material): void => {
  for (const key in base) {
    if (ownKeys.has(key)) continue;
    const value: unknown = Reflect.get(base, key);
    if (Reflect.get(target, key) !== value) Reflect.set(target, key, value);
  }
};

/** A label's uniforms, shared by its fill and outline passes. */
const labelUniforms = () => ({
  textureSize: uniform(new Vector2(1, 1)),
  glyphSize: uniform(glyphSize),
  exponent: uniform(9),
  curveRadius: uniform(0),
  atlas: texture(new DataTexture(new Uint8Array(4), 1, 1, RGBAFormat)),
});

type LabelUniforms = ReturnType<typeof labelUniforms>;

/** One pass's uniforms: the fill's offset and blur are 0, the outline's its width and blur. */
const passUniforms = () => ({
  edgeOffset: uniform(0),
  blur: uniform(0),
  opacity: uniform(1),
  color: uniform(new Color()),
});

type PassUniforms = ReturnType<typeof passUniforms>;

/**
 * A pass's material: the lent material's node class with troika's vertex and fragment
 * logic as nodes. The fill takes each glyph's colour; the outline its own colour.
 */
const passMaterial = (
  base: Material,
  shared: LabelUniforms,
  pass: PassUniforms,
  outline: boolean,
): NodeMaterial => {
  const NodeClass = nodeClasses[base.type] ?? MeshBasicNodeMaterial;
  const material = new NodeClass();
  follow(material, base);
  material.transparent = true;
  material.forceSinglePass = true;
  if (outline) material.depthWrite = false;

  // Vertex: the unit quad stretched over the glyph's bounds, grown by the outline.
  const bounds = attribute<'vec4'>('aTroikaGlyphBounds', 'vec4');
  const grow = pass.edgeOffset.add(pass.blur);
  const outer = vec4(bounds.xy.sub(grow), bounds.zw.add(grow));
  const dimensions = bounds.zw.sub(bounds.xy);
  const flat = mix(outer.xy, outer.zw, positionGeometry.xy);
  const radius = shared.curveRadius;
  const angle = flat.x.div(radius);
  const curved = radius.notEqual(0);
  // Curved round the cylinder, the normal turning with it, as troika's vertex shader does.
  material.positionNode = select(
    curved,
    vec3(sin(angle).mul(radius), flat.y, radius.sub(cos(angle).mul(radius))),
    vec3(flat, 0),
  );
  const bent = transformNormalToView(varying(vec3(sin(angle), 0, cos(angle))));
  material.normalNode = select(curved, bent.mul(faceDirection).normalize(), materialNormal);

  // The glyph's atlas cell, computed per vertex as troika does (per fragment, glyphs in
  // the leftmost column show artefacts on some systems).
  const index = attribute<'float'>('aTroikaGlyphIndex', 'float');
  const columns = shared.textureSize.x.div(shared.glyphSize);
  const perCell = vec2(shared.glyphSize, shared.glyphSize).div(shared.textureSize);
  const cell = floor(index.div(4));
  const start = perCell.mul(vec2(mod(cell, columns), floor(cell.div(columns))));
  const cellBounds = varying(vec4(start, start.add(perCell)));
  // Rounded: interpolated, 5 can arrive as 4.9999 and pick the wrong channel.
  const channel = floor(varying(mod(index, 4)).add(0.5));
  const glyphUv = varying(flat.sub(bounds.xy).div(dimensions));
  const glyphDimensions = varying(dimensions);

  // Fragment: the distance to the glyph's edge, extrapolated outside its cell.
  const margin = float(0.5).div(shared.glyphSize);
  const clamped = clamp(glyphUv, margin, float(1).sub(margin));
  const sample = shared.atlas.sample(mix(cellBounds.xy, cellBounds.zw, clamped));
  const value = select(
    channel.equal(0),
    sample.r,
    select(channel.equal(1), sample.g, select(channel.equal(2), sample.b, sample.a)),
  );
  const inside = value.greaterThan(0.5);
  const folded = select(inside, float(1).sub(value), value);
  const magnitude = float(1)
    .sub(pow(folded.mul(2), float(1).div(shared.exponent)))
    .mul(max(glyphDimensions.x, glyphDimensions.y));
  const distance = select(inside, magnitude.negate(), magnitude).add(
    length(glyphUv.sub(clamped).mul(glyphDimensions)),
  );
  const antialias = max(length(fwidth(glyphUv.mul(glyphDimensions))).mul(0.5), pass.blur);
  const edge = float(1).sub(
    smoothstep(pass.edgeOffset.sub(antialias), pass.edgeOffset.add(antialias), distance),
  );

  material.colorNode = outline
    ? vec4(pass.color, 1)
    : vec4(attribute<'vec3'>('aTroikaGlyphColor', 'vec3'), 1);
  material.opacityNode = materialOpacity.mul(pass.opacity).mul(edge);
  // troika discards where the edge leaves nothing, so glyph quads never hide what is behind.
  material.alphaTestNode = float(0);
  return material;
};

// GEOMETRY

/**
 * Each glyph's colour: the label's (as a material colour, so linear), or its colour
 * range's bytes taken as they are, which is what troika's shader does with them.
 */
const glyphColours = (info: TextRenderInfo, label: LabelNode): Float32Array => {
  const count = info.glyphAtlasIndices.length;
  const colours = new Float32Array(count * 3);
  const ranged = info.glyphColors;
  if (ranged !== null) {
    for (let index = 0; index < colours.length; index++)
      colours[index] = (ranged[index] ?? 0) / 255;
    return colours;
  }
  const own = new Color(label.color);
  for (let glyph = 0; glyph < count; glyph++) colours.set([own.r, own.g, own.b], glyph * 3);
  return colours;
};

/**
 * The text's bounds, curved as troika's `GlyphsGeometry._updateBounds` curves them and
 * grown by the outline, for culling.
 */
const boundsOf = (block: ReadonlyArray<number>, radius: number, grow: number): Box3 => {
  const [minX = 0, minY = 0, maxX = 0, maxY = 0] = block;
  const box = new Box3();
  if (radius === 0) box.min.set(minX, minY, 0);
  else {
    const reach = Math.abs(radius);
    const left = minX / reach;
    const right = maxX / reach;
    const wraps = (offset: number) =>
      Math.floor((left + offset) / (Math.PI * 2)) !== Math.floor((right + offset) / (Math.PI * 2));
    const lowX = wraps(Math.PI / 2) ? -reach : Math.min(Math.sin(left), Math.sin(right)) * reach;
    const highX = wraps(-Math.PI / 2) ? reach : Math.max(Math.sin(left), Math.sin(right)) * reach;
    const depth = wraps(Math.PI)
      ? reach * 2
      : Math.max(reach - Math.cos(left) * reach, reach - Math.cos(right) * reach);
    box.min.set(lowX, minY, radius < 0 ? -depth : 0);
    box.max.set(highX, maxY, radius < 0 ? 0 : depth);
    return box.expandByScalar(grow);
  }
  box.max.set(maxX, maxY, 0);
  return box.expandByScalar(grow);
};

/** One instanced quad per glyph, with troika's attribute names and outline draw groups. */
const glyphGeometry = (info: TextRenderInfo, label: LabelNode): InstancedBufferGeometry => {
  const quad = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex(quad.getIndex());
  geometry.setAttribute('position', quad.getAttribute('position'));
  geometry.setAttribute('normal', quad.getAttribute('normal'));
  geometry.setAttribute('uv', quad.getAttribute('uv'));
  geometry.setAttribute('aTroikaGlyphBounds', new InstancedBufferAttribute(info.glyphBounds, 4));
  // As floats: given troika's integer array, WebGPU's WebGL 2 backend declares an `int`
  // input, and the draw fails.
  geometry.setAttribute(
    'aTroikaGlyphIndex',
    new InstancedBufferAttribute(Float32Array.from(info.glyphAtlasIndices), 1),
  );
  geometry.setAttribute(
    'aTroikaGlyphColor',
    new InstancedBufferAttribute(glyphColours(info, label), 3),
  );
  geometry.instanceCount = info.glyphAtlasIndices.length;
  // The outline is drawn first, then the fill, as consecutive passes over the same glyphs.
  geometry.addGroup(0, Number.POSITIVE_INFINITY, 0);
  geometry.addGroup(0, Number.POSITIVE_INFINITY, 1);
  const box = boundsOf(info.blockBounds, label.curveRadius, label.outlineWidth + label.outlineBlur);
  geometry.boundingBox = box;
  geometry.boundingSphere = box.getBoundingSphere(new Sphere());
  return geometry;
};

// PICKING

let flatTarget: Mesh | undefined;
let curvedTarget: Mesh | undefined;

/** troika's raycast stand-ins: the text block as a plane, in 32 strips when curved. */
const pickTarget = (curved: boolean): Mesh => {
  if (curved) return (curvedTarget ??= new Mesh(new PlaneGeometry(1, 1, 32, 1), defaultBase));
  return (flatTarget ??= new Mesh(new PlaneGeometry(1, 1), defaultBase));
};

/**
 * Picks against the whole text block, as troika's `Text.raycast` does: a plane over its
 * bounds, bent round the cylinder when the text is curved.
 */
const pickBlock = (
  mesh: Mesh,
  block: ReadonlyArray<number>,
  radius: number,
  raycaster: Raycaster,
  intersects: Array<Intersection>,
): void => {
  const [minX = 0, minY = 0, maxX = 0, maxY = 0] = block;
  const target = pickTarget(radius !== 0);
  const { position, uv } = target.geometry.attributes;
  if (position === undefined || uv === undefined) return;
  for (let vertex = 0; vertex < uv.count; vertex++) {
    const x = minX + uv.getX(vertex) * (maxX - minX);
    const y = minY + uv.getY(vertex) * (maxY - minY);
    if (radius === 0) position.setXYZ(vertex, x, y, 0);
    else
      position.setXYZ(
        vertex,
        Math.sin(x / radius) * radius,
        y,
        radius - Math.cos(x / radius) * radius,
      );
  }
  target.geometry.boundingSphere = mesh.geometry.boundingSphere;
  target.geometry.boundingBox = mesh.geometry.boundingBox;
  target.matrixWorld = mesh.matrixWorld;
  const hits: Array<Intersection> = [];
  target.raycast(raycaster, hits);
  for (const hit of hits) intersects.push({ ...hit, object: mesh });
};

// HOSTING

const layoutOf = (info: TextRenderInfo): LabelLayout => {
  const [a = 0, b = 0, c = 0, d = 0] = info.blockBounds;
  const [e = 0, f = 0, g = 0, h = 0] = info.visibleBounds;
  return { block: [a, b, c, d], visible: [e, f, g, h] };
};

/** One label drawn with node materials: a mesh of glyph quads, filled once laid out. */
export const hostTslLabel = (first: LabelNode, ready: () => void): HostedLabel => {
  const shared = labelUniforms();
  const fill = passUniforms();
  const outline = passUniforms();
  const mesh = new Mesh();
  mesh.visible = false;
  let label = first;
  let base: Material = defaultBase;
  let info: TextRenderInfo | undefined;
  let materials = [
    passMaterial(base, shared, outline, true),
    passMaterial(base, shared, fill, false),
  ] as const;
  let request = 0;
  let disposed = false;

  const writeUniforms = (): void => {
    shared.curveRadius.value = label.curveRadius;
    fill.opacity.value = label.fillOpacity;
    outline.edgeOffset.value = label.outlineWidth;
    outline.blur.value = Math.max(0, label.outlineBlur);
    outline.opacity.value = label.outlineOpacity;
    outline.color.value.set(label.outlineColor);
  };

  /** The outline pass only when there is one, as troika's `hasOutline`. */
  const showMaterials = (): void => {
    const hasOutline = label.outlineWidth !== 0 || label.outlineBlur !== 0;
    mesh.material = hasOutline ? [...materials] : materials[1];
  };

  const show = (next: TextRenderInfo, laidOut: LabelNode): void => {
    info = next;
    shared.glyphSize.value = next.sdfGlyphSize;
    shared.exponent.value = next.sdfExponent;
    mesh.geometry.dispose();
    mesh.geometry = glyphGeometry(next, laidOut);
    mesh.visible = next.glyphAtlasIndices.length > 0;
    ready();
  };

  const layOut = (): void => {
    request += 1;
    const asked = request;
    const laidOut = label;
    getTextRenderInfo(layoutArgs(laidOut), (next) => {
      // Only the latest layout of a live label is shown. A superseded one still draws
      // again: troika answers a newer layout that reuses its glyphs at once, perhaps
      // before their fields have landed in the atlas, which they now have.
      if (!disposed && asked === request) show(next, laidOut);
      if (!disposed && asked !== request) ready();
    });
  };

  // Before each draw: the current atlas copy, and the lent material's latest settings.
  mesh.onBeforeRender = () => {
    if (info === undefined) return;
    const atlas = atlasCopy(info.sdfTexture);
    shared.atlas.value = atlas;
    shared.textureSize.value.set(atlas.image.width, atlas.image.height);
    for (const material of materials) {
      follow(material, base);
      material.transparent = true;
    }
    materials[0].depthWrite = false;
  };
  mesh.raycast = (raycaster, intersects) => {
    if (info !== undefined)
      pickBlock(mesh, info.blockBounds, label.curveRadius, raycaster, intersects);
  };

  const group = new Group();
  group.add(mesh);
  writeUniforms();
  showMaterials();
  layOut();
  return {
    object: group,
    update: (next) => {
      label = next;
      writeUniforms();
      showMaterials();
      layOut();
    },
    setMaterial: (material) => {
      base = material ?? defaultBase;
      for (const old of materials) old.dispose();
      materials = [
        passMaterial(base, shared, outline, true),
        passMaterial(base, shared, fill, false),
      ];
      showMaterials();
    },
    layout: () => (info === undefined ? undefined : layoutOf(info)),
    dispose: () => {
      disposed = true;
      mesh.geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
};
