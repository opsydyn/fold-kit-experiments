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

const Steps = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/** Text from a lent typeface font. */
export const TextGeometry = Schema.TaggedStruct('Text', {
  text: Schema.String,
  font: Schema.String,
  size: Positive,
  depth: NonNegative,
  curveSegments: Steps,
  bevel: Schema.NullOr(
    Schema.Struct({
      thickness: NonNegative,
      size: NonNegative,
      offset: Schema.Finite,
      segments: Steps,
    }),
  ),
  center: Schema.Boolean,
  letterSpacing: Schema.Finite,
  lineHeight: NonNegative,
  align: Schema.Literals(['left', 'center', 'right']),
});

/** Any geometry shape. */
export const ShapeGeometry = Schema.Union([
  TextGeometry,
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

/** A registered behaviour, by name, with numeric parameters. */
export const Behave = Schema.Struct({
  name: Schema.String,
  params: Schema.Record(Schema.String, Schema.Finite),
});

/** How a transition progresses. */
export const Easing = Schema.Literals(['linear', 'easeInOutCubic', 'easeOutCubic', 'easeOutBack']);

/** How position and scale changes are shown. */
export const Transition = Schema.Union([
  Schema.TaggedStruct('Instant', {}),
  Schema.TaggedStruct('Ease', { seconds: Positive, easing: Easing }),
]);

/** Which faces a material draws. */
export const MaterialSide = Schema.Literals(['front', 'back', 'double']);

/** A texture lent to the store, by id, or `null` for none. */
const TextureId = Schema.NullOr(Schema.String);

const surface = {
  opacity: UnitInterval,
  transparent: Schema.Boolean,
  side: MaterialSide,
  wireframe: Schema.Boolean,
};

const shaded = { ...surface, flatShading: Schema.Boolean };

/** Unlit material parameters. */
export const BasicMaterial = Schema.TaggedStruct('Basic', {
  color: Rgb,
  map: TextureId,
  ...surface,
});

/** Matte material parameters. */
export const LambertMaterial = Schema.TaggedStruct('Lambert', {
  color: Rgb,
  map: TextureId,
  emissive: Rgb,
  ...shaded,
});

/** Shiny material parameters. */
export const PhongMaterial = Schema.TaggedStruct('Phong', {
  color: Rgb,
  map: TextureId,
  emissive: Rgb,
  specular: Rgb,
  shininess: NonNegative,
  ...shaded,
});

const pbr = {
  color: Rgb,
  map: TextureId,
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

/** A shadow catcher: only the shadows cast onto it. */
export const ShadowMaterial = Schema.TaggedStruct('Shadow', { color: Rgb, opacity: UnitInterval });

/** Any material kind. */
export const SurfaceMaterial = Schema.Union([
  ShadowMaterial,
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
/** A rigid body for a mesh. */
const Upright = { halfHeight: Positive, radius: Positive };

/** A collider of a body's own, placed in it. */
export const ColliderDescription = Schema.Struct({
  shape: Schema.Union([
    Schema.TaggedStruct('Cuboid', { halfExtents: Vec3 }),
    Schema.TaggedStruct('Ball', { radius: Positive }),
    Schema.TaggedStruct('Capsule', Upright),
    Schema.TaggedStruct('Cylinder', Upright),
    Schema.TaggedStruct('Cone', Upright),
  ]),
  position: Vec3,
  rotation: Vec3,
});

export const Body = Schema.Struct({
  type: Schema.Literals(['dynamic', 'fixed', 'kinematic']),
  collider: Schema.Literals(['cuboid', 'ball', 'hull', 'trimesh']),
  mass: Schema.NullOr(Positive),
  friction: NonNegative,
  restitution: NonNegative,
  linearDamping: NonNegative,
  angularDamping: NonNegative,
  gravityScale: Schema.Finite,
  ccd: Schema.Boolean,
  sensor: Schema.Boolean,
  linearVelocity: Vec3,
  angularVelocity: Vec3,
  impulse: Schema.NullOr(Schema.Struct({ id: Schema.Finite, impulse: Vec3 })),
  colliders: Schema.NullOr(Schema.Array(ColliderDescription)),
  contactForces: Schema.NullOr(NonNegative),
});

/** A physics world. */
/** A body a joint holds: a node's, or one instance's. */
export const BodyRef = Schema.Struct({
  key: Schema.String,
  instance: Schema.NullOr(Schema.String),
});

/** A joint's motor: a target position and velocity, and how hard it pursues each. */
export const JointMotor = Schema.Struct({
  position: Schema.Finite,
  velocity: Schema.Finite,
  stiffness: NonNegative,
  damping: NonNegative,
});

/** A joint's range of motion. */
export const JointLimits = Schema.Tuple([Schema.Finite, Schema.Finite]);

/** How a joint holds its bodies. */
export const JointKind = Schema.Union([
  Schema.TaggedStruct('Fixed', { frameA: Vec3, frameB: Vec3 }),
  Schema.TaggedStruct('Spherical', {}),
  Schema.TaggedStruct('Revolute', {
    axis: Vec3,
    limits: Schema.NullOr(JointLimits),
    motor: Schema.NullOr(JointMotor),
  }),
  Schema.TaggedStruct('Prismatic', {
    axis: Vec3,
    limits: Schema.NullOr(JointLimits),
    motor: Schema.NullOr(JointMotor),
  }),
  Schema.TaggedStruct('Rope', { length: Schema.Finite }),
  Schema.TaggedStruct('Spring', {
    restLength: Schema.Finite,
    stiffness: Schema.Finite,
    damping: Schema.Finite,
  }),
]);

/** A joint between two bodies. */
export const Joint = Schema.Struct({
  key: Schema.String,
  a: BodyRef,
  b: BodyRef,
  anchorA: Vec3,
  anchorB: Vec3,
  kind: JointKind,
  contacts: Schema.Boolean,
});

export const Physics = Schema.Struct({
  gravity: Vec3,
  paused: Schema.Boolean,
  timeStep: Positive,
  interpolate: Schema.Boolean,
  debug: Schema.Boolean,
  joints: Schema.Array(Joint),
});

export const MeshNode = Schema.TaggedStruct('Mesh', {
  key: Schema.String,
  position: Vec3,
  rotation: Rotation,
  scale: Vec3,
  transition: Transition,
  behaviour: Schema.NullOr(Behave),
  geometry: GeometryRef,
  material: MaterialRef,
  interactive: Schema.Boolean,
  castShadow: Schema.Boolean,
  receiveShadow: Schema.Boolean,
  body: Schema.NullOr(Body),
});

/** One instance of an instances node. */
export const Instance = Schema.Struct({
  key: Schema.String,
  position: Vec3,
  rotation: Vec3,
  scale: Vec3,
  color: Rgb,
});

/** Many instances of one geometry and material. */
export const InstancesNode = Schema.TaggedStruct('Instances', {
  key: Schema.String,
  position: Vec3,
  rotation: Rotation,
  scale: Vec3,
  transition: Transition,
  behaviour: Schema.NullOr(Behave),
  geometry: GeometryRef,
  material: MaterialRef,
  interactive: Schema.Boolean,
  castShadow: Schema.Boolean,
  receiveShadow: Schema.Boolean,
  instances: Schema.Array(Instance),
  body: Schema.NullOr(Body),
});

/** An application object lent to the store under `id`. */
export const Animation = Schema.Struct({
  clip: Schema.String,
  speed: Schema.Finite,
  loop: Schema.Boolean,
});

export const BorrowedNode = Schema.TaggedStruct('Borrowed', {
  key: Schema.String,
  id: Schema.String,
  animation: Schema.NullOr(Animation),
  position: Vec3,
  rotation: Rotation,
  scale: Vec3,
  transition: Transition,
  behaviour: Schema.NullOr(Behave),
  interactive: Schema.Boolean,
  body: Schema.NullOr(Body),
});

/** Distance-field text. */
export const LabelNode = Schema.TaggedStruct('Label', {
  key: Schema.String,
  position: Vec3,
  rotation: Rotation,
  scale: Vec3,
  transition: Transition,
  behaviour: Schema.NullOr(Behave),
  interactive: Schema.Boolean,
  text: Schema.String,
  font: Schema.NullOr(Schema.String),
  fontSize: Positive,
  color: Rgb,
  fillOpacity: NonNegative,
  anchorX: Schema.Union([Schema.Literals(['left', 'center', 'right']), Schema.Finite]),
  anchorY: Schema.Union([
    Schema.Literals(['top', 'top-baseline', 'middle', 'bottom-baseline', 'bottom']),
    Schema.Finite,
  ]),
  maxWidth: Schema.NullOr(Positive),
  lineHeight: Schema.NullOr(Positive),
  letterSpacing: Schema.Finite,
  textAlign: Schema.Literals(['left', 'right', 'center', 'justify']),
  outlineWidth: NonNegative,
  outlineColor: Rgb,
  outlineOpacity: NonNegative,
  outlineBlur: NonNegative,
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
/** A grid of lines on the XZ plane. */
export const GridNode = Schema.TaggedStruct('Grid', {
  key: Schema.String,
  position: Vec3,
  size: Positive,
  divisions: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  color: Rgb,
  centerColor: Rgb,
});

/** Drei's shader grid. */
export const ShaderGridNode = Schema.TaggedStruct('ShaderGrid', {
  key: Schema.String,
  position: Vec3,
  rotation: Vec3,
  size: Schema.Tuple([Positive, Positive]),
  cellSize: Positive,
  cellThickness: NonNegative,
  cellColor: Rgb,
  sectionSize: Positive,
  sectionThickness: NonNegative,
  sectionColor: Rgb,
  infinite: Schema.Boolean,
  followCamera: Schema.Boolean,
  fadeDistance: Positive,
  fadeStrength: NonNegative,
  fadeFrom: Schema.Finite,
  side: Schema.Literals(['front', 'back', 'double']),
});

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
    behaviour: Schema.NullOr(Behave),
    interactive: Schema.Boolean,
    children: Schema.Array(Schema.suspend((): Schema.Codec<KernelSceneNode> => SceneNode)),
    body: Schema.NullOr(Body),
  }),
  MeshNode,
  InstancesNode,
  BorrowedNode,
  LabelNode,
  ShaderGridNode,
  AmbientLightNode,
  DirectionalLightNode,
  PointLightNode,
  SpotLightNode,
  HemisphereLightNode,
  GridNode,
]);

/** The fraction of the way a camera closes every sixtieth of a second: 0 jumps. */
const CameraDamping = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThan(1));

/** A perspective camera. */
export const PerspectiveCamera = Schema.TaggedStruct('Perspective', {
  fov: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 180, exclusiveMinimum: true })),
  near: Positive,
  far: Positive,
  position: Vec3,
  lookAt: Vec3,
  damping: CameraDamping,
});

/** An orthographic camera; `zoom` is CSS pixels per world unit. */
export const OrthographicCamera = Schema.TaggedStruct('Orthographic', {
  zoom: Positive,
  near: Positive,
  far: Positive,
  position: Vec3,
  lookAt: Vec3,
  damping: CameraDamping,
});

/** The active camera. */
export const Camera = Schema.Union([PerspectiveCamera, OrthographicCamera]);

const NonNegativeFinite = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

/** A post-processing effect. */
export const PostEffect = Schema.Union([
  Schema.TaggedStruct('Bloom', {
    strength: NonNegativeFinite,
    radius: NonNegativeFinite,
    threshold: NonNegativeFinite,
  }),
  Schema.TaggedStruct('Vignette', { offset: NonNegativeFinite, darkness: NonNegativeFinite }),
  Schema.TaggedStruct('Film', { intensity: NonNegativeFinite, grayscale: Schema.Boolean }),
]);

/** Scene-wide render settings. */
export const RenderSettings = Schema.Struct({
  effects: Schema.Array(PostEffect),
  frames: Schema.Literals(['always', 'demand', 'never']),
  resolution: Schema.Finite.check(
    Schema.isBetween({ minimum: 0, maximum: 1, exclusiveMinimum: true }),
  ),
  shadows: Schema.Literals(['off', 'basic', 'percentage', 'soft', 'variance']),
  toneMapping: Schema.Literals(['none', 'linear', 'reinhard', 'cineon', 'aces', 'agx', 'neutral']),
  exposure: Positive,
  colorSpace: Schema.Literals(['srgb', 'linear']),
});

/** A view of the scene into part of the canvas. */
export const View = Schema.Struct({
  key: Schema.String,
  camera: Camera,
  rect: Schema.Struct({
    x: Schema.Finite,
    y: Schema.Finite,
    width: Schema.Finite.check(Schema.isGreaterThan(0)),
    height: Schema.Finite.check(Schema.isGreaterThan(0)),
  }),
});

/** A scene rendered into a texture lent under `id`. */
export const RenderTexture = Schema.Struct({
  id: Schema.String,
  width: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 8192 })),
  height: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 8192 })),
  camera: Camera,
  background: Schema.NullOr(Rgb),
  children: Schema.Array(SceneNode),
});

/** A complete scene description. */
/** A point to show HTML at. */
export const Overlay = Schema.Struct({
  key: Schema.String,
  node: Schema.NullOr(Schema.String),
  position: Vec3,
  center: Schema.Boolean,
  distanceFactor: Schema.NullOr(Positive),
  occlude: Schema.Boolean,
  zIndexRange: Schema.Tuple([Schema.Int, Schema.Int]),
  view: Schema.NullOr(Schema.String),
});

/** Image-based lighting and background. */
export const Environment = Schema.Struct({
  map: Schema.NullOr(Schema.String),
  background: Schema.Union([Schema.Boolean, Schema.Literal('only')]),
  backgroundBlurriness: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  backgroundIntensity: NonNegative,
  environmentIntensity: NonNegative,
});

/** A daylight sky. */
export const Sky = Schema.Struct({
  sunPosition: Vec3,
  turbidity: NonNegative,
  rayleigh: NonNegative,
  mieCoefficient: NonNegative,
  mieDirectionalG: UnitInterval,
  clouds: UnitInterval,
  distance: Positive,
});

/** Soft ground shadows. */
export const ContactShadows = Schema.Struct({
  position: Vec3,
  size: Schema.Tuple([Positive, Positive]),
  near: Schema.Finite,
  far: Positive,
  blur: NonNegative,
  smooth: Schema.Boolean,
  opacity: UnitInterval,
  color: Rgb,
  resolution: Schema.Int.check(Schema.isBetween({ minimum: 16, maximum: 4096 })),
});

/** Immersive presentation. */
export const Xr = Schema.Struct({
  origin: Vec3,
  heading: Schema.Finite,
  referenceSpace: Schema.Literals(['local-floor', 'local', 'bounded-floor']),
  framebufferScale: Positive,
  hitTest: Schema.Boolean,
  showInputs: Schema.Boolean,
});

/** Whether the scene claims the pointer's gestures from the page. */
export const Gestures = Schema.Literals(['page', 'scene']);

export const SceneDescription = Schema.Struct({
  camera: Camera,
  gestures: Gestures,
  views: Schema.Array(View),
  renderTextures: Schema.Array(RenderTexture),
  overlays: Schema.Array(Overlay),
  environment: Schema.NullOr(Environment),
  sky: Schema.NullOr(Sky),
  contactShadows: Schema.NullOr(ContactShadows),
  physics: Schema.NullOr(Physics),
  xr: Schema.NullOr(Xr),
  measure: Schema.Array(Schema.String),
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
  instance: Schema.optionalKey(Schema.String),
  part: Schema.optionalKey(Schema.String),
  view: Schema.optionalKey(Schema.String),
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

/** Detail of performance changes: the fps average and the new factor (0 to 1). */
export const PerformanceDetail = Schema.Struct({
  fps: Schema.Finite,
  factor: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
});

/** Modifier keys held during an input. */
export const Modifiers = Schema.Struct({
  shift: Schema.Boolean,
  control: Schema.Boolean,
  meta: Schema.Boolean,
  alt: Schema.Boolean,
});

const regionFields = {
  view: Schema.optionalKey(Schema.String),
  width: Schema.Finite,
  height: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
};

/** A drag, wheel or pinch on the canvas: distances in CSS pixels since the last one. */
export const Gesture = Schema.Union([
  Schema.TaggedStruct('Drag', {
    button: Schema.Int,
    modifiers: Modifiers,
    key: Schema.optionalKey(Schema.String),
    ...regionFields,
    deltaX: Schema.Finite,
    deltaY: Schema.Finite,
  }),
  Schema.TaggedStruct('Wheel', {
    modifiers: Modifiers,
    ...regionFields,
    deltaX: Schema.Finite,
    deltaY: Schema.Finite,
  }),
  Schema.TaggedStruct('Pinch', {
    ...regionFields,
    scale: Schema.Finite,
    deltaX: Schema.Finite,
    deltaY: Schema.Finite,
  }),
]);

/**
 * Detail of collision events: the two bodies' keys (and instances', for bodies on
 * instances), and whether they began touching.
 */
export const CollisionDetail = Schema.Struct({
  a: Schema.String,
  aInstance: Schema.optionalKey(Schema.String),
  b: Schema.String,
  bInstance: Schema.optionalKey(Schema.String),
  started: Schema.Boolean,
});

const XrHand = Schema.Literals(['left', 'right', 'none']);

/** Detail of XR stick events: a thumbstick pushed past halfway, or let back. */
export const XrStickDetail = Schema.Struct({
  hand: XrHand,
  direction: Schema.Literals(['center', 'left', 'right', 'forward', 'back']),
});

/** Detail of XR button events: a controller button pressed or released. */
export const XrButtonDetail = Schema.Struct({
  hand: XrHand,
  button: Schema.Literals(['trigger', 'squeeze', 'touchpad', 'thumbstick', 'primary', 'secondary']),
  pressed: Schema.Boolean,
});

/** Detail of XR surface events: in AR, where a select met a real surface. */
export const XrSurfaceDetail = Schema.Struct({ hand: XrHand, point: Vec3, normal: Vec3 });

/** Detail of contact force events: the two bodies, and how hard they pushed. */
export const ContactForceDetail = Schema.Struct({
  a: Schema.String,
  aInstance: Schema.optionalKey(Schema.String),
  b: Schema.String,
  bInstance: Schema.optionalKey(Schema.String),
  totalForce: Vec3,
  totalForceMagnitude: Schema.Finite,
  maxForceDirection: Vec3,
  maxForceMagnitude: Schema.Finite,
});

/** Detail of measured events: a node's world bounding box. */
export const MeasuredDetail = Schema.Struct({ key: Schema.String, min: Vec3, max: Vec3 });

/** Detail of gesture events. */
export const GestureDetail = Schema.Struct({ gesture: Gesture });

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
  Schema.TaggedStruct('Gesture', GestureDetail.fields),
  Schema.TaggedStruct('Collision', CollisionDetail.fields),
  Schema.TaggedStruct('Measured', MeasuredDetail.fields),
  Schema.TaggedStruct('ContactForce', ContactForceDetail.fields),
  Schema.TaggedStruct('XrStick', XrStickDetail.fields),
  Schema.TaggedStruct('XrButton', XrButtonDetail.fields),
  Schema.TaggedStruct('XrSurface', XrSurfaceDetail.fields),
  Schema.TaggedStruct('PerformanceChanged', PerformanceDetail.fields),
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
  Schema.TaggedStruct('DuplicateInstanceKey', { nodeKey: Schema.String, key: Schema.String }),
  Schema.TaggedStruct('UnknownBehaviour', { nodeKey: Schema.String, name: Schema.String }),
  Schema.TaggedStruct('DuplicateViewKey', { key: Schema.String }),
  Schema.TaggedStruct('DuplicateOverlayKey', { key: Schema.String }),
  Schema.TaggedStruct('UnknownOverlayNode', { key: Schema.String, node: Schema.String }),
  Schema.TaggedStruct('UnknownOverlayView', { key: Schema.String, view: Schema.String }),
  Schema.TaggedStruct('UnknownMeasuredNode', { key: Schema.String }),
  Schema.TaggedStruct('DuplicateJointKey', { key: Schema.String }),
  Schema.TaggedStruct('UnknownJointBody', { joint: Schema.String, body: Schema.String }),
  Schema.TaggedStruct('DuplicateRenderTextureId', { id: Schema.String }),
]);
