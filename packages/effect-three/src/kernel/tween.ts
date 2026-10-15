/**
 * Eased transitions of position and scale. A tween's pose is a pure function of scene
 * time: `from + (to - from) * easing(progress)`, so frames are deterministic.
 *
 * @module
 */
import type { Object3D, Vector3Tuple } from 'three';

import type { Easing, Vec3 } from './description.ts';

const backOvershoot = 1.70158;

/** Maps linear progress in [0, 1] through an easing curve. */
export const easeProgress = (easing: Easing, progress: number): number => {
  switch (easing) {
    case 'linear':
      return progress;
    case 'easeInOutCubic':
      return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    case 'easeOutCubic':
      return 1 - (1 - progress) ** 3;
    case 'easeOutBack':
      return 1 + (backOvershoot + 1) * (progress - 1) ** 3 + backOvershoot * (progress - 1) ** 2;
  }
};

/** A position and scale transition in flight. */
export type Tween = {
  readonly fromPosition: Vector3Tuple;
  readonly fromScale: Vector3Tuple;
  readonly toPosition: Vec3;
  readonly toScale: Vec3;
  /** Scene time the tween started, in seconds. */
  readonly start: number;
  readonly seconds: number;
  readonly easing: Easing;
};

/** Starts a tween from the object's current pose towards the targets. */
export const startTween = (
  object: Object3D,
  target: { readonly position: Vec3; readonly scale: Vec3 },
  start: number,
  transition: { readonly seconds: number; readonly easing: Easing },
): Tween => ({
  fromPosition: object.position.toArray(),
  fromScale: object.scale.toArray(),
  toPosition: target.position,
  toScale: target.scale,
  start,
  seconds: transition.seconds,
  easing: transition.easing,
});

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

/**
 * Writes the tween's pose at `elapsedSeconds` into the object without allocating.
 * Returns true once the tween has finished, after writing the exact targets.
 */
export const applyTween = (object: Object3D, tween: Tween, elapsedSeconds: number): boolean => {
  const progress = Math.min(1, Math.max(0, (elapsedSeconds - tween.start) / tween.seconds));
  if (progress >= 1) {
    object.position.set(tween.toPosition[0], tween.toPosition[1], tween.toPosition[2]);
    object.scale.set(tween.toScale[0], tween.toScale[1], tween.toScale[2]);
    return true;
  }
  const amount = easeProgress(tween.easing, progress);
  object.position.set(
    lerp(tween.fromPosition[0], tween.toPosition[0], amount),
    lerp(tween.fromPosition[1], tween.toPosition[1], amount),
    lerp(tween.fromPosition[2], tween.toPosition[2], amount),
  );
  object.scale.set(
    lerp(tween.fromScale[0], tween.toScale[0], amount),
    lerp(tween.fromScale[1], tween.toScale[1], amount),
    lerp(tween.fromScale[2], tween.toScale[2], amount),
  );
  return false;
};
