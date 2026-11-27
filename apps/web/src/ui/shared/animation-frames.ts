import { Effect, Queue, Stream } from 'effect';

/** Browser frame deltas. The subscriber owns the frame loop. */
export const animationFrames = Stream.callback<number>((queue) => {
  const open = Effect.sync(() => {
    const browser = globalThis.window;
    let previous: number | undefined;
    let request = 0;
    const tick = (time: number) => {
      if (previous !== undefined) Queue.offerUnsafe(queue, time - previous);
      previous = time;
      request = browser.requestAnimationFrame(tick);
    };
    request = browser.requestAnimationFrame(tick);
    return () => browser.cancelAnimationFrame(request);
  });
  const listen = Effect.acquireRelease(open, Effect.sync);
  // The subscription finalizer cancels the frame loop.
  // oxlint-disable-next-line linteffect/no-effect-never
  return Effect.andThen(listen, Effect.never);
});
