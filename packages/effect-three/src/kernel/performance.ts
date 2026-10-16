/**
 * Frame-rate monitoring with a performance factor, after Drei's `PerformanceMonitor`
 * (`drei-main/src/core/PerformanceMonitor.tsx` at `bf6f4ad`): frames are averaged over
 * windows of `ms`; once `iterations` averages are in, the factor steps down when more than
 * `threshold` of them fell below the lower bound, and up when more than `threshold` rose
 * above the upper bound. The application decides what the factor means, typically a
 * render resolution.
 *
 * Two differences from Drei: the factor starts at 1 (draw at full resolution until proven
 * slow), and a gap between frames longer than `idleMs` restarts the window, because an
 * on-demand scene that is asleep is idle, not slow.
 *
 * @module
 */

export type PerformanceOptions = {
  /** Milliseconds per fps average. Default 250. */
  readonly ms?: number;
  /** Averages per decision. Default 10. */
  readonly iterations?: number;
  /** Share of averages that must agree to move the factor. Default 0.75. */
  readonly threshold?: number;
  /** How far one decision moves the factor. Default 0.1. */
  readonly step?: number;
  /** Lower and upper fps bounds for a refresh rate. Default as Drei. */
  readonly bounds?: (refreshRate: number) => readonly [lower: number, upper: number];
  /** A pause between frames longer than this restarts measurement. Default 100. */
  readonly idleMs?: number;
};

/** A change of performance factor, with the fps average that caused it. */
export type PerformanceChange = { readonly fps: number; readonly factor: number };

export type PerformanceMonitor = {
  /** Records a frame at `nowMs`; returns a change when the factor moved. */
  readonly sample: (nowMs: number) => PerformanceChange | undefined;
  readonly factor: () => number;
};

const defaultBounds = (refreshRate: number): readonly [number, number] =>
  refreshRate > 100 ? [60, 100] : [40, 60];

/** Creates a frame-rate monitor. Allocation-free per frame except when a decision is made. */
export const createPerformanceMonitor = (options: PerformanceOptions = {}): PerformanceMonitor => {
  const ms = options.ms ?? 250;
  const iterations = options.iterations ?? 10;
  const threshold = options.threshold ?? 0.75;
  const step = options.step ?? 0.1;
  const bounds = options.bounds ?? defaultBounds;
  const idleMs = options.idleMs ?? 100;
  const averages = new Float64Array(iterations);
  let collected = 0;
  let windowStart: number | undefined;
  let lastFrame: number | undefined;
  let framesInWindow = 0;
  let refreshRate = 0;
  let factor = 1;

  const restart = (nowMs: number): void => {
    windowStart = nowMs;
    framesInWindow = 0;
  };

  const decide = (fps: number): PerformanceChange | undefined => {
    collected = 0;
    const [lower, upper] = bounds(refreshRate);
    let above = 0;
    let below = 0;
    for (const average of averages) {
      if (average >= upper) above++;
      if (average < lower) below++;
    }
    const before = factor;
    if (above > iterations * threshold) factor = Math.min(1, factor + step);
    if (below > iterations * threshold) factor = Math.max(0, factor - step);
    // Round away floating-point drift from repeated steps.
    factor = Math.round(factor * 1000) / 1000;
    return factor === before ? undefined : { fps, factor };
  };

  return {
    sample: (nowMs) => {
      const idle = lastFrame === undefined || nowMs - lastFrame > idleMs;
      lastFrame = nowMs;
      if (idle || windowStart === undefined) {
        restart(nowMs);
        return undefined;
      }
      framesInWindow++;
      const elapsed = nowMs - windowStart;
      if (elapsed < ms) return undefined;
      const fps = Math.round((framesInWindow / elapsed) * 1000);
      refreshRate = Math.max(refreshRate, fps);
      averages[collected] = fps;
      collected++;
      restart(nowMs);
      return collected === iterations ? decide(fps) : undefined;
    },
    factor: () => factor,
  };
};
