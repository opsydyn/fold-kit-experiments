/** Scoped browser scene hosting for UI runtimes. */
export { makeEnvironment, type Environment } from './environment.ts';
export { mountSceneHost } from './sceneHost.ts';
export { sceneEventSchemas, ReconciledDetail } from './sceneEvents.ts';
export { webglRendererFactory } from './dom/webgl.ts';
export { webgpuRendererFactory } from './dom/webgpu.ts';
export { overlayData } from './dom/overlays.ts';
export * as BoxSelect from './controllers/boxSelect.ts';
export * as MeasuringTape from './controllers/measuringTape.ts';
export * as PivotControls from './controllers/pivotControls.ts';
export * as TransformGizmo from './controllers/transformGizmo.ts';
export * as ViewportGizmo from './controllers/viewportGizmo.ts';

export { AssetLoadError, type Assets, makeAssets, type ModelInfo } from './assets.ts';
export { animationFrameScheduler, type AnimationFrameHost } from './dom/animationFrames.ts';
export { sceneErrorDispatch } from './dom/canvas.ts';
export {
  capturesPointer,
  claimsContextMenu,
  type Rect,
  toNdc,
  toPointerInput,
} from './dom/pointer.ts';
export { summarise } from './dom/reconciled.ts';
export { threeRendererOf } from './dom/renderSettings.ts';
export { defaultPixelRatio, type PixelRatio, resolvePixelRatio } from './dom/viewport.ts';
export type { WebGLOptions } from './dom/webgl.ts';
export type { WebGPUOptions } from './dom/webgpu.ts';
export type { XrMode } from './dom/xrHub.ts';
export type { EnvironmentHost, EnvironmentOptions } from './environment.ts';
export { domEventName, SceneError, XrSessionDetail } from './sceneEvents.ts';
export { type XrControls, XrUnavailable } from './xr.ts';
