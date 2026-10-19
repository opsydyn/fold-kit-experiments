import {
  attribute,
  float,
  floor,
  fwidth,
  length,
  max,
  mix,
  mod,
  positionGeometry,
  pow,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  Color,
  DataTexture,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  type Texture,
  WebGPURenderer,
} from 'three/webgpu';
/**
 * Spike: troika labels drawn by WebGPU. troika lays the text out and builds its signed
 * distance field atlas (on its own canvas, not the renderer's context); a TSL node material
 * draws one instanced quad per glyph from that atlas, porting troika's GLSL fragment logic
 * (`TextDerivedMaterial.js`): atlas cell from the glyph index, one of four channels,
 * exponential distance decoding, and anti-aliasing from `fwidth`.
 */
import { getTextRenderInfo } from 'troika-three-text/dist/troika-three-text.esm.js';

type RenderInfo = {
  readonly glyphBounds: Float32Array;
  readonly glyphAtlasIndices: Float32Array;
  readonly glyphColors: Uint8Array | null;
  readonly sdfTexture: Texture;
  readonly sdfGlyphSize: number;
  readonly sdfExponent: number;
};

const layOut = (options: Record<string, unknown>): Promise<RenderInfo> =>
  new Promise((resolve) => getTextRenderInfo(options, (info: RenderInfo) => resolve(info)));

/**
 * troika's atlas as raw bytes. It is a WebGL canvas packing four glyphs into each pixel's
 * R, G, B and A; copied into a WebGPU texture as an image it goes through premultiplied
 * alpha, which corrupts R, G and B wherever the A glyph is thin. `readPixels` (as troika's
 * own Safari workaround does) copies the bytes exactly, bottom row first, so no flip.
 */
const atlasBytes = (atlas: Texture): DataTexture => {
  const canvas = atlas.image as HTMLCanvasElement;
  const gl = canvas.getContext('webgl');
  if (gl === null) throw new Error('troika atlas has no WebGL context');
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const bytes = new DataTexture(pixels, canvas.width, canvas.height, RGBAFormat);
  bytes.minFilter = LinearFilter;
  bytes.magFilter = LinearFilter;
  bytes.generateMipmaps = false;
  bytes.flipY = false;
  bytes.needsUpdate = true;
  return bytes;
};

/** A label as an instanced mesh: one quad per glyph, drawn from troika's atlas in TSL. */
const glyphMesh = (info: RenderInfo, colour: Color, atlas: Texture) => {
  const count = info.glyphAtlasIndices.length;
  const quad = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
  const geometry = new InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  geometry.setAttribute('aGlyphBounds', new InstancedBufferAttribute(info.glyphBounds, 4));
  geometry.setAttribute('aGlyphIndex', new InstancedBufferAttribute(info.glyphAtlasIndices, 1));
  const colours = new Float32Array(count * 3);
  for (let glyph = 0; glyph < count; glyph++) {
    const own = info.glyphColors;
    colours.set(
      own === null
        ? [colour.r, colour.g, colour.b]
        : [own[glyph * 3]! / 255, own[glyph * 3 + 1]! / 255, own[glyph * 3 + 2]! / 255],
      glyph * 3,
    );
  }
  geometry.setAttribute('aGlyphColor', new InstancedBufferAttribute(colours, 3));
  geometry.instanceCount = count;

  const bounds = attribute<'vec4'>('aGlyphBounds', 'vec4');
  // Rounded: interpolated across the quad, 5 can arrive as 4.9999, and the channel with it
  // (troika's GLSL rounds too: `floor(ch + 0.5)`).
  const index = floor(attribute<'float'>('aGlyphIndex', 'float').add(0.5));
  const glyphColour = attribute<'vec3'>('aGlyphColor', 'vec3');
  const image = atlas.image as { readonly width: number; readonly height: number };
  const textureSize = uniform(vec2(image.width, image.height));
  const glyphSize = uniform(float(info.sdfGlyphSize));
  const exponent = uniform(float(info.sdfExponent));

  // Vertex: the unit quad stretched over the glyph's bounds.
  const glyphUv = positionGeometry.xy;
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  material.positionNode = vec3(mix(bounds.xy, bounds.zw, glyphUv), 0);

  // Fragment: the glyph's cell in the atlas, and its channel (four glyphs share a texel).
  const columns = textureSize.x.div(glyphSize);
  const perCell = glyphSize.div(textureSize);
  const cellIndex = floor(index.div(4));
  const cell = vec2(mod(cellIndex, columns), floor(cellIndex.div(columns)));
  const start = cell.mul(perCell);
  const sample = texture(atlas, mix(start, start.add(perCell), glyphUv));
  const channel = mod(index, 4);
  const value = channel
    .equal(0)
    .select(
      sample.r,
      channel.equal(1).select(sample.g, channel.equal(2).select(sample.b, sample.a)),
    );

  // Exponential encoding back to a signed distance, in glyph units (inside negative).
  const dimensions = bounds.zw.sub(bounds.xy);
  const outside = value.lessThanEqual(0.5);
  const folded = outside.select(value, float(1).sub(value));
  const absolute = float(1)
    .sub(pow(folded.mul(2), float(1).div(exponent)))
    .mul(max(dimensions.x, dimensions.y));
  const distance = outside.select(absolute, absolute.negate());
  const antialias = length(fwidth(glyphUv.mul(dimensions))).mul(0.5);

  material.colorNode = vec4(glyphColour, 1);
  material.opacityNode = float(1).sub(smoothstep(antialias.negate(), antialias, distance));
  return { geometry, material };
};

const status = (text: string) => {
  Reflect.set(globalThis, '__spike', text);
};

const main = async () => {
  const canvas = document.querySelector('canvas');
  if (canvas === null) throw new Error('no canvas');
  const renderer = new WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  renderer.setSize(800, 400, false);
  const backend = (renderer.backend as { readonly isWebGPUBackend?: boolean }).isWebGPUBackend
    ? 'WebGPU'
    : 'WebGL 2 fallback';

  const scene = new Scene();
  scene.background = new Color(0x15171d);
  const camera = new PerspectiveCamera(40, 2, 0.1, 100);
  camera.position.set(0, 0, 6);

  const font = '/inter-latin-400-normal.woff';
  const title = await layOut({
    text: new URLSearchParams(location.search).get('text') ?? 'effect-three labels on WebGPU',
    font,
    fontSize: Number(new URLSearchParams(location.search).get('size') ?? 0.32),
    anchorX: 'center',
    anchorY: 'middle',
    sdfGlyphSize: 64,
  });
  const coloured = await layOut({
    text: 'colour ranges come along too',
    font,
    fontSize: 0.26,
    anchorX: 'center',
    anchorY: 'middle',
    sdfGlyphSize: 64,
    colorRanges: { 0: 0xf5ce60, 7: 0xe6e3dc, 14: 0x5b9bff, 19: 0xe6e3dc },
  });
  // The atlas is shared and grows as labels add glyphs: size and upload it after every
  // layout (troika reads the size each frame), or earlier labels sample the wrong cells.
  const atlas = atlasBytes(title.sdfTexture);
  // `?direct` draws from troika's own canvas texture instead, for comparison: copied as an
  // image, its four-channel atlas comes through with small marks (premultiplied alpha).
  const direct = new URLSearchParams(location.search).has('direct');
  const used: Texture = direct ? title.sdfTexture : atlas;
  if (direct) title.sdfTexture.needsUpdate = true;
  const first = glyphMesh(title, new Color(0xffffff), used);
  const second = glyphMesh(coloured, new Color(0xffffff), used);
  const { Mesh } = await import('three/webgpu');
  const top = new Mesh(first.geometry, first.material);
  top.position.y = 0.45;
  const bottom = new Mesh(second.geometry, second.material);
  bottom.position.y = -0.35;
  bottom.rotation.y = 0.35;
  scene.add(top, bottom);
  renderer.render(scene, camera);
  // troika writes glyph fields into its atlas canvas as they are generated: upload again
  // once they have all landed, and draw.
  status(
    `drawn: ${backend}, ${title.glyphAtlasIndices.length + coloured.glyphAtlasIndices.length} glyphs`,
  );
};

main().catch((error: unknown) => status(`failed: ${String(error)}`));
