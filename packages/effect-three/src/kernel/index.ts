/**
 * The non-Effect kernel (ADR-003): descriptions, keyed diff, applier, behaviours and
 * resource ownership. Synchronous, allocation-conscious and DOM-free.
 *
 * @module
 */
export type * from './description.ts';
export { clipRunning, clipTime } from './animation.ts';
export {
  type Behaviour,
  type BehaviourPose,
  builtinBehaviours,
  createPose,
  float,
  resetPose,
} from './motion.ts';
export { spinAngle, writeRotation } from './behaviours.ts';
export { buildMaterial, type HostMaterial, type Textures, updateMaterial } from './materials.ts';
export { capacityFor, type HostInstances } from './instances.ts';
export {
  createPerformanceMonitor,
  type PerformanceChange,
  type PerformanceMonitor,
  type PerformanceOptions,
} from './performance.ts';
export { applyTween, easeProgress, startTween, type Tween } from './tween.ts';
export {
  ambientLight,
  basic,
  behave,
  bloom,
  borrowed,
  box,
  capsule,
  body,
  circle,
  physics,
  contactShadows,
  grid,
  sky,
  sunPositionFromAngles,
  environment,
  text,
  cone,
  cylinder,
  directionalLight,
  ease,
  film,
  fixed,
  group,
  hemisphereLight,
  instance,
  instances,
  instant,
  lambert,
  mesh,
  normalMaterial,
  shadowMaterial,
  orthographicCamera,
  perspectiveCamera,
  phong,
  play,
  physical,
  plane,
  pointLight,
  renderSettings,
  ring,
  scene,
  sharedGeometry,
  sharedMaterial,
  sphere,
  spin,
  spotLight,
  standard,
  overlay,
  renderTexture,
  torus,
  type TransformOptions,
  view,
  vignette,
} from './build.ts';
export { changedFields, diff, type DiffResult, type Field, type Op } from './diff.ts';
export {
  cameraEquals,
  animationEquals,
  behaviourEquals,
  effectsEqual,
  geometryRefEquals,
  instanceEquals,
  instancesEqual,
  materialRefEquals,
  resourcesEqual,
  renderSettingsEquals,
  rotationEquals,
  shapeEquals,
  transitionEquals,
  environmentEquals,
  contactShadowsEquals,
  bodyEquals,
  overlaysEqual,
  physicsEquals,
  skyEquals,
  viewsEqual,
  vec3Equals,
} from './equality.ts';
export {
  createResourceStore,
  type GeometryReplaced,
  type Loan,
  type MaterialReplaced,
  type ResourceCounts,
  type ResourceStats,
  type ResourceStore,
} from './resources.ts';
export { createSceneClock, type SceneClock } from './clock.ts';
export {
  createFramePacer,
  createGatedFrames,
  type FrameControl,
  type FramePacer,
  createManualFrames,
  type FrameScheduler,
  type GatedFrames,
  type ManualFrames,
} from './frames.ts';
export {
  defaultOrbit,
  dollyCamera,
  orbit,
  type OrbitOptions,
  orbitOptions,
  panCamera,
  rotateCamera,
} from './orbit.ts';
export { type OverlayPlacement, placeOverlays } from './overlays.ts';
export {
  type BodyPose,
  type ColliderShape,
  colliderFor,
  type Collision,
  type PhysicsEngine,
  type PhysicsWorld,
  type Quat,
} from './physics.ts';
export { type Stage, stage, type StageLighting, type StagePreset, stagePresets } from './stage.ts';
export { createSceneLoop, type SceneLoop, type SceneLoopOptions } from './loop.ts';
export {
  createPicker,
  createPointerTracker,
  type Gesture,
  type Hit,
  type Modifiers,
  noModifiers,
  type Picker,
  type PlaneEquation,
  pointOnPlane,
  type PointerInput,
  type PointerTracker,
  type Ray,
  type Region,
  type SceneEvent,
} from './pointer.ts';
export {
  recordingRendererFactory,
  type RecordingRenderer,
  type RenderArea,
  type RenderTarget,
  type RecordingRendererFactory,
  type RendererFactory,
  type RendererMemory,
  type SceneRenderer,
  type Viewport,
} from './renderer.ts';
export {
  createSceneGraph,
  type HostCamera,
  type HostedTexture,
  type HostedView,
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
