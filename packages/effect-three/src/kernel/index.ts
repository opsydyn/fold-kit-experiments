/**
 * The non-Effect kernel (ADR-003): descriptions, keyed diff, applier, behaviours and
 * resource ownership. Synchronous, allocation-conscious and DOM-free.
 *
 * @module
 */
export type * from './description.ts';
export { spinAngle, writeRotation } from './behaviours.ts';
export { buildMaterial, type HostMaterial, updateMaterial } from './materials.ts';
export { applyTween, easeProgress, startTween, type Tween } from './tween.ts';
export {
  ambientLight,
  basic,
  box,
  capsule,
  circle,
  cone,
  cylinder,
  directionalLight,
  ease,
  fixed,
  group,
  hemisphereLight,
  instant,
  lambert,
  mesh,
  normalMaterial,
  orthographicCamera,
  perspectiveCamera,
  phong,
  physical,
  plane,
  pointLight,
  ring,
  scene,
  sharedGeometry,
  sharedMaterial,
  sphere,
  spin,
  spotLight,
  standard,
  torus,
  type TransformOptions,
} from './build.ts';
export { changedFields, diff, type DiffResult, type Field, type Op } from './diff.ts';
export {
  cameraEquals,
  geometryRefEquals,
  materialRefEquals,
  resourcesEqual,
  rotationEquals,
  shapeEquals,
  transitionEquals,
  vec3Equals,
} from './equality.ts';
export {
  createResourceStore,
  type GeometryReplaced,
  type MaterialReplaced,
  type ResourceCounts,
  type ResourceStats,
  type ResourceStore,
} from './resources.ts';
export { createSceneClock, type SceneClock } from './clock.ts';
export {
  createGatedFrames,
  createManualFrames,
  type FrameScheduler,
  type GatedFrames,
  type ManualFrames,
} from './frames.ts';
export { createSceneLoop, type SceneLoop, type SceneLoopOptions } from './loop.ts';
export {
  createPicker,
  createPointerTracker,
  type Hit,
  type Picker,
  type PointerInput,
  type PointerTracker,
  type SceneEvent,
} from './pointer.ts';
export {
  recordingRendererFactory,
  type RecordingRenderer,
  type RecordingRendererFactory,
  type RendererFactory,
  type RendererMemory,
  type SceneRenderer,
  type Viewport,
} from './renderer.ts';
export {
  createSceneGraph,
  type HostCamera,
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
