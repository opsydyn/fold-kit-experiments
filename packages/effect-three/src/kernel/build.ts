/**
 * Constructors that fill in defaults and return fully specified descriptions.
 *
 * @module
 */
import type {
  AmbientLightNode,
  Axis,
  BoxGeometry,
  Camera,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLightNode,
  HemisphereLightNode,
  Easing,
  GeometryRef,
  GroupNode,
  MaterialRef,
  MeshNode,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PointLightNode,
  RingGeometry,
  ResourceDefinitions,
  Rgb,
  Rotation,
  SceneDescription,
  SceneNode,
  SphereGeometry,
  SpotLightNode,
  TorusGeometry,
  StandardMaterial,
  Transition,
  Vec3,
} from './description.ts';

const origin: Vec3 = [0, 0, 0];
const unitScale: Vec3 = [1, 1, 1];
const noRotation: Rotation = { _tag: 'Fixed', euler: origin };
const noResources: ResourceDefinitions = { geometries: [], materials: [] };
const instantTransition: Transition = { _tag: 'Instant' };

/** Model-owned Euler angles in radians. */
export const fixed = (euler: Vec3): Rotation => ({ _tag: 'Fixed', euler });

/** A spin behaviour: `phase + radiansPerSecond * elapsedSeconds` about `axis`. */
export const spin = (options: {
  readonly axis: Axis;
  readonly radiansPerSecond: number;
  readonly phase?: number;
}): Rotation => ({
  _tag: 'Spin',
  axis: options.axis,
  radiansPerSecond: options.radiansPerSecond,
  phase: options.phase ?? 0,
});

/** Box geometry. Each dimension defaults to 1. */
export const box = (
  size: { readonly width?: number; readonly height?: number; readonly depth?: number } = {},
): BoxGeometry => ({
  _tag: 'Box',
  width: size.width ?? 1,
  height: size.height ?? 1,
  depth: size.depth ?? 1,
});

/** Sphere geometry. Defaults (as three.js): radius 1, 32 × 16 segments. */
export const sphere = (
  options: {
    readonly radius?: number;
    readonly widthSegments?: number;
    readonly heightSegments?: number;
  } = {},
): SphereGeometry => ({
  _tag: 'Sphere',
  radius: options.radius ?? 1,
  widthSegments: options.widthSegments ?? 32,
  heightSegments: options.heightSegments ?? 16,
});

/** Plane geometry in the XY plane, facing +Z. Each dimension defaults to 1. */
export const plane = (
  size: { readonly width?: number; readonly height?: number } = {},
): PlaneGeometry => ({ _tag: 'Plane', width: size.width ?? 1, height: size.height ?? 1 });

/** Cylinder geometry along Y. Defaults (as three.js): radius 1 top and bottom, height 1, 32 segments. */
export const cylinder = (
  options: {
    readonly radiusTop?: number;
    readonly radiusBottom?: number;
    readonly height?: number;
    readonly radialSegments?: number;
  } = {},
): CylinderGeometry => ({
  _tag: 'Cylinder',
  radiusTop: options.radiusTop ?? 1,
  radiusBottom: options.radiusBottom ?? 1,
  height: options.height ?? 1,
  radialSegments: options.radialSegments ?? 32,
});

/** Torus geometry. Defaults (as three.js): radius 1, tube 0.4, 12 × 48 segments. */
export const torus = (
  options: {
    readonly radius?: number;
    readonly tube?: number;
    readonly radialSegments?: number;
    readonly tubularSegments?: number;
  } = {},
): TorusGeometry => ({
  _tag: 'Torus',
  radius: options.radius ?? 1,
  tube: options.tube ?? 0.4,
  radialSegments: options.radialSegments ?? 12,
  tubularSegments: options.tubularSegments ?? 48,
});

/** Cone geometry along Y. Defaults (as three.js): radius 1, height 1, 32 segments. */
export const cone = (
  options: {
    readonly radius?: number;
    readonly height?: number;
    readonly radialSegments?: number;
  } = {},
): ConeGeometry => ({
  _tag: 'Cone',
  radius: options.radius ?? 1,
  height: options.height ?? 1,
  radialSegments: options.radialSegments ?? 32,
});

/** Capsule geometry along Y. Defaults (as three.js): radius 1, height 1, 4 cap and 8 radial segments. */
export const capsule = (
  options: {
    readonly radius?: number;
    readonly height?: number;
    readonly capSegments?: number;
    readonly radialSegments?: number;
  } = {},
): CapsuleGeometry => ({
  _tag: 'Capsule',
  radius: options.radius ?? 1,
  height: options.height ?? 1,
  capSegments: options.capSegments ?? 4,
  radialSegments: options.radialSegments ?? 8,
});

/** Ring geometry facing +Z. Defaults (as three.js): radii 0.5 and 1, 32 segments. */
export const ring = (
  options: {
    readonly innerRadius?: number;
    readonly outerRadius?: number;
    readonly thetaSegments?: number;
  } = {},
): RingGeometry => ({
  _tag: 'Ring',
  innerRadius: options.innerRadius ?? 0.5,
  outerRadius: options.outerRadius ?? 1,
  thetaSegments: options.thetaSegments ?? 32,
});

/** Circle geometry facing +Z. Defaults (as three.js): radius 1, 32 segments. */
export const circle = (
  options: { readonly radius?: number; readonly segments?: number } = {},
): CircleGeometry => ({
  _tag: 'Circle',
  radius: options.radius ?? 1,
  segments: options.segments ?? 32,
});

/** Position and scale changes apply immediately. The default. */
export const instant = (): Transition => instantTransition;

/** Position and scale changes ease to their new values over `seconds` of scene time. */
export const ease = (options: {
  readonly seconds: number;
  readonly easing?: Easing;
}): Transition => ({
  _tag: 'Ease',
  seconds: options.seconds,
  easing: options.easing ?? 'easeInOutCubic',
});

/** Standard material. Defaults: roughness 1, metalness 0. */
export const standard = (options: {
  readonly color: Rgb;
  readonly roughness?: number;
  readonly metalness?: number;
}): StandardMaterial => ({
  _tag: 'Standard',
  color: options.color,
  roughness: options.roughness ?? 1,
  metalness: options.metalness ?? 0,
});

/** A reference to a shared geometry defined in the scene's resources. */
export const sharedGeometry = (id: string): GeometryRef => ({ _tag: 'SharedGeometry', id });

/** A reference to a shared material defined in the scene's resources. */
export const sharedMaterial = (id: string): MaterialRef => ({ _tag: 'SharedMaterial', id });

/** Key and optional transform shared by `group` and `mesh`. */
export type TransformOptions = {
  readonly key: string;
  readonly position?: Vec3;
  readonly rotation?: Rotation;
  readonly scale?: Vec3;
  /** How position and scale changes are shown. Defaults to `instant()`. */
  readonly transition?: Transition;
};

/** A group of child nodes. */
export const group = (
  options: TransformOptions & { readonly children?: ReadonlyArray<SceneNode> },
): GroupNode => ({
  _tag: 'Group',
  key: options.key,
  position: options.position ?? origin,
  rotation: options.rotation ?? noRotation,
  scale: options.scale ?? unitScale,
  transition: options.transition ?? instantTransition,
  children: options.children ?? [],
});

/** A mesh. Not interactive unless `interactive` is true. */
export const mesh = (
  options: TransformOptions & {
    readonly geometry: GeometryRef;
    readonly material: MaterialRef;
    readonly interactive?: boolean;
  },
): MeshNode => ({
  _tag: 'Mesh',
  key: options.key,
  position: options.position ?? origin,
  rotation: options.rotation ?? noRotation,
  scale: options.scale ?? unitScale,
  transition: options.transition ?? instantTransition,
  geometry: options.geometry,
  material: options.material,
  interactive: options.interactive ?? false,
});

/** Ambient light. Defaults: white, intensity 1. */
export const ambientLight = (options: {
  readonly key: string;
  readonly color?: Rgb;
  readonly intensity?: number;
}): AmbientLightNode => ({
  _tag: 'AmbientLight',
  key: options.key,
  color: options.color ?? 0xffffff,
  intensity: options.intensity ?? 1,
});

/** Directional light. Defaults: white, intensity 1, shining from `[0, 1, 0]`. */
export const directionalLight = (options: {
  readonly key: string;
  readonly color?: Rgb;
  readonly intensity?: number;
  readonly position?: Vec3;
}): DirectionalLightNode => ({
  _tag: 'DirectionalLight',
  key: options.key,
  color: options.color ?? 0xffffff,
  intensity: options.intensity ?? 1,
  position: options.position ?? [0, 1, 0],
});

/** Point light. Defaults (as three.js): white, intensity 1, at the origin, no cut-off, decay 2. */
export const pointLight = (options: {
  readonly key: string;
  readonly color?: Rgb;
  readonly intensity?: number;
  readonly position?: Vec3;
  readonly distance?: number;
  readonly decay?: number;
}): PointLightNode => ({
  _tag: 'PointLight',
  key: options.key,
  color: options.color ?? 0xffffff,
  intensity: options.intensity ?? 1,
  position: options.position ?? origin,
  distance: options.distance ?? 0,
  decay: options.decay ?? 2,
});

/**
 * Spot light. Defaults (as three.js): white, intensity 1, at `[0, 1, 0]` aimed at the
 * origin, no cut-off, a π/3 half-angle, a hard edge and decay 2.
 */
export const spotLight = (options: {
  readonly key: string;
  readonly color?: Rgb;
  readonly intensity?: number;
  readonly position?: Vec3;
  readonly target?: Vec3;
  readonly distance?: number;
  readonly angle?: number;
  readonly penumbra?: number;
  readonly decay?: number;
}): SpotLightNode => ({
  _tag: 'SpotLight',
  key: options.key,
  color: options.color ?? 0xffffff,
  intensity: options.intensity ?? 1,
  position: options.position ?? [0, 1, 0],
  target: options.target ?? origin,
  distance: options.distance ?? 0,
  angle: options.angle ?? Math.PI / 3,
  penumbra: options.penumbra ?? 0,
  decay: options.decay ?? 2,
});

/** Hemisphere light. Defaults (as three.js): white sky and ground, intensity 1, from `[0, 1, 0]`. */
export const hemisphereLight = (options: {
  readonly key: string;
  readonly color?: Rgb;
  readonly groundColor?: Rgb;
  readonly intensity?: number;
  readonly position?: Vec3;
}): HemisphereLightNode => ({
  _tag: 'HemisphereLight',
  key: options.key,
  color: options.color ?? 0xffffff,
  groundColor: options.groundColor ?? 0xffffff,
  intensity: options.intensity ?? 1,
  position: options.position ?? [0, 1, 0],
});

/** Perspective camera. Defaults: fov 50, near 0.1, far 100, at `[0, 0, 5]` looking at the origin. */
export const perspectiveCamera = (
  options: Partial<Omit<PerspectiveCamera, '_tag'>> = {},
): PerspectiveCamera => ({
  _tag: 'Perspective',
  fov: options.fov ?? 50,
  near: options.near ?? 0.1,
  far: options.far ?? 100,
  position: options.position ?? [0, 0, 5],
  lookAt: options.lookAt ?? origin,
});

/**
 * Orthographic camera. Defaults (as React Three Fiber): zoom 1 (one CSS pixel per world
 * unit, so set it), near 0.1, far 1000, at `[0, 0, 5]` looking at the origin.
 */
export const orthographicCamera = (
  options: Partial<Omit<OrthographicCamera, '_tag'>> = {},
): OrthographicCamera => ({
  _tag: 'Orthographic',
  zoom: options.zoom ?? 1,
  near: options.near ?? 0.1,
  far: options.far ?? 1000,
  position: options.position ?? [0, 0, 5],
  lookAt: options.lookAt ?? origin,
});

/** A scene description. */
export const scene = (options: {
  readonly camera?: Camera;
  readonly resources?: Partial<ResourceDefinitions>;
  readonly children?: ReadonlyArray<SceneNode>;
}): SceneDescription => ({
  camera: options.camera ?? perspectiveCamera(),
  resources: {
    geometries: options.resources?.geometries ?? noResources.geometries,
    materials: options.resources?.materials ?? noResources.materials,
  },
  children: options.children ?? [],
});
