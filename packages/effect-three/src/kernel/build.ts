/**
 * Constructors that fill in defaults and return fully specified descriptions.
 *
 * @module
 */
import type {
  AmbientLightNode,
  Axis,
  BoxGeometry,
  DirectionalLightNode,
  GeometryRef,
  GroupNode,
  MaterialRef,
  MeshNode,
  PerspectiveCamera,
  ResourceDefinitions,
  Rgb,
  Rotation,
  SceneDescription,
  SceneNode,
  StandardMaterial,
  Vec3,
} from './description.ts';

const origin: Vec3 = [0, 0, 0];
const unitScale: Vec3 = [1, 1, 1];
const noRotation: Rotation = { _tag: 'Fixed', euler: origin };
const noResources: ResourceDefinitions = { geometries: [], materials: [] };

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

/** Perspective camera. Defaults: fov 50, near 0.1, far 100, at `[0, 0, 5]` looking at the origin. */
export const perspectiveCamera = (options: Partial<PerspectiveCamera> = {}): PerspectiveCamera => ({
  fov: options.fov ?? 50,
  near: options.near ?? 0.1,
  far: options.far ?? 100,
  position: options.position ?? [0, 0, 5],
  lookAt: options.lookAt ?? origin,
});

/** A scene description. */
export const scene = (options: {
  readonly camera?: PerspectiveCamera;
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
