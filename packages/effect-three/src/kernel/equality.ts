/**
 * Structural equality for description values. Reference equality is checked first, so
 * unchanged subtrees reused between renders cost almost nothing.
 *
 * @module
 */
import type {
  Animation,
  Behave,
  Body,
  BodyRef,
  GeometryRef,
  Instance,
  Joint,
  JointKind,
  JointLimits,
  LabelNode,
  ShaderGridNode,
  MaterialRef,
  Overlay,
  Physics,
  Camera,
  ContactShadows,
  Environment,
  PostEffect,
  RenderSettings,
  ResourceDefinitions,
  Rotation,
  ShapeGeometry,
  Sky,
  Xr,
  TextBevel,
  Transition,
  Vec3,
  View,
} from './description.ts';

/** Component-wise equality using `Object.is`, so `NaN` equals `NaN` and `0` differs from `-0`. */
export const vec3Equals = (a: Vec3, b: Vec3): boolean =>
  a === b || (Object.is(a[0], b[0]) && Object.is(a[1], b[1]) && Object.is(a[2], b[2]));

/** Rotation equality, including behaviour parameters. */
export const rotationEquals = (a: Rotation, b: Rotation): boolean => {
  if (a === b) return true;
  if (a._tag === 'Fixed' && b._tag === 'Fixed') return vec3Equals(a.euler, b.euler);
  if (a._tag === 'Spin' && b._tag === 'Spin') {
    return (
      a.axis === b.axis &&
      Object.is(a.radiansPerSecond, b.radiansPerSecond) &&
      Object.is(a.phase, b.phase)
    );
  }
  return false;
};

/** Shape equality: same kind and same parameters. */
export const shapeEquals = (a: ShapeGeometry, b: ShapeGeometry): boolean => {
  if (a === b) return true;
  switch (a._tag) {
    case 'Box':
      return (
        b._tag === 'Box' &&
        Object.is(a.width, b.width) &&
        Object.is(a.height, b.height) &&
        Object.is(a.depth, b.depth)
      );
    case 'Sphere':
      return (
        b._tag === 'Sphere' &&
        Object.is(a.radius, b.radius) &&
        a.widthSegments === b.widthSegments &&
        a.heightSegments === b.heightSegments
      );
    case 'Plane':
      return b._tag === 'Plane' && Object.is(a.width, b.width) && Object.is(a.height, b.height);
    case 'Cylinder':
      return (
        b._tag === 'Cylinder' &&
        Object.is(a.radiusTop, b.radiusTop) &&
        Object.is(a.radiusBottom, b.radiusBottom) &&
        Object.is(a.height, b.height) &&
        a.radialSegments === b.radialSegments
      );
    case 'Torus':
      return (
        b._tag === 'Torus' &&
        Object.is(a.radius, b.radius) &&
        Object.is(a.tube, b.tube) &&
        a.radialSegments === b.radialSegments &&
        a.tubularSegments === b.tubularSegments
      );
    case 'Cone':
      return (
        b._tag === 'Cone' &&
        Object.is(a.radius, b.radius) &&
        Object.is(a.height, b.height) &&
        a.radialSegments === b.radialSegments
      );
    case 'Capsule':
      return (
        b._tag === 'Capsule' &&
        Object.is(a.radius, b.radius) &&
        Object.is(a.height, b.height) &&
        a.capSegments === b.capSegments &&
        a.radialSegments === b.radialSegments
      );
    case 'Ring':
      return (
        b._tag === 'Ring' &&
        Object.is(a.innerRadius, b.innerRadius) &&
        Object.is(a.outerRadius, b.outerRadius) &&
        a.thetaSegments === b.thetaSegments
      );
    case 'Circle':
      return b._tag === 'Circle' && Object.is(a.radius, b.radius) && a.segments === b.segments;
    case 'Text':
      return (
        b._tag === 'Text' &&
        a.text === b.text &&
        a.font === b.font &&
        Object.is(a.size, b.size) &&
        Object.is(a.depth, b.depth) &&
        a.curveSegments === b.curveSegments &&
        a.center === b.center &&
        Object.is(a.letterSpacing, b.letterSpacing) &&
        Object.is(a.lineHeight, b.lineHeight) &&
        a.align === b.align &&
        bevelEquals(a.bevel, b.bevel)
      );
  }
};

const bevelEquals = (a: TextBevel | null, b: TextBevel | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    Object.is(a.thickness, b.thickness) &&
    Object.is(a.size, b.size) &&
    Object.is(a.offset, b.offset) &&
    a.segments === b.segments);

/** Geometry reference equality: same ownership mode and same shape or id. */
export const geometryRefEquals = (a: GeometryRef, b: GeometryRef): boolean => {
  if (a === b) return true;
  if (a._tag === 'SharedGeometry' || b._tag === 'SharedGeometry') {
    return a._tag === 'SharedGeometry' && b._tag === 'SharedGeometry' && a.id === b.id;
  }
  return shapeEquals(a, b);
};

/** Instance equality: same key, placement and colour. */
export const instanceEquals = (a: Instance, b: Instance): boolean =>
  a === b ||
  (a.key === b.key &&
    Object.is(a.color, b.color) &&
    vec3Equals(a.position, b.position) &&
    vec3Equals(a.rotation, b.rotation) &&
    vec3Equals(a.scale, b.scale));

/** Instance list equality, slot by slot. */
export const instancesEqual = (a: ReadonlyArray<Instance>, b: ReadonlyArray<Instance>): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined || !instanceEquals(x, y)) return false;
  }
  return true;
};

/** Behaviour equality: both none, or the same name and parameters. */
export const behaviourEquals = (a: Behave | null, b: Behave | null): boolean =>
  a === b || (a !== null && b !== null && a.name === b.name && sameFlatRecord(a.params, b.params));

/** Animation equality: both none, or the same clip, speed and looping. */
export const animationEquals = (a: Animation | null, b: Animation | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.clip === b.clip &&
    Object.is(a.speed, b.speed) &&
    a.loop === b.loop);

/** Transition equality. */
export const transitionEquals = (a: Transition, b: Transition): boolean => {
  if (a === b) return true;
  if (a._tag === 'Instant' || b._tag === 'Instant') return a._tag === b._tag;
  return Object.is(a.seconds, b.seconds) && a.easing === b.easing;
};

/**
 * Equality of two flat description records: same keys, each value `Object.is`-equal.
 * Material descriptions are flat (numbers, booleans and string literals), so this is
 * exact for them and needs no per-kind code.
 */
const sameFlatRecord = (a: object, b: object): boolean => {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    if (!Object.is(Reflect.get(a, key), Reflect.get(b, key))) return false;
  }
  return true;
};

/** Material reference equality: same ownership mode and same kind and parameters, or id. */
export const materialRefEquals = (a: MaterialRef, b: MaterialRef): boolean => {
  if (a === b) return true;
  if (a._tag === 'SharedMaterial' || b._tag === 'SharedMaterial') {
    return a._tag === 'SharedMaterial' && b._tag === 'SharedMaterial' && a.id === b.id;
  }
  return sameFlatRecord(a, b);
};

/** Camera equality: same kind, same lens and same placement. */
export const cameraEquals = (a: Camera, b: Camera): boolean => {
  if (a === b) return true;
  const sameLens =
    (a._tag === 'Perspective' && b._tag === 'Perspective' && Object.is(a.fov, b.fov)) ||
    (a._tag === 'Orthographic' && b._tag === 'Orthographic' && Object.is(a.zoom, b.zoom));
  return (
    sameLens &&
    Object.is(a.near, b.near) &&
    Object.is(a.far, b.far) &&
    Object.is(a.damping, b.damping) &&
    vec3Equals(a.position, b.position) &&
    vec3Equals(a.lookAt, b.lookAt)
  );
};

/** Render settings equality. */
export const renderSettingsEquals = (a: RenderSettings, b: RenderSettings): boolean =>
  a === b ||
  (a.frames === b.frames &&
    Object.is(a.resolution, b.resolution) &&
    a.shadows === b.shadows &&
    a.toneMapping === b.toneMapping &&
    Object.is(a.exposure, b.exposure) &&
    a.colorSpace === b.colorSpace &&
    effectsEqual(a.effects, b.effects));

/** Post-processing equality: the same effects, in order, with the same parameters. */
export const effectsEqual = (
  a: ReadonlyArray<PostEffect>,
  b: ReadonlyArray<PostEffect>,
): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined || !sameFlatRecord(x, y)) return false;
  }
  return true;
};

/** View list equality: the same views, in order, with equal cameras and rects. */
export const viewsEqual = (a: ReadonlyArray<View>, b: ReadonlyArray<View>): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined) return false;
    if (x.key !== y.key || !cameraEquals(x.camera, y.camera) || !sameFlatRecord(x.rect, y.rect)) {
      return false;
    }
  }
  return true;
};

/** Order-sensitive equality of shared resource definitions. */
export const resourcesEqual = (a: ResourceDefinitions, b: ResourceDefinitions): boolean => {
  if (a === b) return true;
  if (a.geometries.length !== b.geometries.length) return false;
  if (a.materials.length !== b.materials.length) return false;
  for (let i = 0; i < a.geometries.length; i++) {
    const x = a.geometries[i];
    const y = b.geometries[i];
    if (x === undefined || y === undefined) return false;
    if (x.id !== y.id || !geometryRefEquals(x.geometry, y.geometry)) return false;
  }
  for (let i = 0; i < a.materials.length; i++) {
    const x = a.materials[i];
    const y = b.materials[i];
    if (x === undefined || y === undefined) return false;
    if (x.id !== y.id || !materialRefEquals(x.material, y.material)) return false;
  }
  return true;
};

/** Overlay equality, field by field. */
const overlayEquals = (x: Overlay, y: Overlay): boolean =>
  x.key === y.key &&
  x.node === y.node &&
  vec3Equals(x.position, y.position) &&
  x.center === y.center &&
  Object.is(x.distanceFactor, y.distanceFactor) &&
  x.occlude === y.occlude &&
  x.zIndexRange[0] === y.zIndexRange[0] &&
  x.zIndexRange[1] === y.zIndexRange[1] &&
  x.view === y.view;

/** Overlay list equality: the same overlays, in order, with equal fields. */
export const overlaysEqual = (a: ReadonlyArray<Overlay>, b: ReadonlyArray<Overlay>): boolean =>
  a === b ||
  (a.length === b.length && a.every((x, i) => b[i] !== undefined && overlayEquals(x, b[i])));

/** Environment equality. */
export const environmentEquals = (a: Environment | null, b: Environment | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.map === b.map &&
    a.background === b.background &&
    Object.is(a.backgroundBlurriness, b.backgroundBlurriness) &&
    Object.is(a.backgroundIntensity, b.backgroundIntensity) &&
    Object.is(a.environmentIntensity, b.environmentIntensity));

/** Sky equality. */
export const skyEquals = (a: Sky | null, b: Sky | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    vec3Equals(a.sunPosition, b.sunPosition) &&
    Object.is(a.turbidity, b.turbidity) &&
    Object.is(a.rayleigh, b.rayleigh) &&
    Object.is(a.mieCoefficient, b.mieCoefficient) &&
    Object.is(a.mieDirectionalG, b.mieDirectionalG) &&
    Object.is(a.clouds, b.clouds) &&
    Object.is(a.distance, b.distance));

/** Contact shadow equality. */
export const contactShadowsEquals = (a: ContactShadows | null, b: ContactShadows | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    vec3Equals(a.position, b.position) &&
    a.size[0] === b.size[0] &&
    a.size[1] === b.size[1] &&
    Object.is(a.near, b.near) &&
    Object.is(a.far, b.far) &&
    Object.is(a.blur, b.blur) &&
    a.smooth === b.smooth &&
    Object.is(a.opacity, b.opacity) &&
    a.color === b.color &&
    a.resolution === b.resolution);

/** Body equality, field by field. */
export const bodyEquals = (a: Body | null, b: Body | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.type === b.type &&
    a.collider === b.collider &&
    Object.is(a.mass, b.mass) &&
    Object.is(a.friction, b.friction) &&
    Object.is(a.restitution, b.restitution) &&
    Object.is(a.linearDamping, b.linearDamping) &&
    Object.is(a.angularDamping, b.angularDamping) &&
    Object.is(a.gravityScale, b.gravityScale) &&
    a.ccd === b.ccd &&
    a.sensor === b.sensor &&
    vec3Equals(a.linearVelocity, b.linearVelocity) &&
    vec3Equals(a.angularVelocity, b.angularVelocity) &&
    (a.impulse === b.impulse ||
      (a.impulse !== null &&
        b.impulse !== null &&
        a.impulse.id === b.impulse.id &&
        vec3Equals(a.impulse.impulse, b.impulse.impulse))));

const limitsEqual = (a: JointLimits | null, b: JointLimits | null): boolean =>
  a === b || (a !== null && b !== null && Object.is(a[0], b[0]) && Object.is(a[1], b[1]));

/** Joint kind equality. */
const jointKindEquals = (a: JointKind, b: JointKind): boolean => {
  switch (a._tag) {
    case 'Fixed':
      return b._tag === 'Fixed' && vec3Equals(a.frameA, b.frameA) && vec3Equals(a.frameB, b.frameB);
    case 'Spherical':
      return b._tag === 'Spherical';
    case 'Revolute':
    case 'Prismatic':
      return b._tag === a._tag && vec3Equals(a.axis, b.axis) && limitsEqual(a.limits, b.limits);
    case 'Rope':
      return b._tag === 'Rope' && Object.is(a.length, b.length);
    case 'Spring':
      return (
        b._tag === 'Spring' &&
        Object.is(a.restLength, b.restLength) &&
        Object.is(a.stiffness, b.stiffness) &&
        Object.is(a.damping, b.damping)
      );
  }
};

const refEquals = (a: BodyRef, b: BodyRef): boolean => a.key === b.key && a.instance === b.instance;

/** Joint equality. */
export const jointEquals = (a: Joint, b: Joint): boolean =>
  a === b ||
  (a.key === b.key &&
    refEquals(a.a, b.a) &&
    refEquals(a.b, b.b) &&
    vec3Equals(a.anchorA, b.anchorA) &&
    vec3Equals(a.anchorB, b.anchorB) &&
    jointKindEquals(a.kind, b.kind) &&
    a.contacts === b.contacts);

const jointsEqual = (a: ReadonlyArray<Joint>, b: ReadonlyArray<Joint>): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined || !jointEquals(x, y)) return false;
  }
  return true;
};

/** Label text and type settings equality: everything but the transform and picking. */
export const labelTypeEquals = (a: LabelNode, b: LabelNode): boolean =>
  a.text === b.text &&
  a.font === b.font &&
  Object.is(a.fontSize, b.fontSize) &&
  a.color === b.color &&
  Object.is(a.fillOpacity, b.fillOpacity) &&
  Object.is(a.anchorX, b.anchorX) &&
  Object.is(a.anchorY, b.anchorY) &&
  Object.is(a.maxWidth, b.maxWidth) &&
  Object.is(a.lineHeight, b.lineHeight) &&
  Object.is(a.letterSpacing, b.letterSpacing) &&
  a.textAlign === b.textAlign &&
  Object.is(a.outlineWidth, b.outlineWidth) &&
  a.outlineColor === b.outlineColor &&
  Object.is(a.outlineOpacity, b.outlineOpacity) &&
  Object.is(a.outlineBlur, b.outlineBlur);

/** Shader grid equality, apart from its position and rotation. */
export const shaderGridLookEquals = (a: ShaderGridNode, b: ShaderGridNode): boolean =>
  Object.is(a.size[0], b.size[0]) &&
  Object.is(a.size[1], b.size[1]) &&
  Object.is(a.cellSize, b.cellSize) &&
  Object.is(a.cellThickness, b.cellThickness) &&
  a.cellColor === b.cellColor &&
  Object.is(a.sectionSize, b.sectionSize) &&
  Object.is(a.sectionThickness, b.sectionThickness) &&
  a.sectionColor === b.sectionColor &&
  a.infinite === b.infinite &&
  a.followCamera === b.followCamera &&
  Object.is(a.fadeDistance, b.fadeDistance) &&
  Object.is(a.fadeStrength, b.fadeStrength) &&
  Object.is(a.fadeFrom, b.fadeFrom) &&
  a.side === b.side;

/** Physics world equality. */
export const physicsEquals = (a: Physics | null, b: Physics | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    vec3Equals(a.gravity, b.gravity) &&
    a.paused === b.paused &&
    Object.is(a.timeStep, b.timeStep) &&
    a.interpolate === b.interpolate &&
    jointsEqual(a.joints, b.joints));

/** Immersive presentation equality. */
export const xrEquals = (a: Xr | null, b: Xr | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    vec3Equals(a.origin, b.origin) &&
    Object.is(a.heading, b.heading) &&
    a.referenceSpace === b.referenceSpace &&
    Object.is(a.framebufferScale, b.framebufferScale) &&
    a.hitTest === b.hitTest &&
    a.showInputs === b.showInputs);
