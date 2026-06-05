/**
 * TEA-compatible tween primitive.
 *
 * A Tween tracks animation progress (0→1) over a given duration.
 * Drive it by dispatching a `Tick({ deltaTime })` message on each
 * animation frame and calling `tweenStep` in the update function.
 *
 * Wire the tick via foldkit's `Subscription.animationFrame`:
 * ```typescript
 * Subscription.animationFrame({
 *   isActive: (model) => !allTweensDone(model.tweens),
 *   toMessage: (dt) => Ticked({ dt }),
 * })
 * ```
 */

// ── Easing functions ──────────────────────────────────────────────────────────

export type EaseFn = (t: number) => number;

/** Linear — no easing */
export const easeLinear: EaseFn = (t) => t;

/** Ease out cubic — decelerates toward the end */
export const easeOutCubic: EaseFn = (t) => 1 - (1 - t) ** 3;

/** Ease in cubic — accelerates from the start */
export const easeInCubic: EaseFn = (t) => t * t * t;

/** Ease in-out cubic — smooth start and end */
export const easeInOutCubic: EaseFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/** Ease out elastic — overshoots slightly then settles */
export const easeOutElastic: EaseFn = (t) => {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** Ease out back — overshoots and pulls back */
export const easeOutBack: EaseFn = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

// ── Tween state ───────────────────────────────────────────────────────────────

export type Tween = Readonly<{
  /** Eased progress 0..1 */
  progress: number;
  /** Total animation duration in milliseconds */
  duration: number;
  /** Accumulated elapsed time in milliseconds */
  elapsed: number;
  /** Easing function applied to raw t */
  ease: EaseFn;
}>;

/** Create a new tween at rest (progress = 0, elapsed = 0). */
export function tweenCreate(duration: number, ease: EaseFn = easeOutCubic): Tween {
  return { progress: 0, duration, elapsed: 0, ease };
}

/**
 * Advance a tween by `dt` milliseconds.
 * Returns a new Tween — never mutates.
 */
export function tweenStep(tween: Tween, dt: number): Tween {
  const elapsed = Math.min(tween.elapsed + dt, tween.duration);
  const raw = tween.duration > 0 ? elapsed / tween.duration : 1;
  return { ...tween, elapsed, progress: tween.ease(Math.min(1, raw)) };
}

/** True when the tween has completed (elapsed ≥ duration). */
export function tweenDone(tween: Tween): boolean {
  return tween.elapsed >= tween.duration;
}

// ── Value interpolation ───────────────────────────────────────────────────────

/** Interpolate between two numbers using the tween's current progress. */
export function tweenValue(from: number, to: number, tween: Tween): number {
  return from + (to - from) * tween.progress;
}

/**
 * Interpolate between two SVG path `d=` strings character-by-character.
 * Numeric tokens are interpolated; non-numeric chars are taken from `to`.
 * Both paths must have the same command structure.
 */
export function tweenPath(from: string, to: string, tween: Tween): string {
  if (tween.progress >= 1) return to;
  if (tween.progress <= 0) return from;

  const NUM = /-?[0-9]*\.?[0-9]+/g;
  const fromNums = [...from.matchAll(NUM)].map((m) => parseFloat(m[0]));
  const toNums = [...to.matchAll(NUM)].map((m) => parseFloat(m[0]));
  const n = Math.min(fromNums.length, toNums.length);

  let result = to;
  let idx = n - 1;

  // Replace numeric tokens back-to-front to preserve string positions
  result = result.replace(NUM, (match) => {
    if (idx < 0) return match;
    const f = fromNums[idx] ?? parseFloat(match);
    const t2 = toNums[idx] ?? parseFloat(match);
    idx--;
    const v = f + (t2 - f) * tween.progress;
    return String(Math.round(v * 1000) / 1000);
  });

  return result;
}

/** True if every tween in the array is complete. */
export function allTweensDone(tweens: ReadonlyArray<Tween>): boolean {
  return tweens.every(tweenDone);
}
