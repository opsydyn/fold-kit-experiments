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

/** A scheduler that forwards frames only while open. */
export type GatedFrames = FrameScheduler & {
  readonly setOpen: (open: boolean) => void;
};

/**
 * Wraps `base` so frames pass only while open: for example, only while the canvas is on
 * screen, or only while a scene has something to draw. A closed gate unsubscribes from
 * `base`, so a scheduler that stops when nobody listens (such as the browser's animation
 * frames) really stops.
 */
export const createGatedFrames = (base: FrameScheduler): GatedFrames => {
  let open = true;
  const callbacks = new Set<() => void>();
  let unsubscribe: (() => void) | undefined;
  const forward = (): void => {
    // Snapshot: a callback may close the gate or unsubscribe while running.
    for (const onFrame of Array.from(callbacks)) onFrame();
  };
  const sync = (): void => {
    const wanted = open && callbacks.size > 0;
    if (wanted && unsubscribe === undefined) unsubscribe = base.subscribe(forward);
    else if (!wanted && unsubscribe !== undefined) {
      unsubscribe();
      unsubscribe = undefined;
    }
  };
  return {
    subscribe: (onFrame) => {
      callbacks.add(onFrame);
      sync();
      return () => {
        callbacks.delete(onFrame);
        sync();
      };
    },
    setOpen: (next) => {
      open = next;
      sync();
    },
  };
};

/** Turns a scene's frames on and off. Off unsubscribes, so an idle scheduler can stop. */
export type FrameControl = {
  readonly wake: () => void;
  readonly sleep: () => void;
};

/** The part of a scene loop that pacing needs. */
export type Paced = {
  readonly frame: () => void;
  readonly wantsFrames: () => boolean;
};

export type FramePacer = {
  /** The per-frame callback: draws, then sleeps when no further frame is wanted. */
  readonly frame: () => void;
  /** Connects the subscription's control, putting it to sleep if nothing is wanted yet. */
  readonly attach: (control: FrameControl) => void;
  /** Wakes the subscription if a frame is now wanted. Call on every invalidation. */
  readonly wake: () => void;
  /** Draws one frame now, whatever the mode: React Three Fiber's `advance`. */
  readonly advance: () => void;
};

/**
 * Paces a scene's frames: subscribed while frames are wanted, asleep otherwise, so an
 * idle scene costs no frames at all.
 */
export const createFramePacer = (loop: Paced): FramePacer => {
  let control: FrameControl | undefined;
  return {
    frame: () => {
      loop.frame();
      if (!loop.wantsFrames()) control?.sleep();
    },
    attach: (next) => {
      control = next;
      if (!loop.wantsFrames()) next.sleep();
    },
    wake: () => {
      if (loop.wantsFrames()) control?.wake();
    },
    advance: loop.frame,
  };
};
