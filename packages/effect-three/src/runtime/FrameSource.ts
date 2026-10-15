/**
 * Where frames come from. Wraps a kernel `FrameScheduler` so a scene's per-frame callback
 * is registered for exactly the lifetime of its scope.
 *
 * @module
 */
import { Context, Effect, Layer } from 'effect';

import type { FrameScheduler } from '../kernel/index.ts';

const registration = (scheduler: FrameScheduler, onFrame: () => void) => () =>
  scheduler.subscribe(onFrame);

/** The frame source service for `scheduler`, for providing directly with `provideService`. */
export const fromScheduler = (scheduler: FrameScheduler) => ({
  /** Calls `onFrame` once per frame until the current scope closes. */
  subscribe: (onFrame: () => void) => {
    const register = Effect.sync(registration(scheduler, onFrame));
    return Effect.acquireRelease(register, Effect.sync).pipe(Effect.asVoid);
  },
});

export class FrameSource extends Context.Service<FrameSource, ReturnType<typeof fromScheduler>>()(
  'effect-three/FrameSource',
) {}

/** Provides a frame source backed by `scheduler`. */
export const layer = (scheduler: FrameScheduler) =>
  Layer.succeed(FrameSource, fromScheduler(scheduler));
