/**
 * Structural equality for description values. Reference equality is checked first, so
 * unchanged subtrees reused between renders cost almost nothing.
 *
 * @module
 */
import type {
  GeometryRef,
  MaterialRef,
  PerspectiveCamera,
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

/** Transition equality. */
export const transitionEquals = (a: Transition, b: Transition): boolean => {
  if (a === b) return true;
  if (a._tag === 'Instant' || b._tag === 'Instant') return a._tag === b._tag;
  return Object.is(a.seconds, b.seconds) && a.easing === b.easing;
};

/** Material reference equality: same ownership mode and same parameters or id. */
export const materialRefEquals = (a: MaterialRef, b: MaterialRef): boolean => {
  if (a === b) return true;
  if (a._tag === 'Standard' && b._tag === 'Standard') {
    return (
      Object.is(a.color, b.color) &&
      Object.is(a.roughness, b.roughness) &&
      Object.is(a.metalness, b.metalness)
    );
  }
  if (a._tag === 'SharedMaterial' && b._tag === 'SharedMaterial') return a.id === b.id;
  return false;
};

/** Camera equality. */
export const cameraEquals = (a: PerspectiveCamera, b: PerspectiveCamera): boolean =>
  a === b ||
  (Object.is(a.fov, b.fov) &&
    Object.is(a.near, b.near) &&
    Object.is(a.far, b.far) &&
    vec3Equals(a.position, b.position) &&
    vec3Equals(a.lookAt, b.lookAt));

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
