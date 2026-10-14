/**
 * The non-Effect kernel (ADR-003): descriptions, keyed diff, applier, behaviours and
 * resource ownership. Synchronous, allocation-conscious and DOM-free.
 *
 * @module
 */
export type * from './description.ts';
export { spinAngle, writeRotation } from './behaviours.ts';
export {
  ambientLight,
  box,
  directionalLight,
  fixed,
  group,
  mesh,
  perspectiveCamera,
  scene,
  sharedGeometry,
  sharedMaterial,
  spin,
  standard,
} from './build.ts';
export { changedFields, diff, type DiffResult, type Field, type Op } from './diff.ts';
export {
  cameraEquals,
  geometryRefEquals,
  materialRefEquals,
  resourcesEqual,
  rotationEquals,
  vec3Equals,
} from './equality.ts';
export {
  createResourceStore,
  type GeometryReplaced,
  type ResourceCounts,
  type ResourceStats,
  type ResourceStore,
} from './resources.ts';
export {
  createSceneGraph,
  type HostMesh,
  type ReconcileResult,
  type SceneGraph,
  type SceneGraphOptions,
} from './sceneGraph.ts';
export {
  type DescriptionError,
  emptyIndex,
  type IndexedNode,
  indexScene,
  type IndexResult,
  type ParentKey,
  type SceneIndex,
} from './sceneIndex.ts';
