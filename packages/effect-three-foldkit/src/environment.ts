/**
 * App-wide state shared by every scene element: one GPU resource store and one
 * animation-frame scheduler. Create it once at the application entry point.
 *
 * @module
 */
import {
  createResourceStore,
  type RendererFactory,
  type ResourceStore,
} from '@opsydyn/effect-three';

import { animationFrameScheduler, type AnimationFrameHost } from './dom/animationFrames.ts';
import { defaultPixelRatio, type PixelRatio } from './dom/viewport.ts';
import { webglRendererFactory } from './dom/webgl.ts';

/** The browser APIs the adapter uses; normally `window`. */
export type EnvironmentHost = AnimationFrameHost & Pick<Window, 'matchMedia' | 'devicePixelRatio'>;

export type EnvironmentOptions = {
  /** Creates each scene's renderer from its canvas. Defaults to WebGL2. */
  readonly renderer?: (canvas: HTMLCanvasElement) => RendererFactory;
  /** Drawing-buffer pixel ratio: fixed, or `[min, max]` around the device's. Default `[1, 2]`. */
  readonly pixelRatio?: PixelRatio;
};

/** Creates the shared environment for `host`. Call `dispose` when the app shuts down. */
export const makeEnvironment = (host: EnvironmentHost, options: EnvironmentOptions = {}) => {
  const store: ResourceStore = createResourceStore();
  return {
    host,
    store,
    frames: animationFrameScheduler(host),
    renderer: options.renderer ?? ((canvas: HTMLCanvasElement) => webglRendererFactory(canvas)),
    pixelRatio: options.pixelRatio ?? defaultPixelRatio,
    /** Disposes every GPU resource still held. */
    dispose: store.dispose,
  };
};

export type Environment = ReturnType<typeof makeEnvironment>;
