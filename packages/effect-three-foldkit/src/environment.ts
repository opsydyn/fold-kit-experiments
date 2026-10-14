/**
 * App-wide state shared by every scene element: one GPU resource store and one
 * animation-frame scheduler. Create it once at the application entry point.
 *
 * @module
 */
import { createResourceStore, type ResourceStore } from '@opsydyn/effect-three';

import { animationFrameScheduler, type AnimationFrameHost } from './dom/animationFrames.ts';

/** The browser APIs the adapter uses; normally `window`. */
export type EnvironmentHost = AnimationFrameHost & Pick<Window, 'matchMedia' | 'devicePixelRatio'>;

/** Creates the shared environment for `host`. Call `dispose` when the app shuts down. */
export const makeEnvironment = (host: EnvironmentHost) => {
  const store: ResourceStore = createResourceStore();
  return {
    host,
    store,
    frames: animationFrameScheduler(host),
    /** Disposes every GPU resource still held. */
    dispose: store.dispose,
  };
};

export type Environment = ReturnType<typeof makeEnvironment>;
