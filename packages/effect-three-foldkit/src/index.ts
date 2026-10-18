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
export { AssetLoadError, type Assets, makeAssets, type ModelInfo } from './assets.ts';
export { animationFrameScheduler, type AnimationFrameHost } from './dom/animationFrames.ts';
export {
  capturesPointer,
  claimsContextMenu,
  type Rect,
  toNdc,
  toPointerInput,
} from './dom/pointer.ts';
export { defaultPixelRatio, type PixelRatio, resolvePixelRatio } from './dom/viewport.ts';
export { webglRendererFactory, type WebGLOptions } from './dom/webgl.ts';
export {
  domEventName,
  ReconciledDetail,
  SceneError,
  sceneElement,
  SceneLifecycle,
  XrSessionDetail,
} from './element.ts';
export { type XrMode } from './dom/xrHub.ts';
export { type XrControls, XrUnavailable } from './xr.ts';
export { summarise } from './dom/reconciled.ts';
export {
  type Environment,
  type EnvironmentHost,
  type EnvironmentOptions,
  makeEnvironment,
} from './environment.ts';
export { makeSceneMount, type SceneMount } from './mount.ts';
export { type OverlayView } from './overlayView.ts';
export {
  type ButtonDetail,
  type CollisionDetail,
  type ContactForceDetail,
  type DragDetail,
  type Gesture,
  type HitDetail,
  type KeyDetail,
  type MeasuredDetail,
  type MissDetail,
  type PerformanceDetail,
  view,
  type ViewConfig,
  type WheelDetail,
  type XrButtonDetail,
  type XrStickDetail,
  type XrSurfaceDetail,
} from './view.ts';
