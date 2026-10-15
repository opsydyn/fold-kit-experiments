/**
 * Scene time. Behaviours read elapsed seconds from here; pausing animation (for example
 * under `prefers-reduced-motion`) freezes scene time while frames keep rendering, and
 * resuming continues from the frozen value rather than jumping ahead.
 *
 * @module
 */

export type SceneClock = {
  /** Scene seconds elapsed while animating. */
  readonly elapsedSeconds: () => number;
  /** Freezes (`false`) or resumes (`true`) scene time. Idempotent. */
  readonly setAnimating: (animating: boolean) => void;
  readonly animating: () => boolean;
};

/** Creates a scene clock over a monotonic source of seconds. */
export const createSceneClock = (nowSeconds: () => number): SceneClock => {
  const start = nowSeconds();
  let frozenAt: number | undefined;
  let paused = 0;
  const elapsedSeconds = (): number => (frozenAt ?? nowSeconds()) - start - paused;
  return {
    elapsedSeconds,
    setAnimating: (animating) => {
      if (animating && frozenAt !== undefined) {
        paused += nowSeconds() - frozenAt;
        frozenAt = undefined;
      } else if (!animating && frozenAt === undefined) {
        frozenAt = nowSeconds();
      }
    },
    animating: () => frozenAt === undefined,
  };
};
