/**
 * App-wide state shared by every scene element: one GPU resource store and one
 * animation-frame scheduler. Create it once at the application entry point.
 *
 * @module
 */
import {
  type Behaviour,
  createResourceStore,
  type RendererFactory,
  type ResourceStore,
} from '@opsydyn/effect-three';

import { makeAssets } from './assets.ts';
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
  /** Behaviours scenes may name with `behave(name)`, beside the built-in `float`. */
  readonly behaviours?: Readonly<Record<string, Behaviour>>;
};

/** Creates the shared environment for `host`. Call `dispose` when the app shuts down. */
export const makeEnvironment = (host: EnvironmentHost, options: EnvironmentOptions = {}) => {
  const store: ResourceStore = createResourceStore();
  const assets = makeAssets(store);
  return {
    host,
    store,
    frames: animationFrameScheduler(host),
    renderer: options.renderer ?? ((canvas: HTMLCanvasElement) => webglRendererFactory(canvas)),
    pixelRatio: options.pixelRatio ?? defaultPixelRatio,
    behaviours: options.behaviours ?? {},
    /** Loads textures and glTF models by URL and lends them to the store. */
    assets,
    /** Disposes every loaded asset and every GPU resource still held. */
    dispose: () => {
      assets.dispose();
      store.dispose();
    },
  };
};

export type Environment = ReturnType<typeof makeEnvironment>;
