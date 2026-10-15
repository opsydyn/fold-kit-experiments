/**
 * Behaviours own animated properties (PLAN D4). Their output is a pure function of
 * elapsed scene time, so a frame's result doesn't depend on how many frames ran before
 * it: deterministic and frame-rate independent.
 *
 * @module
 */
import type { Euler } from 'three';

import type { Rotation } from './description.ts';

/** The spin angle in radians after `elapsedSeconds`. */
export const spinAngle = (
  spin: Extract<Rotation, { readonly _tag: 'Spin' }>,
  elapsedSeconds: number,
): number => spin.phase + spin.radiansPerSecond * elapsedSeconds;

/** Writes a rotation into a three.js Euler without allocating. */
export const writeRotation = (target: Euler, rotation: Rotation, elapsedSeconds: number): void => {
  if (rotation._tag === 'Fixed') {
    target.set(rotation.euler[0], rotation.euler[1], rotation.euler[2]);
    return;
  }
  const angle = spinAngle(rotation, elapsedSeconds);
  switch (rotation.axis) {
    case 'x':
      target.set(angle, 0, 0);
      return;
    case 'y':
      target.set(0, angle, 0);
      return;
    case 'z':
      target.set(0, 0, angle);
      return;
  }
};
