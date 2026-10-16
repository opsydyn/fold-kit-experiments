/**
 * Where frames come from. Wraps a kernel `FrameScheduler` so a scene's per-frame callback
 * is registered for exactly the lifetime of its scope.
 *
 * @module
 */
import { Context, Effect, Layer } from 'effect';

import { createGatedFrames, type FrameControl, type FrameScheduler } from '../kernel/index.ts';

const registration = (scheduler: FrameScheduler, onFrame: () => void) => () => {
  const gate = createGatedFrames(scheduler);
  const unsubscribe = gate.subscribe(onFrame);
  const control: FrameControl = {
    wake: () => gate.setOpen(true),
    sleep: () => gate.setOpen(false),
  };
  return { control, unsubscribe };
};

/** The frame source service for `scheduler`, for providing directly with `provideService`. */
export const fromScheduler = (scheduler: FrameScheduler) => ({
  /**
   * Calls `onFrame` once per frame until the current scope closes, while awake. Returns
   * the control that puts the subscription to sleep and wakes it.
   */
  subscribe: (onFrame: () => void) => {
    const register = Effect.sync(registration(scheduler, onFrame));
    return Effect.acquireRelease(register, (registered) =>
      Effect.sync(registered.unsubscribe),
    ).pipe(Effect.map((registered) => registered.control));
  },
});

export class FrameSource extends Context.Service<FrameSource, ReturnType<typeof fromScheduler>>()(
  'effect-three/FrameSource',
) {}

/** Provides a frame source backed by `scheduler`. */
export const layer = (scheduler: FrameScheduler) =>
  Layer.succeed(FrameSource, fromScheduler(scheduler));
