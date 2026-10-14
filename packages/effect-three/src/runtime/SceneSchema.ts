/**
 * Effect Schemas for scene descriptions.
 *
 * They validate untrusted descriptions at the boundary, type the Foldkit `scene`
 * property and derive property-test generators. Each decoded `Type` is checked at compile
 * time to be exactly the kernel's description type, so the two can't drift.
 *
 * @module
 */
import { Schema } from 'effect';

import type * as Kernel from '../kernel/description.ts';

const NonNegative = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
const Positive = Schema.Finite.check(Schema.isGreaterThan(0));
const UnitInterval = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));

/** A three-component vector `[x, y, z]` of finite numbers. */
export const Vec3 = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);

/** A rotation axis. */
export const Axis = Schema.Literals(['x', 'y', 'z']);

/** A 24-bit RGB colour, for example `0x3366ff`. */
export const Rgb = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 0xffffff }));

/** Model-owned Euler angles, or a spin behaviour that owns the rotation. */
export const Rotation = Schema.Union([
  Schema.TaggedStruct('Fixed', { euler: Vec3 }),
  Schema.TaggedStruct('Spin', {
    axis: Axis,
    radiansPerSecond: Schema.Finite,
    phase: Schema.Finite,
  }),
]);

/** Box geometry parameters. */
export const BoxGeometry = Schema.TaggedStruct('Box', {
  width: Positive,
  height: Positive,
  depth: Positive,
});

/** Standard (PBR) material parameters. */
export const StandardMaterial = Schema.TaggedStruct('Standard', {
  color: Rgb,
  roughness: UnitInterval,
  metalness: UnitInterval,
});

/** An owned geometry or a reference to a shared one. */
export const GeometryRef = Schema.Union([
  BoxGeometry,
  Schema.TaggedStruct('SharedGeometry', { id: Schema.String }),
]);

/** An owned material or a reference to a shared one. */
export const MaterialRef = Schema.Union([
  StandardMaterial,
  Schema.TaggedStruct('SharedMaterial', { id: Schema.String }),
]);

/** Shared resource definitions. */
export const ResourceDefinitions = Schema.Struct({
  geometries: Schema.Array(Schema.Struct({ id: Schema.String, geometry: BoxGeometry })),
  materials: Schema.Array(Schema.Struct({ id: Schema.String, material: StandardMaterial })),
});

/** A renderable mesh. */
export const MeshNode = Schema.TaggedStruct('Mesh', {
  key: Schema.String,
  position: Vec3,
  rotation: Rotation,
  scale: Vec3,
  geometry: GeometryRef,
  material: MaterialRef,
  interactive: Schema.Boolean,
});

/** Uniform ambient light. */
export const AmbientLightNode = Schema.TaggedStruct('AmbientLight', {
  key: Schema.String,
  color: Rgb,
  intensity: NonNegative,
});

/** Directional light. */
export const DirectionalLightNode = Schema.TaggedStruct('DirectionalLight', {
  key: Schema.String,
  color: Rgb,
  intensity: NonNegative,
  position: Vec3,
});

/** Any scene node. Groups nest recursively. */
export const SceneNode: Schema.Codec<Kernel.SceneNode> = Schema.Union([
  Schema.TaggedStruct('Group', {
    key: Schema.String,
    position: Vec3,
    rotation: Rotation,
    scale: Vec3,
    children: Schema.Array(Schema.suspend((): Schema.Codec<Kernel.SceneNode> => SceneNode)),
  }),
  MeshNode,
  AmbientLightNode,
  DirectionalLightNode,
]);

/** The active perspective camera. */
export const PerspectiveCamera = Schema.Struct({
  fov: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 180, exclusiveMinimum: true })),
  near: Positive,
  far: Positive,
  position: Vec3,
  lookAt: Vec3,
});

/** A complete scene description. */
export const SceneDescription = Schema.Struct({
  camera: PerspectiveCamera,
  resources: ResourceDefinitions,
  children: Schema.Array(SceneNode),
});

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time proof that the Schemas decode exactly the kernel types. */
export type SchemaMatchesKernel =
  [
    Equals<typeof Vec3.Type, Kernel.Vec3>,
    Equals<typeof Rotation.Type, Kernel.Rotation>,
    Equals<typeof GeometryRef.Type, Kernel.GeometryRef>,
    Equals<typeof MaterialRef.Type, Kernel.MaterialRef>,
    Equals<typeof ResourceDefinitions.Type, Kernel.ResourceDefinitions>,
    Equals<typeof MeshNode.Type, Kernel.MeshNode>,
    Equals<typeof PerspectiveCamera.Type, Kernel.PerspectiveCamera>,
    Equals<typeof SceneDescription.Type, Kernel.SceneDescription>,
  ] extends ReadonlyArray<true>
    ? true
    : never;

export const schemaMatchesKernel: SchemaMatchesKernel = true;
