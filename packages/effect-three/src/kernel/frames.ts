/**
 * Frame scheduling contracts. A scheduler calls registered callbacks once per frame:
 * `requestAnimationFrame` in a browser, three's `setAnimationLoop` for WebGPU and XR, or
 * a manual scheduler in tests.
 *
 * @module
 */

/** Registers a per-frame callback and returns a function that unregisters it. */
export type FrameScheduler = {
  readonly subscribe: (onFrame: () => void) => () => void;
};

/** A scheduler driven by hand. `step` runs one frame for every subscriber. */
export type ManualFrames = FrameScheduler & {
  readonly step: () => void;
  readonly subscribers: () => number;
};

/** Creates a manual frame scheduler for deterministic tests. */
export const createManualFrames = (): ManualFrames => {
  const callbacks = new Set<() => void>();
  return {
    subscribe: (onFrame) => {
      callbacks.add(onFrame);
      return () => {
        callbacks.delete(onFrame);
      };
    },
    step: () => {
      // Snapshot: callbacks subscribed during this frame first run on the next one.
      for (const onFrame of Array.from(callbacks)) onFrame();
    },
    subscribers: () => callbacks.size,
  };
};
