/**
 * Scene descriptions: plain, immutable data with no closures and no three.js objects.
 *
 * Descriptions are fully specified (normalised). Defaults are filled in by the public
 * constructors and the runtime Schema, so the kernel can diff without guessing.
 *
 * @module
 */

/** A three-component vector `[x, y, z]`. */
export type Vec3 = readonly [x: number, y: number, z: number];

/** A rotation axis for behaviours. */
export type Axis = 'x' | 'y' | 'z';

/** A colour as a 24-bit RGB integer, for example `0x3366ff`. */
export type Rgb = number;

/**
 * Rotation is owned by exactly one source (ADR: D4).
 *
 * - `Fixed`: the model owns the Euler angles.
 * - `Spin`: a behaviour owns them. The angle is a pure function of elapsed scene time:
 *   `phase + radiansPerSecond * elapsedSeconds` about `axis`, other axes zero.
 */
export type Rotation =
  | { readonly _tag: 'Fixed'; readonly euler: Vec3 }
  | {
      readonly _tag: 'Spin';
      readonly axis: Axis;
      readonly radiansPerSecond: number;
      readonly phase: number;
    };

/** Box geometry parameters. */
export type BoxGeometry = {
  readonly _tag: 'Box';
  readonly width: number;
  readonly height: number;
  readonly depth: number;
};

/** Physically based standard material parameters. */
export type StandardMaterial = {
  readonly _tag: 'Standard';
  readonly color: Rgb;
  readonly roughness: number;
  readonly metalness: number;
};

/** A geometry owned by one mesh (`Box`) or shared by id (`SharedGeometry`). */
export type GeometryRef = BoxGeometry | { readonly _tag: 'SharedGeometry'; readonly id: string };

/** A material owned by one mesh (`Standard`) or shared by id (`SharedMaterial`). */
export type MaterialRef =
  | StandardMaterial
  | { readonly _tag: 'SharedMaterial'; readonly id: string };

/** A shared geometry definition. */
export type GeometryDefinition = { readonly id: string; readonly geometry: BoxGeometry };

/** A shared material definition. */
export type MaterialDefinition = { readonly id: string; readonly material: StandardMaterial };

/** Shared resource definitions referenced by `SharedGeometry` and `SharedMaterial`. */
export type ResourceDefinitions = {
  readonly geometries: ReadonlyArray<GeometryDefinition>;
  readonly materials: ReadonlyArray<MaterialDefinition>;
};

/** A transform node that may contain children. */
export type GroupNode = {
  readonly _tag: 'Group';
  readonly key: string;
  readonly position: Vec3;
  readonly rotation: Rotation;
  readonly scale: Vec3;
  readonly children: ReadonlyArray<SceneNode>;
};

/** A renderable mesh. `interactive` meshes take part in pointer hit testing. */
export type MeshNode = {
  readonly _tag: 'Mesh';
  readonly key: string;
  readonly position: Vec3;
  readonly rotation: Rotation;
  readonly scale: Vec3;
  readonly geometry: GeometryRef;
  readonly material: MaterialRef;
  readonly interactive: boolean;
};

/** Uniform ambient light. */
export type AmbientLightNode = {
  readonly _tag: 'AmbientLight';
  readonly key: string;
  readonly color: Rgb;
  readonly intensity: number;
};

/** Directional light shining from `position` towards the origin. */
export type DirectionalLightNode = {
  readonly _tag: 'DirectionalLight';
  readonly key: string;
  readonly color: Rgb;
  readonly intensity: number;
  readonly position: Vec3;
};

/** Any node in a scene. Keys are unique across the whole scene. */
export type SceneNode = GroupNode | MeshNode | AmbientLightNode | DirectionalLightNode;

/** The node kinds the kernel knows how to host. */
export type NodeKind = SceneNode['_tag'];

/** The single active perspective camera. */
export type PerspectiveCamera = {
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly position: Vec3;
  readonly lookAt: Vec3;
};

/** A complete scene: camera, shared resources and root nodes. */
export type SceneDescription = {
  readonly camera: PerspectiveCamera;
  readonly resources: ResourceDefinitions;
  readonly children: ReadonlyArray<SceneNode>;
};
