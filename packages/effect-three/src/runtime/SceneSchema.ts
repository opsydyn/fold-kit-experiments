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

/** Which faces a material draws. */
export const MaterialSide = Schema.Literals(['front', 'back', 'double']);

const surface = {
  opacity: UnitInterval,
  transparent: Schema.Boolean,
  side: MaterialSide,
  wireframe: Schema.Boolean,
};

const shaded = { ...surface, flatShading: Schema.Boolean };

/** Unlit material parameters. */
export const BasicMaterial = Schema.TaggedStruct('Basic', { color: Rgb, ...surface });

/** Matte material parameters. */
export const LambertMaterial = Schema.TaggedStruct('Lambert', {
  color: Rgb,
  emissive: Rgb,
  ...shaded,
});

/** Shiny material parameters. */
export const PhongMaterial = Schema.TaggedStruct('Phong', {
  color: Rgb,
  emissive: Rgb,
  specular: Rgb,
  shininess: NonNegative,
  ...shaded,
});

const pbr = {
  color: Rgb,
  roughness: UnitInterval,
  metalness: UnitInterval,
  emissive: Rgb,
  emissiveIntensity: NonNegative,
};

/** Standard (PBR) material parameters. */
export const StandardMaterial = Schema.TaggedStruct('Standard', { ...pbr, ...shaded });

/** Physical material parameters: index of refraction in [1, 2.333], the range three.js documents. */
export const PhysicalMaterial = Schema.TaggedStruct('Physical', {
  ...pbr,
  clearcoat: UnitInterval,
  clearcoatRoughness: UnitInterval,
  transmission: UnitInterval,
  ior: Schema.Finite.check(Schema.isBetween({ minimum: 1, maximum: 2.333 })),
  ...shaded,
});

/** Normal-coloured material parameters. */
export const NormalMaterial = Schema.TaggedStruct('Normal', shaded);

/** Any material kind. */
export const SurfaceMaterial = Schema.Union([
  BasicMaterial,
  LambertMaterial,
  PhongMaterial,
  StandardMaterial,
  PhysicalMaterial,
  NormalMaterial,
]);

/** An owned geometry or a reference to a shared one. */
export const GeometryRef = Schema.Union([
  ...ShapeGeometry.members,
  Schema.TaggedStruct('SharedGeometry', { id: Schema.String }),
]);

/** An owned material or a reference to a shared one. */
export const MaterialRef = Schema.Union([
  ...SurfaceMaterial.members,
  Schema.TaggedStruct('SharedMaterial', { id: Schema.String }),
]);

/** Shared resource definitions. */
export const ResourceDefinitions = Schema.Struct({
  geometries: Schema.Array(Schema.Struct({ id: Schema.String, geometry: ShapeGeometry })),
  materials: Schema.Array(Schema.Struct({ id: Schema.String, material: SurfaceMaterial })),
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
  castShadow: Schema.Boolean,
  receiveShadow: Schema.Boolean,
});

/** Uniform ambient light. */
export const AmbientLightNode = Schema.TaggedStruct('AmbientLight', {
  key: Schema.String,
  color: Rgb,
  intensity: NonNegative,
});

/** Directional light. */
const isPowerOfTwo = (size: number) =>
  Number.isInteger(Math.log2(size)) || 'expected a power of two';

/** Shadow map size: a power of two from 16 to 8192 texels. */
const ShadowMapSize = Schema.Int.check(
  Schema.isBetween({ minimum: 16, maximum: 8192 }),
  Schema.makeFilter(isPowerOfTwo),
);

export const DirectionalLightNode = Schema.TaggedStruct('DirectionalLight', {
  key: Schema.String,
  color: Rgb,
  intensity: NonNegative,
  position: Vec3,
  castShadow: Schema.Boolean,
  shadowMapSize: ShadowMapSize,
  shadowBias: Schema.Finite,
  shadowArea: Positive,
});

/** Point light. */
export const PointLightNode = Schema.TaggedStruct('PointLight', {
  key: Schema.String,
  color: Rgb,
  intensity: NonNegative,
  position: Vec3,
  distance: NonNegative,
  decay: NonNegative,
  castShadow: Schema.Boolean,
  shadowMapSize: ShadowMapSize,
  shadowBias: Schema.Finite,
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
  castShadow: Schema.Boolean,
  shadowMapSize: ShadowMapSize,
  shadowBias: Schema.Finite,
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
    interactive: Schema.Boolean,
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

/** Scene-wide render settings. */
export const RenderSettings = Schema.Struct({
  shadows: Schema.Literals(['off', 'basic', 'percentage', 'soft', 'variance']),
  toneMapping: Schema.Literals(['none', 'linear', 'reinhard', 'cineon', 'aces', 'agx', 'neutral']),
  exposure: Positive,
  colorSpace: Schema.Literals(['srgb', 'linear']),
});

/** A complete scene description. */
export const SceneDescription = Schema.Struct({
  camera: Camera,
  render: RenderSettings,
  resources: ResourceDefinitions,
  children: Schema.Array(SceneNode),
});

/** Detail of pointer-leave events: the interactive mesh's key. */
export const KeyDetail = Schema.Struct({ key: Schema.String });

/**
 * Where the pointer met an interactive mesh: its key and ancestor path, the world-space
 * hit point, the distance from the camera, the world-space face normal, the texture
 * coordinates and the pointer's world-space ray.
 */
export const HitDetail = Schema.Struct({
  key: Schema.String,
  path: Schema.Array(Schema.String),
  point: Vec3,
  distance: Schema.Finite,
  normal: Vec3,
  uv: Schema.Tuple([Schema.Finite, Schema.Finite]),
  ray: Schema.Struct({ origin: Vec3, direction: Vec3 }),
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

/** A world-space ray: an origin and a unit direction. */
export const Ray = HitDetail.fields.ray;

/** Detail of drag events: the captured mesh, the pressed button and the pointer's ray. */
export const DragDetail = Schema.Struct({ key: Schema.String, button: Schema.Int, ray: Ray });

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
  Schema.TaggedStruct('Drag', DragDetail.fields),
  Schema.TaggedStruct('DragEnd', DragDetail.fields),
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
