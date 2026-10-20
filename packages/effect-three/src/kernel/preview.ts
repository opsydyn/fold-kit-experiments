/**
 * A still of a scene as SVG text, drawn without a browser or a GPU: for previews made on a
 * server, in a build or in a test. The description is applied to a scene graph as it is
 * for the renderer, posed at a moment of scene time, projected with three's `Projector`
 * and painted as flat-shaded paths, as three's `SVGRenderer` does
 * (`examples/jsm/renderers/SVGRenderer.js` at 0.186.1), but in the order a binary space
 * partition gives (`paintOrder.ts`) rather than by depth, so that faces meeting (a floor
 * and what stands on it) are painted in the right order. Each face is lit by the diffuse
 * terms of three's shaders (`lights_pars_begin` and `lights_physical_pars_fragment` at
 * 0.186.1): ambient and hemisphere light, then directional, point and spot light by the
 * face's normal with their distance and cone falloff, over π (`BRDF_Lambert`).
 *
 * It is a preview, not the picture: no textures, shadows, specular highlights, fog,
 * environment lighting, tone mapping, post-processing, views, HUD or render-kit parts
 * (sky, shader grids, wide lines), and no labels. Borrowed models and text are drawn when
 * `store` lends their objects and fonts. Skinned models stand in their rest pose.
 *
 * @module
 */
import {
  Box2,
  Color,
  type ColorSpace,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  LinearSRGBColorSpace,
  LineBasicMaterial,
  LineDashedMaterial,
  type Material,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshNormalMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  Light,
  Line,
  type Object3D,
  PointLight,
  Points,
  Scene,
  Sprite,
  PointsMaterial,
  SpotLight,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  AmbientLight,
} from 'three';
import {
  Projector,
  RenderableFace,
  RenderableLine,
  RenderableSprite,
} from 'three/addons/renderers/Projector.js';

import type { Rgb, SceneDescription } from './description.ts';
import {
  type Facet,
  type Mark,
  paintOrder,
  type Plane,
  split,
  type Unit,
  unitOf,
} from './paintOrder.ts';
import type { ResourceStore } from './resources.ts';
import { createSceneGraph, type SceneGraphOptions } from './sceneGraph.ts';
import type { DescriptionError } from './sceneIndex.ts';

export type PreviewOptions = {
  /** The picture's size in pixels; the camera takes its aspect ratio. */
  readonly width: number;
  readonly height: number;
  /** The moment of scene time shown, in seconds: behaviours and clips as they are then. */
  readonly at?: number;
  /** A colour behind the scene; transparent without one. */
  readonly background?: Rgb | null;
  /** Lends what borrowed nodes, maps by id and text name; nothing is lent without one. */
  readonly store?: ResourceStore;
  /** Behaviours nodes may name, beyond the built-in ones, as for the scene graph. */
  readonly behaviours?: SceneGraphOptions['behaviours'];
  /** Digits after the decimal point in coordinates. */
  readonly precision?: number;
};

export type PreviewResult =
  | { readonly _tag: 'Preview'; readonly svg: string }
  | { readonly _tag: 'Invalid'; readonly error: DescriptionError };

/** Pixels each edge of a face is widened by, as `SVGRenderer`'s `overdraw`. */
const overdraw = 0.5;

const black = new Color(0, 0, 0);

/** Diffuse irradiance on a face from every light, before `BRDF_Lambert`'s 1 / π. */
const irradianceAt = (
  lights: ReadonlyArray<Light>,
  position: Vector3,
  normal: Vector3,
  into: Color,
): Color => {
  into.copy(black);
  const lightPosition = new Vector3();
  const toLight = new Vector3();
  const direction = new Vector3();
  for (const light of lights) {
    const color = light.color.clone().multiplyScalar(light.intensity);
    if (light instanceof AmbientLight) {
      into.add(color);
    } else if (light instanceof HemisphereLight) {
      lightPosition.setFromMatrixPosition(light.matrixWorld).normalize();
      const weight = 0.5 * normal.dot(lightPosition) + 0.5;
      into.add(light.groundColor.clone().lerp(light.color, weight).multiplyScalar(light.intensity));
    } else if (light instanceof DirectionalLight) {
      lightPosition.setFromMatrixPosition(light.matrixWorld);
      direction.setFromMatrixPosition(light.target.matrixWorld);
      toLight.subVectors(lightPosition, direction).normalize();
      into.add(color.multiplyScalar(Math.max(normal.dot(toLight), 0)));
    } else if (light instanceof PointLight || light instanceof SpotLight) {
      lightPosition.setFromMatrixPosition(light.matrixWorld);
      toLight.subVectors(lightPosition, position);
      const distance = toLight.length();
      toLight.normalize();
      const cone = light instanceof SpotLight ? spotAttenuation(light, toLight) : 1;
      const falloff = distanceAttenuation(distance, light.distance, light.decay);
      into.add(color.multiplyScalar(Math.max(normal.dot(toLight), 0) * cone * falloff));
    }
  }
  return into;
};

/** three's `getDistanceAttenuation`. */
const distanceAttenuation = (distance: number, cutoff: number, decay: number): number => {
  const falloff = 1 / Math.max(distance ** decay, 0.01);
  return cutoff > 0
    ? falloff * Math.min(Math.max(1 - (distance / cutoff) ** 4, 0), 1) ** 2
    : falloff;
};

const smoothstep = (low: number, high: number, x: number): number => {
  const t = Math.min(Math.max((x - low) / (high - low), 0), 1);
  return t * t * (3 - 2 * t);
};

/** three's `getSpotAttenuation`, with the cone and penumbra cosines `WebGLLights` gives it. */
const spotAttenuation = (light: SpotLight, toLight: Vector3): number => {
  const direction = new Vector3()
    .setFromMatrixPosition(light.matrixWorld)
    .sub(new Vector3().setFromMatrixPosition(light.target.matrixWorld))
    .normalize();
  return smoothstep(
    Math.cos(light.angle),
    Math.cos(light.angle * (1 - light.penumbra)),
    direction.dot(toLight),
  );
};

type Painter = {
  readonly lights: ReadonlyArray<Light>;
  readonly normalView: Matrix3;
  readonly colorSpace: ColorSpace;
};

/**
 * A face's colour, as `SVGRenderer.renderFace3` with three's physical diffuse term, lit
 * from its object's `centre` so that the faces of one flat side share a colour; `undefined`
 * for a material it does not draw. A metal is lit as if matte: without the environment it
 * reflects, three would draw it nearly black.
 */
const faceColor = (
  painter: Painter,
  face: RenderableFace,
  material: Material,
  centre: Vector3,
): Color | undefined => {
  if (material instanceof MeshBasicMaterial) {
    const color = material.color.clone();
    return material.vertexColors ? color.multiply(face.color) : color;
  }
  if (material instanceof MeshNormalMaterial) {
    const normal = face.normalModel.clone().applyMatrix3(painter.normalView).normalize();
    return new Color(normal.x, normal.y, normal.z).multiplyScalar(0.5).addScalar(0.5);
  }
  if (
    material instanceof MeshLambertMaterial ||
    material instanceof MeshPhongMaterial ||
    material instanceof MeshStandardMaterial ||
    material instanceof MeshToonMaterial
  ) {
    const diffuse = material.color.clone();
    if (material.vertexColors) diffuse.multiply(face.color);
    return irradianceAt(painter.lights, centre, face.normalModel, new Color())
      .multiply(diffuse)
      .multiplyScalar(1 / Math.PI)
      .add(material.emissive.clone().multiplyScalar(material.emissiveIntensity));
  }
  return undefined;
};

/** A colour as SVG writes it, clamped to what a display shows. */
const styleOf = (color: Color, colorSpace: ColorSpace): string => {
  const shown = new Color(
    Math.min(Math.max(color.r, 0), 1),
    Math.min(Math.max(color.g, 0), 1),
    Math.min(Math.max(color.b, 0), 1),
  );
  return `#${shown.getHexString(colorSpace)}`;
};

/** What a material's opacity is worth: three blends only a transparent material. */
const opacityOf = (material: Material): number => (material.transparent ? material.opacity : 1);

/**
 * Stands in for what an object draws, posed where it is in the world, for `Projector` to
 * project alone: each instance of an instanced mesh as a mesh of its own (`Projector` draws
 * an instanced mesh's geometry once), its colour copied into its material.
 */
const standInsFor = (
  object: Object3D,
): ReadonlyArray<{ readonly standIn: Object3D; readonly tinted?: Material }> => {
  if (!(object instanceof InstancedMesh)) {
    const standIn = object.clone(false);
    standIn.matrix.copy(object.matrixWorld);
    return [{ standIn }];
  }
  const material = Array.isArray(object.material) ? object.material[0] : object.material;
  if (material === undefined) return [];
  const matrix = new Matrix4();
  const standIns: Array<{ readonly standIn: Object3D; readonly tinted?: Material }> = [];
  for (let i = 0; i < object.count; i++) {
    object.getMatrixAt(i, matrix);
    const tinted = object.instanceColor === null ? undefined : material.clone();
    if (tinted !== undefined && 'color' in tinted && tinted.color instanceof Color) {
      tinted.color.multiply(object.getColorAt(i, new Color()));
    }
    const standIn = new Mesh(object.geometry, tinted ?? material);
    standIn.matrix.multiplyMatrices(object.matrixWorld, matrix);
    standIn.renderOrder = object.renderOrder;
    standIns.push(tinted === undefined ? { standIn } : { standIn, tinted });
  }
  return standIns;
};

const number =
  (precision: number) =>
  (value: number): string =>
    String(Number(value.toFixed(precision)));

/** A shape's paint, and for a mark its outline on the picture. */
type Item = { readonly paint: string; readonly d: string };

/** Widens each edge of a polygon on the picture by `overdraw` pixels, as `SVGRenderer.expand`. */
const widened = (points: ReadonlyArray<Vector2>): ReadonlyArray<Vector2> => {
  const out = points.map((point) => point.clone());
  for (const [i, from] of out.entries()) {
    const to = out[(i + 1) % out.length];
    const length = to === undefined ? 0 : from.distanceTo(to);
    if (to === undefined || length === 0) continue;
    const step = new Vector2().subVectors(to, from).multiplyScalar(overdraw / length);
    to.add(step);
    from.sub(step);
  }
  return out;
};

/**
 * A face's paint. An opaque one is also outlined in its colour, a little (the width is set
 * once, on the group of every path), so that the pieces a face is cut into show no seams.
 */
const facetPaint = (fill: string, opacity: number): string =>
  opacity < 1
    ? `fill="${fill}" fill-opacity="${String(Number(opacity.toFixed(2)))}"`
    : `fill="${fill}" stroke="${fill}"`;

/** Where an object's bounds are centred in the world. */
const centreOf = (object: Object3D): Vector3 => {
  if (!(object instanceof Mesh)) return new Vector3().setFromMatrixPosition(object.matrixWorld);
  const geometry = object.geometry;
  if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
  return (geometry.boundingSphere?.center.clone() ?? new Vector3()).applyMatrix4(
    object.matrixWorld,
  );
};

const isDrawn = (object: Object3D): boolean =>
  object instanceof Mesh ||
  object instanceof Line ||
  object instanceof Points ||
  object instanceof Sprite;

/**
 * Draws `description` as SVG text `width` by `height` pixels, at `at` seconds of scene time,
 * or says why the description is invalid.
 */
export const previewSvg = (
  description: SceneDescription,
  options: PreviewOptions,
): PreviewResult => {
  const { width, height } = options;
  const graph = createSceneGraph({
    ...(options.store === undefined ? {} : { store: options.store }),
    ...(options.behaviours === undefined ? {} : { behaviours: options.behaviours }),
  });
  const applied = graph.reconcile(description);
  if (applied._tag === 'Invalid') {
    graph.dispose();
    return applied;
  }
  graph.resize(width, height);
  graph.tick(options.at ?? 0);
  const { scene, camera } = graph;
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();

  const lights: Array<Light> = [];
  const drawn: Array<Object3D> = [];
  scene.traverseVisible((object) => {
    if (object instanceof Light) lights.push(object);
    else if (isDrawn(object)) drawn.push(object);
  });
  const colorSpace =
    graph.renderSettings().colorSpace === 'linear' ? LinearSRGBColorSpace : SRGBColorSpace;
  const painter: Painter = {
    lights,
    normalView: new Matrix3().getNormalMatrix(camera.matrixWorldInverse),
    colorSpace,
  };
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const at = number(options.precision ?? 1);
  const eye = new Vector3().setFromMatrixPosition(camera.matrixWorld);
  const ahead = camera.getWorldDirection(new Vector3());
  // Only what is past the near plane is drawn: the rest would project behind the eye.
  const near: Plane = { normal: ahead, constant: ahead.dot(eye) + camera.near };
  const xy = (x: number, y: number): string => `${at(x * halfWidth)},${at(-y * halfHeight)}`;

  /** A face as lit, the part of it past the near plane; none for a material not drawn. */
  function facetOf(
    face: RenderableFace,
    material: Material,
    centre: Vector3,
    opacity: number,
  ): Facet<Item> | undefined {
    const color = faceColor(painter, face, material, centre);
    if (color === undefined) return undefined;
    const points = [face.v1, face.v2, face.v3].map((vertex) => vertex.positionWorld.clone());
    const paint = facetPaint(styleOf(color, colorSpace), opacity);
    return split(near, { _tag: 'Facet', points, item: { paint, d: '' } }).front;
  }

  // Each object stands in alone, so that what it draws is known as one unit. What is not
  // depth-tested (gizmos drawn over everything) is painted after the rest, by render
  // order, as three draws it.
  const projector = new Projector();
  const holder = new Scene();
  const units: Array<Unit<Item>> = [];
  const over: Array<{ readonly renderOrder: number; readonly item: Facet<Item> | Mark<Item> }> = [];
  const tinted: Array<Material> = [];
  for (const object of drawn) {
    for (const { standIn, tinted: copy } of standInsFor(object)) {
      if (copy !== undefined) tinted.push(copy);
      standIn.matrixAutoUpdate = false;
      holder.add(standIn);
      const projected = projector.projectScene(holder, camera, false, true);
      holder.remove(standIn);
      const centre = centreOf(standIn);
      const facets: Array<Facet<Item>> = [];
      const marks: Array<Mark<Item>> = [];
      const keep = (material: Material, item: Facet<Item> | Mark<Item>): void => {
        if (!material.depthTest) over.push({ renderOrder: standIn.renderOrder, item });
        else if (item._tag === 'Facet') facets.push(item);
        else marks.push(item);
      };
      for (const element of projected.elements) {
        const material: Material | null = element.material;
        if (material === null || material.opacity === 0) continue;
        const opacity = opacityOf(material);
        const faded = opacity < 1 ? ` fill-opacity="${at(opacity)}"` : '';
        if (element instanceof RenderableFace) {
          const seen = facetOf(element, material, centre, opacity);
          if (seen === undefined) continue;
          keep(material, seen);
        } else if (element instanceof RenderableLine && material instanceof LineBasicMaterial) {
          const a = element.v1.positionScreen;
          const b = element.v2.positionScreen;
          const dashes =
            material instanceof LineDashedMaterial
              ? ` stroke-dasharray="${at(material.dashSize)},${at(material.gapSize)}"`
              : '';
          const stroked = opacity < 1 ? ` stroke-opacity="${at(opacity)}"` : '';
          keep(material, {
            _tag: 'Mark',
            at: element.v1.positionWorld.clone().lerp(element.v2.positionWorld, 0.5),
            item: {
              paint: `fill="none" stroke="${styleOf(material.color, colorSpace)}"${stroked} stroke-width="${at(material.linewidth)}" stroke-linecap="${material.linecap}"${dashes}`,
              d: `M${xy(a.x, a.y)}L${xy(b.x, b.y)}`,
            },
          });
        } else if (
          element instanceof RenderableSprite &&
          (material instanceof SpriteMaterial || material instanceof PointsMaterial)
        ) {
          const size = material instanceof PointsMaterial ? material.size : 1;
          const w = element.scale.x * halfWidth * size;
          const h = element.scale.y * halfHeight * size;
          const x = element.x * halfWidth;
          const y = -element.y * halfHeight;
          keep(material, {
            _tag: 'Mark',
            at: new Vector3(element.x, element.y, element.z).unproject(camera),
            item: {
              paint: `fill="${styleOf(material.color, colorSpace)}"${faded}`,
              d: `M${at(x - w / 2)},${at(y - h / 2)}h${at(w)}v${at(h)}h${at(-w)}z`,
            },
          });
        }
      }
      if (facets.length + marks.length > 0) units.push(unitOf(facets, marks, eye));
    }
  }
  for (const material of tinted) material.dispose();
  graph.dispose();

  const ordered = [
    ...paintOrder(units, eye),
    ...over.toSorted((a, b) => a.renderOrder - b.renderOrder).map(({ item }) => item),
  ];

  // Consecutive shapes of one paint share a path, as `SVGRenderer.addPath` does.
  const clip = new Box2(new Vector2(-halfWidth, -halfHeight), new Vector2(halfWidth, halfHeight));
  const toPicture = (point: Vector3): Vector2 => {
    const projectedPoint = point.clone().project(camera);
    return new Vector2(projectedPoint.x * halfWidth, -projectedPoint.y * halfHeight);
  };
  /** A shape's outline on the picture, or none when it falls outside it. */
  function outlineOf(shape: Facet<Item> | Mark<Item>): string | undefined {
    if (shape._tag === 'Mark') return shape.item.d;
    const corners = widened(shape.points.map(toPicture));
    return new Box2().setFromPoints([...corners]).intersectsBox(clip)
      ? `M${corners.map((corner) => `${at(corner.x)},${at(corner.y)}`).join('L')}z`
      : undefined;
  }
  const groups: Array<{ readonly paint: string; readonly outlines: Array<string> }> = [];
  for (const shape of ordered) {
    const outline = outlineOf(shape);
    const last = groups.at(-1);
    if (outline === undefined) continue;
    if (last?.paint === shape.item.paint) last.outlines.push(outline);
    else groups.push({ paint: shape.item.paint, outlines: [outline] });
  }
  const paths = groups.map(({ paint, outlines }) => `<path ${paint} d="${outlines.join('')}"/>`);

  const background =
    options.background === undefined || options.background === null
      ? ''
      : `<rect x="${at(-halfWidth)}" y="${at(-halfHeight)}" width="${at(width)}" height="${at(height)}" fill="${styleOf(new Color(options.background), colorSpace)}"/>`;
  return {
    _tag: 'Preview',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${at(width)}" height="${at(height)}" viewBox="${at(-halfWidth)} ${at(-halfHeight)} ${at(width)} ${at(height)}">${background}<g stroke-width="0.6" stroke-linejoin="round">${paths.join('')}</g></svg>`,
  };
};
