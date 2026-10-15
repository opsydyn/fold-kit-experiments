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

import type { SceneNode as KernelSceneNode } from '../kernel/description.ts';

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

const Segments = Schema.Int.check(Schema.isGreaterThanOrEqualTo(3));

/** Sphere geometry parameters. */
export const SphereGeometry = Schema.TaggedStruct('Sphere', {
  radius: Positive,
  widthSegments: Segments,
  heightSegments: Schema.Int.check(Schema.isGreaterThanOrEqualTo(2)),
});

/** Plane geometry parameters. */
export const PlaneGeometry = Schema.TaggedStruct('Plane', { width: Positive, height: Positive });

/** Cylinder geometry parameters. A zero radius makes a cone. */
export const CylinderGeometry = Schema.TaggedStruct('Cylinder', {
  radiusTop: NonNegative,
  radiusBottom: NonNegative,
  height: Positive,
  radialSegments: Segments,
});

/** Torus geometry parameters. */
export const TorusGeometry = Schema.TaggedStruct('Torus', {
  radius: Positive,
  tube: Positive,
  radialSegments: Segments,
  tubularSegments: Segments,
});

/** Cone geometry parameters. */
export const ConeGeometry = Schema.TaggedStruct('Cone', {
  radius: Positive,
  height: Positive,
  radialSegments: Segments,
});

/** Capsule geometry parameters. */
export const CapsuleGeometry = Schema.TaggedStruct('Capsule', {
  radius: Positive,
  height: NonNegative,
  capSegments: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  radialSegments: Segments,
});

/** Ring geometry parameters. */
export const RingGeometry = Schema.TaggedStruct('Ring', {
  innerRadius: NonNegative,
  outerRadius: Positive,
  thetaSegments: Segments,
});

/** Circle geometry parameters. */
export const CircleGeometry = Schema.TaggedStruct('Circle', {
  radius: Positive,
  segments: Segments,
});

/** Any geometry shape. */
export const ShapeGeometry = Schema.Union([
  BoxGeometry,
  SphereGeometry,
  PlaneGeometry,
  CylinderGeometry,
  TorusGeometry,
  ConeGeometry,
  CapsuleGeometry,
  RingGeometry,
  CircleGeometry,
]);

/** How a transition progresses. */
export const Easing = Schema.Literals(['linear', 'easeInOutCubic', 'easeOutCubic', 'easeOutBack']);

/** How position and scale changes are shown. */
export const Transition = Schema.Union([
  Schema.TaggedStruct('Instant', {}),
  Schema.TaggedStruct('Ease', { seconds: Positive, easing: Easing }),
]);

/** Standard (PBR) material parameters. */
export const StandardMaterial = Schema.TaggedStruct('Standard', {
  color: Rgb,
  roughness: UnitInterval,
  metalness: UnitInterval,
});

/** An owned geometry or a reference to a shared one. */
export const GeometryRef = Schema.Union([
  ...ShapeGeometry.members,
  Schema.TaggedStruct('SharedGeometry', { id: Schema.String }),
]);

/** An owned material or a reference to a shared one. */
export const MaterialRef = Schema.Union([
  StandardMaterial,
  Schema.TaggedStruct('SharedMaterial', { id: Schema.String }),
]);

/** Shared resource definitions. */
export const ResourceDefinitions = Schema.Struct({
  geometries: Schema.Array(Schema.Struct({ id: Schema.String, geometry: ShapeGeometry })),
  materials: Schema.Array(Schema.Struct({ id: Schema.String, material: StandardMaterial })),
});

/** A renderable mesh. */
export const MeshNode = Schema.TaggedStruct('Mesh', {
  key: Schema.String,
  position: Vec3,
  rotation: Rotation,
  scale: Vec3,
  transition: Transition,
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

/** Point light. */
export const PointLightNode = Schema.TaggedStruct('PointLight', {
  key: Schema.String,
  color: Rgb,
  intensity: NonNegative,
  position: Vec3,
  distance: NonNegative,
  decay: NonNegative,
});

/** Spot light: `angle` in (0, π/2], `penumbra` in [0, 1]. */
export const SpotLightNode = Schema.TaggedStruct('SpotLight', {
  key: Schema.String,
  color: Rgb,
  intensity: NonNegative,
  position: Vec3,
  target: Vec3,
  distance: NonNegative,
  angle: Schema.Finite.check(
    Schema.isBetween({ minimum: 0, maximum: Math.PI / 2, exclusiveMinimum: true }),
  ),
  penumbra: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  decay: NonNegative,
});

/** Hemisphere light. */
export const HemisphereLightNode = Schema.TaggedStruct('HemisphereLight', {
  key: Schema.String,
  color: Rgb,
  groundColor: Rgb,
  intensity: NonNegative,
  position: Vec3,
});

/** Any scene node. Groups nest recursively. */
export const SceneNode: Schema.Codec<KernelSceneNode> = Schema.Union([
  Schema.TaggedStruct('Group', {
    key: Schema.String,
    position: Vec3,
    rotation: Rotation,
    scale: Vec3,
    transition: Transition,
    children: Schema.Array(Schema.suspend((): Schema.Codec<KernelSceneNode> => SceneNode)),
  }),
  MeshNode,
  AmbientLightNode,
  DirectionalLightNode,
  PointLightNode,
  SpotLightNode,
  HemisphereLightNode,
]);

/** A perspective camera. */
export const PerspectiveCamera = Schema.TaggedStruct('Perspective', {
  fov: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 180, exclusiveMinimum: true })),
  near: Positive,
  far: Positive,
  position: Vec3,
  lookAt: Vec3,
});

/** An orthographic camera; `zoom` is CSS pixels per world unit. */
export const OrthographicCamera = Schema.TaggedStruct('Orthographic', {
  zoom: Positive,
  near: Positive,
  far: Positive,
  position: Vec3,
  lookAt: Vec3,
});

/** The active camera. */
export const Camera = Schema.Union([PerspectiveCamera, OrthographicCamera]);

/** A complete scene description. */
export const SceneDescription = Schema.Struct({
  camera: Camera,
  resources: ResourceDefinitions,
  children: Schema.Array(SceneNode),
});

/** Detail of pointer-leave events: the interactive mesh's key. */
export const KeyDetail = Schema.Struct({ key: Schema.String });

/**
 * Where the pointer met an interactive mesh: its key, the world-space hit point, the
 * distance from the camera, the world-space face normal and the texture coordinates.
 */
export const HitDetail = Schema.Struct({
  key: Schema.String,
  point: Vec3,
  distance: Schema.Finite,
  normal: Vec3,
  uv: Schema.Tuple([Schema.Finite, Schema.Finite]),
});

/** Detail of button events: the hit plus `MouseEvent.button`. */
export const ButtonDetail = Schema.Struct({ ...HitDetail.fields, button: Schema.Int });

/** Detail of wheel events: the hit plus `WheelEvent.deltaX` and `deltaY`. */
export const WheelDetail = Schema.Struct({
  ...HitDetail.fields,
  deltaX: Schema.Finite,
  deltaY: Schema.Finite,
});

/** Detail of a click that hit no interactive mesh. */
export const MissDetail = Schema.Struct({ button: Schema.Int });

/** A pointer interaction with an interactive mesh, or a miss. */
export const SceneEvent = Schema.Union([
  Schema.TaggedStruct('PointerEnter', HitDetail.fields),
  Schema.TaggedStruct('PointerLeave', KeyDetail.fields),
  Schema.TaggedStruct('PointerMove', HitDetail.fields),
  Schema.TaggedStruct('PointerDown', ButtonDetail.fields),
  Schema.TaggedStruct('PointerUp', ButtonDetail.fields),
  Schema.TaggedStruct('Click', ButtonDetail.fields),
  Schema.TaggedStruct('DoubleClick', ButtonDetail.fields),
  Schema.TaggedStruct('ContextMenu', HitDetail.fields),
  Schema.TaggedStruct('Wheel', WheelDetail.fields),
  Schema.TaggedStruct('PointerMissed', MissDetail.fields),
]);

/** Why a scene description was rejected. */
export const DescriptionError = Schema.Union([
  Schema.TaggedStruct('DuplicateKey', { key: Schema.String }),
  Schema.TaggedStruct('DuplicateResourceId', {
    resource: Schema.Literals(['geometry', 'material']),
    id: Schema.String,
  }),
  Schema.TaggedStruct('UnknownSharedGeometry', { nodeKey: Schema.String, id: Schema.String }),
  Schema.TaggedStruct('UnknownSharedMaterial', { nodeKey: Schema.String, id: Schema.String }),
]);
