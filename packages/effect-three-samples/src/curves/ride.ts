/**
 * The comet's `ride` behaviour: once round the closed Catmull-Rom curve through the
 * handles every `lap` seconds of scene time. The handles come as its parameters (`x0`,
 * `y0` …), so dragging one changes the path at once, with no Message a frame.
 */
import { type Behaviour, catmullRomPointAt, type Vec3 } from '@opsydyn/effect-three';

/** How many control points the behaviour reads: `x0`, `y0` … up to five. */
export const ridePoints = 5;

/** Once round the closed curve every `lap` seconds. */
export const ride: Behaviour = (pose, seconds, params) => {
  const controls = Array.from(
    { length: ridePoints },
    (_, index): Vec3 => [params[`x${index}`] ?? 0, params[`y${index}`] ?? 0, 0],
  );
  const lap = (((seconds / (params['lap'] ?? 8)) % 1) + 1) % 1;
  const [x, y, z] = catmullRomPointAt(controls, lap, { closed: true });
  pose.offset.set(x, y, z);
};
