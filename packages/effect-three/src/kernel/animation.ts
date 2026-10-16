/**
 * Clip playback as a pure function of scene time.
 *
 * @module
 */
import type { Animation } from './description.ts';

/** Just under the clip's end: three wraps a looping action at exactly its duration. */
const endEpsilon = 1e-6;

/**
 * The clip time to show `elapsed` seconds after playback started: wrapped for looping
 * clips (backwards too, for negative speeds), held at the last frame otherwise.
 */
export const clipTime = (animation: Animation, duration: number, elapsed: number): number => {
  if (duration <= 0) return 0;
  const t = elapsed * animation.speed;
  if (animation.loop) return ((t % duration) + duration) % duration;
  return Math.min(Math.max(t, 0), duration - endEpsilon);
};

/** Whether playback still changes the pose: always for loops, until the end otherwise. */
export const clipRunning = (animation: Animation, duration: number, elapsed: number): boolean =>
  animation.loop || (animation.speed !== 0 && Math.abs(elapsed * animation.speed) < duration);
