/**
 * Foldkit adapter for `@opsydyn/effect-three`.
 *
 * ```ts
 * // entry.ts: once per app
 * const environment = EffectThreeFoldkit.makeEnvironment(window);
 * export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
 *
 * // view.ts
 * EffectThreeFoldkit.view(
 *   { scene: sceneFor(model), mount: sceneMount, onLifecycle: GotSceneLifecycle, onClick: ClickedNode },
 *   h,
 * );
 * ```
 *
 * @module
 */
export {
  AssetLoadError,
  type Assets,
  makeAssets,
  type ModelInfo,
} from '@opsydyn/effect-three/browser';
export { animationFrameScheduler, type AnimationFrameHost } from '@opsydyn/effect-three/browser';
export {
  capturesPointer,
  claimsContextMenu,
  type Rect,
  toNdc,
  toPointerInput,
} from '@opsydyn/effect-three/browser';
export {
  defaultPixelRatio,
  type PixelRatio,
  resolvePixelRatio,
} from '@opsydyn/effect-three/browser';
export { webglRendererFactory, type WebGLOptions } from '@opsydyn/effect-three/browser';
export { type WebGPUOptions, webgpuRendererFactory } from '@opsydyn/effect-three/browser';
export {
  domEventName,
  ReconciledDetail,
  SceneError,
  sceneElement,
  SceneLifecycle,
  XrSessionDetail,
} from './element.ts';
export { type XrMode } from '@opsydyn/effect-three/browser';
export { type XrControls, XrUnavailable } from '@opsydyn/effect-three/browser';
export { summarise } from '@opsydyn/effect-three/browser';
export {
  type Environment,
  type EnvironmentHost,
  type EnvironmentOptions,
  makeEnvironment,
} from '@opsydyn/effect-three/browser';
export { inspectorView, type OnEdit } from './inspector.ts';
export { makeSceneMount, type SceneMount } from './mount.ts';
export * as BoxSelect from './boxSelect.ts';
export * as MeasuringTape from './measuringTape.ts';
export * as PivotControls from './pivotControls.ts';
export * as TransformGizmo from './transformGizmo.ts';
export * as ViewportGizmo from './viewportGizmo.ts';
export { type OverlayView } from './overlayView.ts';
export {
  type AssetFailedDetail,
  type AssetLoadedDetail,
  type AutoRotatedDetail,
  type ButtonDetail,
  type CollisionDetail,
  type ContactForceDetail,
  type DragDetail,
  type Gesture,
  type GestureEndDetail,
  type HitDetail,
  type KeyDetail,
  type LabelMeasuredDetail,
  type MeasuredDetail,
  type MissDetail,
  type PerformanceDetail,
  type PhysicsReachedDetail,
  view,
  type ViewConfig,
  type WheelDetail,
  type XrButtonDetail,
  type XrMeshesDetail,
  type XrMovedDetail,
  type XrTeleportedDetail,
  type XrPosesDetail,
  type XrPlanesDetail,
  type XrStickDetail,
  type XrSurfaceDetail,
} from './view.ts';
