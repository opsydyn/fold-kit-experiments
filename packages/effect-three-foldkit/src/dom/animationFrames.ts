/**
 * A `requestAnimationFrame` scheduler shared by every scene on the page: one browser
 * callback per frame, running only while at least one scene is subscribed.
 *
 * @module
 */
import type { FrameScheduler } from '@opsydyn/effect-three';

/** The part of `Window` the scheduler needs. */
export type AnimationFrameHost = Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>;

/** Creates a shared animation-frame scheduler for `host` (normally `window`). */
export const animationFrameScheduler = (host: AnimationFrameHost): FrameScheduler => {
  const callbacks = new Set<() => void>();
  let handle: number | undefined;
  const tick = (): void => {
    handle = host.requestAnimationFrame(tick);
    for (const onFrame of Array.from(callbacks)) onFrame();
  };
  return {
    subscribe: (onFrame) => {
      callbacks.add(onFrame);
      handle ??= host.requestAnimationFrame(tick);
      return () => {
        callbacks.delete(onFrame);
        if (callbacks.size > 0 || handle === undefined) return;
        host.cancelAnimationFrame(handle);
        handle = undefined;
      };
    },
  };
};
