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
export { animationFrameScheduler, type AnimationFrameHost } from './dom/animationFrames.ts';
export { toNdc, toPointerInput } from './dom/pointer.ts';
export { webglRendererFactory, type WebGLOptions } from './dom/webgl.ts';
export { domEventName, SceneError, sceneElement, SceneLifecycle } from './element.ts';
export {
  type Environment,
  type EnvironmentHost,
  type EnvironmentOptions,
  makeEnvironment,
} from './environment.ts';
export { makeSceneMount, type SceneMount } from './mount.ts';
export { type ButtonDetail, type KeyDetail, view, type ViewConfig } from './view.ts';
