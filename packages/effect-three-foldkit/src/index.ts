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
} from './element.ts';
export { summarise } from './dom/reconciled.ts';
export {
  type Environment,
  type EnvironmentHost,
  type EnvironmentOptions,
  makeEnvironment,
} from './environment.ts';
export { makeSceneMount, type SceneMount } from './mount.ts';
export {
  type ButtonDetail,
  type DragDetail,
  type Gesture,
  type HitDetail,
  type KeyDetail,
  type MissDetail,
  type PerformanceDetail,
  view,
  type ViewConfig,
  type WheelDetail,
} from './view.ts';
