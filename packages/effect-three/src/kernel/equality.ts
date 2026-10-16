/**
 * Structural equality for description values. Reference equality is checked first, so
 * unchanged subtrees reused between renders cost almost nothing.
 *
 * @module
 */
import type {
  Animation,
  GeometryRef,
  Instance,
  MaterialRef,
  Camera,
  RenderSettings,
  ResourceDefinitions,
  Rotation,
  ShapeGeometry,
  Transition,
  Vec3,
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
  }
};

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
    vec3Equals(a.position, b.position) &&
    vec3Equals(a.lookAt, b.lookAt)
  );
};

/** Render settings equality. */
export const renderSettingsEquals = (a: RenderSettings, b: RenderSettings): boolean =>
  a === b || sameFlatRecord(a, b);

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
