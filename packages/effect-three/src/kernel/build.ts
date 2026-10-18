/**
 * Constructors that fill in defaults and return fully specified descriptions.
 *
 * @module
 */
import type {
  AmbientLightNode,
  Animation,
  BasicMaterial,
  Body,
  Behave,
  BorrowedNode,
  Axis,
  BoxGeometry,
  Camera,
  ContactShadows,
  Environment,
  Gestures,
  GridNode,
  Sky,
  Xr,
  LabelAlign,
  LabelAnchorX,
  LabelAnchorY,
  LabelColorRange,
  LabelNode,
  MaterialSide,
  ShaderGridNode,
  TextAlign,
  TextBevel,
  TextGeometry,
  Overlay,
  Physics,
  BodyRef,
  Joint,
  JointKind,
  JointLimits,
  JointMotor,
  InteractionGroups,
  ColliderDescription,
  ColliderShapeDescription,
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
  ShadowMaterial,
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
  XrAnchor,
  XrGlide,
  XrSpace,
  Handedness,
  HandJoint,
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

/**
 * Text from the typeface font lent under `font`. Defaults as Drei's `Text3D`: size 1,
 * depth 0.2, 8 curve segments, no bevel (a bevel given defaults to thickness 0.1, size
 * 0.01, offset 0, 4 segments), not centred. Depth 0 draws flat text. Letter spacing (in
 * ems), line height (a multiple of the font's) and alignment default to the font's own
 * layout, left aligned; unlike Drei, where three ignores them, they apply.
 */
export const text = (options: {
  readonly text: string;
  readonly font: string;
  readonly size?: number;
  readonly depth?: number;
  readonly curveSegments?: number;
  readonly bevel?: Partial<TextBevel>;
  readonly center?: boolean;
  readonly letterSpacing?: number;
  readonly lineHeight?: number;
  readonly align?: TextAlign;
}): TextGeometry => ({
  _tag: 'Text',
  text: options.text,
  font: options.font,
  size: options.size ?? 1,
  depth: options.depth ?? 0.2,
  curveSegments: options.curveSegments ?? 8,
  bevel:
    options.bevel === undefined
      ? null
      : {
          thickness: options.bevel.thickness ?? 0.1,
          size: options.bevel.size ?? 0.01,
          offset: options.bevel.offset ?? 0,
          segments: options.bevel.segments ?? 4,
        },
  center: options.center ?? false,
  letterSpacing: options.letterSpacing ?? 0,
  lineHeight: options.lineHeight ?? 1,
  align: options.align ?? 'left',
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

/**
 * A shadow catcher: shows only the shadows cast onto it (three.js's `ShadowMaterial`).
 * Defaults as three.js: black, opacity 1. Needs `render.shadows` and `receiveShadow`.
 */
export const shadowMaterial = (
  options: { readonly color?: Rgb; readonly opacity?: number } = {},
): ShadowMaterial => ({
  _tag: 'Shadow',
  color: options.color ?? 0x000000,
  opacity: options.opacity ?? 1,
});

/**
 * A grid of lines on the XZ plane (three.js's `GridHelper`). Defaults as three.js: 10
 * across, 10 divisions, lines 0x888888 and centre lines 0x444444, at the origin.
 */
export const grid = (options: {
  readonly key: string;
  readonly position?: Vec3;
  readonly size?: number;
  readonly divisions?: number;
  readonly color?: Rgb;
  readonly centerColor?: Rgb;
}): GridNode => ({
  _tag: 'Grid',
  key: options.key,
  position: options.position ?? origin,
  size: options.size ?? 10,
  divisions: options.divisions ?? 10,
  color: options.color ?? 0x888888,
  centerColor: options.centerColor ?? 0x444444,
});

/**
 * Drei's `Grid`, with its defaults: a 1 × 1 plane (pass `size`, or `infinite`), cells 0.5
 * apart in black at thickness 0.5, sections 1 apart in `#2080ff` at thickness 1, fading
 * over 100 units from the camera at strength 1, drawn on the back side.
 */
export const shaderGrid = (options: {
  readonly key: string;
  readonly position?: Vec3;
  readonly rotation?: Vec3;
  readonly size?: readonly [width: number, height: number];
  readonly cellSize?: number;
  readonly cellThickness?: number;
  readonly cellColor?: Rgb;
  readonly sectionSize?: number;
  readonly sectionThickness?: number;
  readonly sectionColor?: Rgb;
  readonly infinite?: boolean;
  readonly followCamera?: boolean;
  readonly fadeDistance?: number;
  readonly fadeStrength?: number;
  readonly fadeFrom?: number;
  readonly side?: MaterialSide;
}): ShaderGridNode => ({
  _tag: 'ShaderGrid',
  key: options.key,
  position: options.position ?? origin,
  rotation: options.rotation ?? origin,
  size: options.size ?? [1, 1],
  cellSize: options.cellSize ?? 0.5,
  cellThickness: options.cellThickness ?? 0.5,
  cellColor: options.cellColor ?? 0x000000,
  sectionSize: options.sectionSize ?? 1,
  sectionThickness: options.sectionThickness ?? 1,
  sectionColor: options.sectionColor ?? 0x2080ff,
  infinite: options.infinite ?? false,
  followCamera: options.followCamera ?? false,
  fadeDistance: options.fadeDistance ?? 100,
  fadeStrength: options.fadeStrength ?? 1,
  fadeFrom: options.fadeFrom ?? 1,
  side: options.side ?? 'back',
});

/** A reference to a shared geometry defined in the scene's resources. */
export const sharedGeometry = (id: string): GeometryRef => ({ _tag: 'SharedGeometry', id });
/** A geometry lent under `id` (`store.lendGeometry`): empty until it is lent. */
export const lentGeometry = (id: string): GeometryRef => ({ _tag: 'LentGeometry', id });

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
    readonly body?: Body | null;
    readonly follow?: XrSpace | null;
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
  body: options.body ?? null,
  follow: options.follow ?? null,
});

/** The head (the viewer), for content that stays in view. */
export const headSpace = (): XrSpace => ({ _tag: 'Head' });

/** A tracked hand's joint (`index-finger-tip`, say). */
export const jointSpace = (hand: Handedness, joint: HandJoint): XrSpace => ({
  _tag: 'Joint',
  hand,
  joint,
});

/** A controller's grip (where it is held) or its pointing ray. */
export const controllerSpace = (hand: Handedness, space: 'grip' | 'ray' = 'grip'): XrSpace => ({
  _tag: 'Controller',
  hand,
  space,
});

/** An anchor the scene placed with `xr({ anchors })`. */
export const anchorSpace = (id: string): XrSpace => ({ _tag: 'Anchor', id });

/** A detected plane, by the id an `XrPlanes` event gave it. */
export const planeSpace = (id: string): XrSpace => ({ _tag: 'Plane', id });
/** A mesh the session detected (`xr({ meshes: true })`), by its id from `XrMeshes`. */
export const meshSpace = (id: string): XrSpace => ({ _tag: 'Mesh', id });

/** The id a detected mesh's geometry is lent under, for `xrMesh` and the adapter. */
export const xrMeshGeometryId = (id: string): string => `xr-mesh/${id}`;

/**
 * A detected mesh's geometry (`xr({ meshes: true })`), in its own space: put it in a
 * group following `meshSpace(id)`. Empty until the session has detected it.
 */
export const xrMesh = (id: string): GeometryRef => lentGeometry(xrMeshGeometryId(id));

/** An anchor at a place in the scene (Euler rotation, unturned by default). */
export const xrAnchor = (options: {
  readonly id: string;
  readonly position: Vec3;
  readonly rotation?: Vec3;
}): XrAnchor => ({
  id: options.id,
  position: options.position,
  rotation: options.rotation ?? origin,
});

/** A mesh. Not interactive unless `interactive` is true. */
export const mesh = (
  options: TransformOptions & {
    readonly geometry: GeometryRef;
    readonly material: MaterialRef;
    readonly interactive?: boolean;
    readonly castShadow?: boolean;
    readonly receiveShadow?: boolean;
    readonly body?: Body | null;
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
  body: options.body ?? null,
});

/**
 * A rigid body for a mesh. Defaults as react-three-rapier's `RigidBody` and Rapier: dynamic,
 * a cuboid collider from the bounding box, density 1, friction 0.5, restitution 0, no
 * damping, gravity scale 1, no CCD, not a sensor, at rest, no impulse.
 */
export const body = (options: Partial<Body> = {}): Body => ({
  type: options.type ?? 'dynamic',
  collider: options.collider ?? 'cuboid',
  mass: options.mass ?? null,
  friction: options.friction ?? 0.5,
  restitution: options.restitution ?? 0,
  linearDamping: options.linearDamping ?? 0,
  angularDamping: options.angularDamping ?? 0,
  gravityScale: options.gravityScale ?? 1,
  ccd: options.ccd ?? false,
  sensor: options.sensor ?? false,
  linearVelocity: options.linearVelocity ?? origin,
  angularVelocity: options.angularVelocity ?? origin,
  impulse: options.impulse ?? null,
  colliders: options.colliders ?? null,
  contactForces: options.contactForces ?? null,
  collisionGroups: options.collisionGroups ?? null,
  solverGroups: options.solverGroups ?? null,
});

/**
 * Collision groups, as react-three-rapier's `interactionGroups(memberships, filters)`:
 * in `memberships` (0 to 15), interacting with `filters` (every group when omitted).
 */
export const interactionGroups = (
  memberships: number | ReadonlyArray<number>,
  filters?: number | ReadonlyArray<number>,
): InteractionGroups => ({
  memberships: typeof memberships === 'number' ? [memberships] : memberships,
  filters: filters === undefined ? null : typeof filters === 'number' ? [filters] : filters,
});

const placedCollider = (
  shape: ColliderShapeDescription,
  options: { readonly position?: Vec3; readonly rotation?: Vec3; readonly name?: string | null },
): ColliderDescription => ({
  shape,
  position: options.position ?? origin,
  rotation: options.rotation ?? origin,
  name: options.name ?? null,
});

/** A box collider, `halfExtents` from its middle, as react-three-rapier's `CuboidCollider`. */
export const cuboidCollider = (options: {
  readonly halfExtents: Vec3;
  readonly position?: Vec3;
  readonly rotation?: Vec3;
  readonly name?: string | null;
}): ColliderDescription =>
  placedCollider({ _tag: 'Cuboid', halfExtents: options.halfExtents }, options);

/** A ball collider, as `BallCollider`. */
export const ballCollider = (options: {
  readonly radius: number;
  readonly position?: Vec3;
  readonly name?: string | null;
}): ColliderDescription => placedCollider({ _tag: 'Ball', radius: options.radius }, options);

type Upright = {
  readonly halfHeight: number;
  readonly radius: number;
  readonly position?: Vec3;
  readonly rotation?: Vec3;
  /** The name collisions report this collider by. */
  readonly name?: string | null;
};

/** A capsule collider along y: `halfHeight` of cylinder, capped by `radius`. */
export const capsuleCollider = (options: Upright): ColliderDescription =>
  placedCollider(
    { _tag: 'Capsule', halfHeight: options.halfHeight, radius: options.radius },
    options,
  );

/** A cylinder collider along y. */
export const cylinderCollider = (options: Upright): ColliderDescription =>
  placedCollider(
    { _tag: 'Cylinder', halfHeight: options.halfHeight, radius: options.radius },
    options,
  );

/** A cone collider along y, its point up. */
export const coneCollider = (options: Upright): ColliderDescription =>
  placedCollider({ _tag: 'Cone', halfHeight: options.halfHeight, radius: options.radius }, options);

/** A motor turning (or sliding) at `velocity`, with `factor` how hard it holds the speed. */
export const velocityMotor = (velocity: number, factor = 1): JointMotor => ({
  position: 0,
  velocity,
  stiffness: 0,
  damping: factor,
});

/** A motor holding `position`, as a spring of `stiffness` damped by `damping`. */
export const positionMotor = (
  position: number,
  stiffness: number,
  damping: number,
): JointMotor => ({
  position,
  velocity: 0,
  stiffness,
  damping,
});

const noJoints: ReadonlyArray<Joint> = [];

/**
 * A physics world. Defaults as react-three-rapier's `Physics`: Earth gravity
 * `[0, -9.81, 0]`, running, fixed steps of 1/60 s, interpolated; no joints.
 */
export const physics = (options: Partial<Physics> = {}): Physics => ({
  gravity: options.gravity ?? [0, -9.81, 0],
  paused: options.paused ?? false,
  timeStep: options.timeStep ?? 1 / 60,
  interpolate: options.interpolate ?? true,
  debug: options.debug ?? false,
  joints: options.joints ?? noJoints,
});

/** A node's body (`instance` omitted), or one instance's of an instances node. */
export const bodyRef = (key: string, instance: string | null = null): BodyRef => ({
  key,
  instance,
});

const refOf = (ref: string | BodyRef): BodyRef => (typeof ref === 'string' ? bodyRef(ref) : ref);

/**
 * A joint between two bodies, named by node key or `bodyRef`. Anchors default to each
 * body's origin; the bodies still collide with each other unless `contacts` is false.
 */
export const joint = (options: {
  readonly key: string;
  readonly a: string | BodyRef;
  readonly b: string | BodyRef;
  readonly anchorA?: Vec3;
  readonly anchorB?: Vec3;
  readonly kind: JointKind;
  readonly contacts?: boolean;
}): Joint => ({
  key: options.key,
  a: refOf(options.a),
  b: refOf(options.b),
  anchorA: options.anchorA ?? origin,
  anchorB: options.anchorB ?? origin,
  kind: options.kind,
  contacts: options.contacts ?? true,
});

/** Holds two bodies still relative to each other. Frames default to unturned. */
export const fixedJoint = (
  options: { readonly frameA?: Vec3; readonly frameB?: Vec3 } = {},
): JointKind => ({
  _tag: 'Fixed',
  frameA: options.frameA ?? origin,
  frameB: options.frameB ?? origin,
});

/** A ball and socket at the anchors. */
export const sphericalJoint = (): JointKind => ({ _tag: 'Spherical' });

/** A hinge about `axis` (each body's own), limited to `limits` radians and driven by `motor` if given. */
export const revoluteJoint = (options: {
  readonly axis: Vec3;
  readonly limits?: JointLimits | null;
  readonly motor?: JointMotor | null;
}): JointKind => ({
  _tag: 'Revolute',
  axis: options.axis,
  limits: options.limits ?? null,
  motor: options.motor ?? null,
});

/** A slider along `axis`, limited to `limits` and driven by `motor` if given. */
export const prismaticJoint = (options: {
  readonly axis: Vec3;
  readonly limits?: JointLimits | null;
  readonly motor?: JointMotor | null;
}): JointKind => ({
  _tag: 'Prismatic',
  axis: options.axis,
  limits: options.limits ?? null,
  motor: options.motor ?? null,
});

/** Keeps the anchors at most `length` apart. */
export const ropeJoint = (length: number): JointKind => ({ _tag: 'Rope', length });

/** Pulls the anchors towards `restLength` apart. */
export const springJoint = (options: {
  readonly restLength: number;
  readonly stiffness: number;
  readonly damping: number;
}): JointKind => ({ _tag: 'Spring', ...options });

const noAnchors: ReadonlyArray<XrAnchor> = [];

/**
 * Gliding with the thumbsticks while presenting. Defaults as pmndrs/xr's
 * `useXRControllerLocomotion`: 2 m/s, a snap turn of 45° (smooth turns at 2 rad/s).
 */
export const glide = (options: Partial<XrGlide> = {}): XrGlide => ({
  speed: options.speed ?? 2,
  turn: options.turn ?? 'snap',
  turnSpeed: options.turnSpeed ?? 2,
  snapDegrees: options.snapDegrees ?? 45,
});

/**
 * Immersive presentation for a scene. Defaults: the player at the scene's origin facing
 * −z, `local-floor` (as pmndrs/xr), the device's framebuffer scale, inputs drawn (rays
 * and hand joints, where pmndrs/xr draws controller and hand models), no AR hit tests.
 */
export const xr = (options: Partial<Xr> = {}): Xr => ({
  origin: options.origin ?? origin,
  heading: options.heading ?? 0,
  referenceSpace: options.referenceSpace ?? 'local-floor',
  framebufferScale: options.framebufferScale ?? 1,
  hitTest: options.hitTest ?? false,
  showInputs: options.showInputs ?? true,
  glide: options.glide ?? null,
  anchors: options.anchors ?? noAnchors,
  planes: options.planes ?? false,
  meshes: options.meshes ?? false,
  domOverlay: options.domOverlay ?? false,
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
    readonly body?: Body | null;
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
  body: options.body ?? null,
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
    readonly body?: Body | null;
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
  body: options.body ?? null,
});

/**
 * Text drawn from distance fields (Drei's `Text`). Defaults as Drei's: size 1, anchored at
 * its centre and middle, troika's default font; white, no outline, left-aligned lines,
 * never wrapped, the font's own line height. Not interactive by default.
 */
const noColorRanges: ReadonlyArray<LabelColorRange> = [];

export const label = (
  options: TransformOptions & {
    readonly text: string;
    readonly font?: string | null;
    readonly fontSize?: number;
    readonly color?: Rgb;
    readonly fillOpacity?: number;
    readonly anchorX?: LabelAnchorX;
    readonly anchorY?: LabelAnchorY;
    readonly maxWidth?: number | null;
    readonly lineHeight?: number | null;
    readonly letterSpacing?: number;
    readonly textAlign?: LabelAlign;
    readonly outlineWidth?: number;
    readonly outlineColor?: Rgb;
    readonly outlineOpacity?: number;
    readonly outlineBlur?: number;
    readonly colorRanges?: ReadonlyArray<LabelColorRange>;
    readonly curveRadius?: number;
    readonly material?: MaterialRef | null;
    readonly interactive?: boolean;
  },
): LabelNode => ({
  _tag: 'Label',
  key: options.key,
  position: options.position ?? origin,
  rotation: options.rotation ?? noRotation,
  scale: options.scale ?? unitScale,
  transition: options.transition ?? instantTransition,
  behaviour: options.behaviour ?? null,
  interactive: options.interactive ?? false,
  text: options.text,
  font: options.font ?? null,
  fontSize: options.fontSize ?? 1,
  color: options.color ?? 0xffffff,
  fillOpacity: options.fillOpacity ?? 1,
  anchorX: options.anchorX ?? 'center',
  anchorY: options.anchorY ?? 'middle',
  maxWidth: options.maxWidth ?? null,
  lineHeight: options.lineHeight ?? null,
  letterSpacing: options.letterSpacing ?? 0,
  textAlign: options.textAlign ?? 'left',
  outlineWidth: options.outlineWidth ?? 0,
  outlineColor: options.outlineColor ?? 0x000000,
  outlineOpacity: options.outlineOpacity ?? 1,
  outlineBlur: options.outlineBlur ?? 0,
  colorRanges: options.colorRanges ?? noColorRanges,
  curveRadius: options.curveRadius ?? 0,
  material: options.material ?? null,
});

/** A run of a label's characters in `color`, from character index `start`. */
export const colorRange = (start: number, color: Rgb): LabelColorRange => ({ start, color });

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

/**
 * Perspective camera. Defaults: fov 50, near 0.1, far 100, at `[0, 0, 5]` looking at the
 * origin, no damping, not turning.
 */
export const perspectiveCamera = (
  options: Partial<Omit<PerspectiveCamera, '_tag'>> = {},
): PerspectiveCamera => ({
  _tag: 'Perspective',
  fov: options.fov ?? 50,
  near: options.near ?? 0.1,
  far: options.far ?? 100,
  position: options.position ?? [0, 0, 5],
  lookAt: options.lookAt ?? origin,
  damping: options.damping ?? 0,
  autoRotate: options.autoRotate ?? 0,
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
  damping: options.damping ?? 0,
  autoRotate: options.autoRotate ?? 0,
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
/**
 * Image-based lighting (Drei's `Environment`). Defaults as Drei: lighting only, no blur,
 * intensities 1. Without `map`, three.js's `RoomEnvironment`; with it, the equirectangular
 * texture lent under that id.
 */
export const environment = (
  options: {
    readonly map?: string;
    readonly background?: boolean | 'only';
    readonly backgroundBlurriness?: number;
    readonly backgroundIntensity?: number;
    readonly environmentIntensity?: number;
  } = {},
): Environment => ({
  map: options.map ?? null,
  background: options.background ?? false,
  backgroundBlurriness: options.backgroundBlurriness ?? 0,
  backgroundIntensity: options.backgroundIntensity ?? 1,
  environmentIntensity: options.environmentIntensity ?? 1,
});

/**
 * Where Drei puts the sun from an inclination and azimuth, both 0 to 1
 * (`calcPosFromAngles` in `src/core/Sky.tsx`).
 */
export const sunPositionFromAngles = (inclination: number, azimuth: number): Vec3 => {
  const theta = Math.PI * (inclination - 0.5);
  const phi = 2 * Math.PI * (azimuth - 0.5);
  return [Math.cos(phi), Math.sin(theta), Math.sin(phi)];
};

/**
 * A daylight sky. Defaults as Drei's `Sky`: the sun from inclination 0.6 and azimuth 0.1,
 * turbidity 10, rayleigh 0.5, mie coefficient 0.005 and directional G 0.8, distance 1000,
 * and no clouds. The sky is high dynamic range: use tone mapping (`aces`, as three.js's
 * example and React Three Fiber's default), or it washes out to white.
 */
export const sky = (options: Partial<Sky> = {}): Sky => ({
  sunPosition: options.sunPosition ?? sunPositionFromAngles(0.6, 0.1),
  turbidity: options.turbidity ?? 10,
  rayleigh: options.rayleigh ?? 0.5,
  mieCoefficient: options.mieCoefficient ?? 0.005,
  mieDirectionalG: options.mieDirectionalG ?? 0.8,
  clouds: options.clouds ?? 0,
  distance: options.distance ?? 1000,
});

/**
 * Soft ground shadows (Drei's `ContactShadows`). Defaults as Drei: a 10 × 10 plane at the
 * origin (Drei's `scale` 10), shadows from 0 to 10 units above, blur 1 with the smooth
 * pass, opacity 1, black, 512 texels.
 */
export const contactShadows = (
  options: {
    readonly position?: Vec3;
    readonly size?: number | readonly [number, number];
    readonly near?: number;
    readonly far?: number;
    readonly blur?: number;
    readonly smooth?: boolean;
    readonly opacity?: number;
    readonly color?: Rgb;
    readonly resolution?: number;
  } = {},
): ContactShadows => {
  const size = options.size ?? 10;
  return {
    position: options.position ?? origin,
    size: typeof size === 'number' ? [size, size] : size,
    near: options.near ?? 0,
    far: options.far ?? 10,
    blur: options.blur ?? 1,
    smooth: options.smooth ?? true,
    opacity: options.opacity ?? 1,
    color: options.color ?? 0x000000,
    resolution: options.resolution ?? 512,
  };
};

const noOverlays: ReadonlyArray<Overlay> = [];
const noMeasures: ReadonlyArray<string> = [];

/** Drei's `zIndexRange` default: near points on top, far ones at 0. */
const defaultZIndexRange: readonly [number, number] = [16777271, 0];

/**
 * A point to show HTML at (Drei's `Html`). Defaults: world space at the origin, not
 * centred, constant size, never occluded, Drei's z-index range, the main camera.
 */
export const overlay = (options: {
  readonly key: string;
  readonly node?: string;
  readonly position?: Vec3;
  readonly center?: boolean;
  readonly distanceFactor?: number;
  readonly occlude?: boolean;
  readonly zIndexRange?: readonly [number, number];
  readonly view?: string;
}): Overlay => ({
  key: options.key,
  node: options.node ?? null,
  position: options.position ?? origin,
  center: options.center ?? false,
  distanceFactor: options.distanceFactor ?? null,
  occlude: options.occlude ?? false,
  zIndexRange: options.zIndexRange ?? defaultZIndexRange,
  view: options.view ?? null,
});

export const scene = (options: {
  readonly camera?: Camera;
  readonly gestures?: Gestures;
  readonly views?: ReadonlyArray<View>;
  readonly renderTextures?: ReadonlyArray<RenderTexture>;
  readonly overlays?: ReadonlyArray<Overlay>;
  /** Optional staging: leave out or pass `null` for none, so a Model can switch it off. */
  readonly environment?: Environment | null;
  readonly sky?: Sky | null;
  readonly contactShadows?: ContactShadows | null;
  readonly physics?: Physics | null;
  readonly xr?: Xr | null;
  readonly measure?: ReadonlyArray<string>;
  readonly render?: RenderSettings;
  readonly resources?: Partial<ResourceDefinitions>;
  readonly children?: ReadonlyArray<SceneNode>;
}): SceneDescription => ({
  camera: options.camera ?? perspectiveCamera(),
  gestures: options.gestures ?? 'page',
  views: options.views ?? noViews,
  renderTextures: options.renderTextures ?? noRenderTextures,
  overlays: options.overlays ?? noOverlays,
  environment: options.environment ?? null,
  sky: options.sky ?? null,
  contactShadows: options.contactShadows ?? null,
  physics: options.physics ?? null,
  xr: options.xr ?? null,
  measure: options.measure ?? noMeasures,
  render: options.render ?? defaultRenderSettings,
  resources: {
    geometries: options.resources?.geometries ?? noResources.geometries,
    materials: options.resources?.materials ?? noResources.materials,
  },
  children: options.children ?? [],
});
