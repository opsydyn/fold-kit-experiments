/**
 * Constructors that fill in defaults and return fully specified descriptions.
 *
 * @module
 */
import type {
  AmbientLightNode,
  Animation,
  BasicMaterial,
  Behave,
  BorrowedNode,
  Axis,
  BoxGeometry,
  Camera,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLightNode,
  HemisphereLightNode,
  Instance,
  InstancesNode,
  LambertMaterial,
  Easing,
  GeometryRef,
  GroupNode,
  MaterialRef,
  MeshNode,
  NormalMaterial,
  OrthographicCamera,
  PhongMaterial,
  PhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLightNode,
  PostEffect,
  RenderSettings,
  RenderTexture,
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
  View,
  ViewRect,
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

/**
 * Unlit material. Defaults (as three.js): white, opaque, front faces.
 */
export const basic = (options: Partial<Omit<BasicMaterial, '_tag'>> = {}): BasicMaterial => ({
  _tag: 'Basic',
  color: options.color ?? 0xffffff,
  map: options.map ?? null,
  opacity: options.opacity ?? 1,
  transparent: options.transparent ?? false,
  side: options.side ?? 'front',
  wireframe: options.wireframe ?? false,
});

/**
 * Matte material. Defaults (as three.js): white, no emission, smooth shading.
 */
export const lambert = (options: Partial<Omit<LambertMaterial, '_tag'>> = {}): LambertMaterial => ({
  _tag: 'Lambert',
  color: options.color ?? 0xffffff,
  map: options.map ?? null,
  emissive: options.emissive ?? 0x000000,
  opacity: options.opacity ?? 1,
  transparent: options.transparent ?? false,
  side: options.side ?? 'front',
  wireframe: options.wireframe ?? false,
  flatShading: options.flatShading ?? false,
});

/**
 * Shiny material. Defaults (as three.js): white, specular `0x111111`, shininess 30.
 */
export const phong = (options: Partial<Omit<PhongMaterial, '_tag'>> = {}): PhongMaterial => ({
  _tag: 'Phong',
  color: options.color ?? 0xffffff,
  map: options.map ?? null,
  emissive: options.emissive ?? 0x000000,
  specular: options.specular ?? 0x111111,
  shininess: options.shininess ?? 30,
  opacity: options.opacity ?? 1,
  transparent: options.transparent ?? false,
  side: options.side ?? 'front',
  wireframe: options.wireframe ?? false,
  flatShading: options.flatShading ?? false,
});

/**
 * Physically based material. Defaults (as three.js): white, roughness 1, metalness 0.
 */
export const standard = (
  options: Partial<Omit<StandardMaterial, '_tag'>> = {},
): StandardMaterial => ({
  _tag: 'Standard',
  color: options.color ?? 0xffffff,
  map: options.map ?? null,
  roughness: options.roughness ?? 1,
  metalness: options.metalness ?? 0,
  emissive: options.emissive ?? 0x000000,
  emissiveIntensity: options.emissiveIntensity ?? 1,
  opacity: options.opacity ?? 1,
  transparent: options.transparent ?? false,
  side: options.side ?? 'front',
  wireframe: options.wireframe ?? false,
  flatShading: options.flatShading ?? false,
});

/**
 * Physically based material with clearcoat and transmission. Defaults (as three.js):
 * the standard defaults, no clearcoat or transmission, index of refraction 1.5.
 */
export const physical = (
  options: Partial<Omit<PhysicalMaterial, '_tag'>> = {},
): PhysicalMaterial => ({
  _tag: 'Physical',
  color: options.color ?? 0xffffff,
  map: options.map ?? null,
  roughness: options.roughness ?? 1,
  metalness: options.metalness ?? 0,
  emissive: options.emissive ?? 0x000000,
  emissiveIntensity: options.emissiveIntensity ?? 1,
  clearcoat: options.clearcoat ?? 0,
  clearcoatRoughness: options.clearcoatRoughness ?? 0,
  transmission: options.transmission ?? 0,
  ior: options.ior ?? 1.5,
  opacity: options.opacity ?? 1,
  transparent: options.transparent ?? false,
  side: options.side ?? 'front',
  wireframe: options.wireframe ?? false,
  flatShading: options.flatShading ?? false,
});

/**
 * Normal-coloured material, for debugging geometry. Defaults as three.js.
 */
export const normalMaterial = (
  options: Partial<Omit<NormalMaterial, '_tag'>> = {},
): NormalMaterial => ({
  _tag: 'Normal',
  opacity: options.opacity ?? 1,
  transparent: options.transparent ?? false,
  side: options.side ?? 'front',
  wireframe: options.wireframe ?? false,
  flatShading: options.flatShading ?? false,
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
  readonly transition?: Transition /** A registered behaviour to apply on top of the transform. */;
  readonly behaviour?: Behave | null;
};

/** A group of child nodes. */
export const group = (
  options: TransformOptions & {
    readonly interactive?: boolean;
    readonly children?: ReadonlyArray<SceneNode>;
  },
): GroupNode => ({
  _tag: 'Group',
  key: options.key,
  position: options.position ?? origin,
  rotation: options.rotation ?? noRotation,
  scale: options.scale ?? unitScale,
  transition: options.transition ?? instantTransition,
  behaviour: options.behaviour ?? null,
  interactive: options.interactive ?? false,
  children: options.children ?? [],
});

/** A mesh. Not interactive unless `interactive` is true. */
export const mesh = (
  options: TransformOptions & {
    readonly geometry: GeometryRef;
    readonly material: MaterialRef;
    readonly interactive?: boolean;
    readonly castShadow?: boolean;
    readonly receiveShadow?: boolean;
  },
): MeshNode => ({
  _tag: 'Mesh',
  key: options.key,
  position: options.position ?? origin,
  rotation: options.rotation ?? noRotation,
  scale: options.scale ?? unitScale,
  transition: options.transition ?? instantTransition,
  behaviour: options.behaviour ?? null,
  geometry: options.geometry,
  material: options.material,
  interactive: options.interactive ?? false,
  castShadow: options.castShadow ?? false,
  receiveShadow: options.receiveShadow ?? false,
});

/** One instance. Defaults: at the origin, unrotated, unit scale, white. */
export const instance = (options: {
  readonly key: string;
  readonly position?: Vec3;
  readonly rotation?: Vec3;
  readonly scale?: Vec3;
  readonly color?: Rgb;
}): Instance => ({
  key: options.key,
  position: options.position ?? origin,
  rotation: options.rotation ?? origin,
  scale: options.scale ?? unitScale,
  color: options.color ?? 0xffffff,
});

/** Many instances of one geometry and material, drawn together. Not interactive by default. */
export const instances = (
  options: TransformOptions & {
    readonly geometry: GeometryRef;
    readonly material: MaterialRef;
    readonly instances: ReadonlyArray<Instance>;
    readonly interactive?: boolean;
    readonly castShadow?: boolean;
    readonly receiveShadow?: boolean;
  },
): InstancesNode => ({
  _tag: 'Instances',
  key: options.key,
  position: options.position ?? origin,
  rotation: options.rotation ?? noRotation,
  scale: options.scale ?? unitScale,
  transition: options.transition ?? instantTransition,
  behaviour: options.behaviour ?? null,
  geometry: options.geometry,
  material: options.material,
  interactive: options.interactive ?? false,
  castShadow: options.castShadow ?? false,
  receiveShadow: options.receiveShadow ?? false,
  instances: options.instances,
});

/** Applies a registered behaviour by name. Parameters default to the behaviour's own. */
export const behave = (name: string, params: Readonly<Record<string, number>> = {}): Behave => ({
  name,
  params,
});

/** Plays an animation clip by name. Defaults: normal speed, looping. */
export const play = (
  clip: string,
  options: { readonly speed?: number; readonly loop?: boolean } = {},
): Animation => ({ clip, speed: options.speed ?? 1, loop: options.loop ?? true });

/** An object lent to the resource store under `id`. Not interactive by default. */
export const borrowed = (
  options: TransformOptions & {
    readonly id: string;
    readonly interactive?: boolean;
    readonly animation?: Animation | null;
  },
): BorrowedNode => ({
  _tag: 'Borrowed',
  key: options.key,
  id: options.id,
  animation: options.animation ?? null,
  position: options.position ?? origin,
  rotation: options.rotation ?? noRotation,
  scale: options.scale ?? unitScale,
  transition: options.transition ?? instantTransition,
  behaviour: options.behaviour ?? null,
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

/**
 * Directional light. Defaults: white, intensity 1, shining from `[0, 1, 0]`; no shadow,
 * or a 512² shadow map covering ±5 world units (three.js's defaults) when casting.
 */
export const directionalLight = (options: {
  readonly key: string;
  readonly color?: Rgb;
  readonly intensity?: number;
  readonly position?: Vec3;
  readonly castShadow?: boolean;
  readonly shadowMapSize?: number;
  readonly shadowBias?: number;
  readonly shadowArea?: number;
}): DirectionalLightNode => ({
  _tag: 'DirectionalLight',
  key: options.key,
  color: options.color ?? 0xffffff,
  intensity: options.intensity ?? 1,
  position: options.position ?? [0, 1, 0],
  castShadow: options.castShadow ?? false,
  shadowMapSize: options.shadowMapSize ?? 512,
  shadowBias: options.shadowBias ?? 0,
  shadowArea: options.shadowArea ?? 5,
});

/** Point light. Defaults (as three.js): white, intensity 1, at the origin, no cut-off, decay 2. */
export const pointLight = (options: {
  readonly key: string;
  readonly color?: Rgb;
  readonly intensity?: number;
  readonly position?: Vec3;
  readonly distance?: number;
  readonly decay?: number;
  readonly castShadow?: boolean;
  readonly shadowMapSize?: number;
  readonly shadowBias?: number;
}): PointLightNode => ({
  _tag: 'PointLight',
  key: options.key,
  color: options.color ?? 0xffffff,
  intensity: options.intensity ?? 1,
  position: options.position ?? origin,
  distance: options.distance ?? 0,
  decay: options.decay ?? 2,
  castShadow: options.castShadow ?? false,
  shadowMapSize: options.shadowMapSize ?? 512,
  shadowBias: options.shadowBias ?? 0,
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
  readonly castShadow?: boolean;
  readonly shadowMapSize?: number;
  readonly shadowBias?: number;
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
  castShadow: options.castShadow ?? false,
  shadowMapSize: options.shadowMapSize ?? 512,
  shadowBias: options.shadowBias ?? 0,
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

const noEffects: ReadonlyArray<PostEffect> = [];

/**
 * Bloom: bright areas glow. Defaults: strength 1 (as three.js), radius 0.4 and threshold
 * 0.85, so only the brightest areas bloom (three.js leaves these two unset).
 */
export const bloom = (
  options: {
    readonly strength?: number;
    readonly radius?: number;
    readonly threshold?: number;
  } = {},
): PostEffect => ({
  _tag: 'Bloom',
  strength: options.strength ?? 1,
  radius: options.radius ?? 0.4,
  threshold: options.threshold ?? 0.85,
});

/** Vignette: darker edges. Defaults (as three.js's `VignetteShader`): offset 1, darkness 1. */
export const vignette = (
  options: { readonly offset?: number; readonly darkness?: number } = {},
): PostEffect => ({
  _tag: 'Vignette',
  offset: options.offset ?? 1,
  darkness: options.darkness ?? 1,
});

/** Film grain. Defaults (as three.js's `FilmPass`): intensity 0.5, in colour. */
export const film = (
  options: { readonly intensity?: number; readonly grayscale?: boolean } = {},
): PostEffect => ({
  _tag: 'Film',
  intensity: options.intensity ?? 0.5,
  grayscale: options.grayscale ?? false,
});

/**
 * Render settings. Defaults: frames on demand, full resolution, shadows off, no tone
 * mapping, exposure 1, sRGB output. Two deliberate differences from React Three Fiber:
 *
 * - Frames default to `demand`, not `always`. Every visual change passes through the
 *   kernel, which knows when a frame is needed, so nothing has to call `invalidate` and
 *   idle scenes stop drawing.
 * - Tone mapping defaults to `none`, not ACES, so a validated palette renders as given.
 */
export const renderSettings = (options: Partial<RenderSettings> = {}): RenderSettings => ({
  frames: options.frames ?? 'demand',
  effects: options.effects ?? noEffects,
  resolution: options.resolution ?? 1,
  shadows: options.shadows ?? 'off',
  toneMapping: options.toneMapping ?? 'none',
  exposure: options.exposure ?? 1,
  colorSpace: options.colorSpace ?? 'srgb',
});

const defaultRenderSettings = renderSettings();

const fullRect: ViewRect = { x: 0, y: 0, width: 1, height: 1 };
const noViews: ReadonlyArray<View> = [];

/** A view of the scene through `camera` into `rect` of the canvas (default: all of it). */
export const view = (options: {
  readonly key: string;
  readonly camera: Camera;
  readonly rect?: Partial<ViewRect>;
}): View => ({
  key: options.key,
  camera: options.camera,
  rect: {
    x: options.rect?.x ?? fullRect.x,
    y: options.rect?.y ?? fullRect.y,
    width: options.rect?.width ?? fullRect.width,
    height: options.rect?.height ?? fullRect.height,
  },
});

const noRenderTextures: ReadonlyArray<RenderTexture> = [];

/**
 * A scene rendered into a texture, lent under `id` for materials' `map`. Defaults:
 * 512 × 512, the default camera, transparent.
 */
export const renderTexture = (options: {
  readonly id: string;
  readonly width?: number;
  readonly height?: number;
  readonly camera?: Camera;
  readonly background?: Rgb | null;
  readonly children?: ReadonlyArray<SceneNode>;
}): RenderTexture => ({
  id: options.id,
  width: options.width ?? 512,
  height: options.height ?? 512,
  camera: options.camera ?? perspectiveCamera(),
  background: options.background ?? null,
  children: options.children ?? [],
});

/** A scene description. */
export const scene = (options: {
  readonly camera?: Camera;
  readonly views?: ReadonlyArray<View>;
  readonly renderTextures?: ReadonlyArray<RenderTexture>;
  readonly render?: RenderSettings;
  readonly resources?: Partial<ResourceDefinitions>;
  readonly children?: ReadonlyArray<SceneNode>;
}): SceneDescription => ({
  camera: options.camera ?? perspectiveCamera(),
  views: options.views ?? noViews,
  renderTextures: options.renderTextures ?? noRenderTextures,
  render: options.render ?? defaultRenderSettings,
  resources: {
    geometries: options.resources?.geometries ?? noResources.geometries,
    materials: options.resources?.materials ?? noResources.materials,
  },
  children: options.children ?? [],
});
