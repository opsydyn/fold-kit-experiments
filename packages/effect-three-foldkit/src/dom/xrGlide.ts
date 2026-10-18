/**
 * Gliding with the thumbsticks while presenting (`xr({ glide })`), one frame at a time.
 *
 * Behavioural reference: pmndrs/xr at `0e1acd8`, `packages/xr/src/controller-locomotion.ts`:
 * the left stick moves the player along the head's facing, flattened onto the floor, at
 * `speed` metres per second at full stick (forward is the stick pushed away, negative y);
 * the right stick turns, smoothly at `turnSpeed`, or by `snapDegrees` once per push past
 * halfway, ready again once back under it. Unlike there, a still stick is a still player
 * (a small dead zone keeps resting thumbsticks from drifting), and the frame that stops
 * says where the player ended, for the Model.
 *
 * @module
 */
import type { Vec3, XrGlide } from '@opsydyn/effect-three';

/** Where the player stands: the reference space's origin in the scene, and its heading. */
export type GlidePose = { readonly origin: Vec3; readonly heading: number };

/** A thumbstick, `[x, y]`, each −1 to 1 (`y` negative pushed away). */
export type Stick = readonly [x: number, y: number];

/** Gliding's state between frames. */
export type Glider = {
  readonly pose: GlidePose;
  /** Whether a snap turn is ready (the turning stick has been back under halfway). */
  readonly snapReady: boolean;
  /** Whether the pose moved since the last report. */
  readonly moved: boolean;
};

/** Thumbsticks rest a little off centre; under this they are still. */
const deadZone = 0.15;
/** Past this the turning stick turns (pmndrs/xr's default dead zone, 0.5). */
const turnZone = 0.5;

export const startGlider = (pose: GlidePose): Glider => ({ pose, snapReady: true, moved: false });

/** The head's facing on the floor, from its orientation quaternion: −z turned, flattened. */
export const floorFacing = (q: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}): readonly [x: number, z: number] => {
  const x = -2 * (q.x * q.z + q.w * q.y);
  const z = -(1 - 2 * (q.x * q.x + q.y * q.y));
  const length = Math.hypot(x, z);
  return length < 1e-6 ? [0, -1] : [x / length, z / length];
};

const still = (stick: Stick, zone: number): boolean =>
  Math.abs(stick[0]) < zone && Math.abs(stick[1]) < zone;

/** One step of moving: along the head's facing and its right, by the stick. */
const moveBy = (
  origin: Vec3,
  stick: Stick,
  facing: readonly [number, number],
  distance: number,
): Vec3 => {
  const [fx, fz] = facing;
  // The right of the facing (fx, fz) on the floor, y up: (−fz, fx).
  const forward = -stick[1] * distance;
  const right = stick[0] * distance;
  return [origin[0] + fx * forward - fz * right, origin[1], origin[2] + fz * forward + fx * right];
};

/** The heading after the turning stick, and whether a snap is ready next frame. */
const turnBy = (
  glider: Glider,
  glide: XrGlide,
  stick: Stick,
  seconds: number,
): { readonly heading: number; readonly snapReady: boolean } => {
  const { heading } = glider.pose;
  const pushed = Math.abs(stick[0]) >= turnZone;
  if (glide.turn === 'smooth') {
    return {
      heading: pushed ? heading - stick[0] * glide.turnSpeed * seconds : heading,
      snapReady: true,
    };
  }
  if (!pushed) return { heading, snapReady: true };
  if (!glider.snapReady) return { heading, snapReady: false };
  // Pushed right turns right: the heading (about +y) goes down.
  return {
    heading: heading - (Math.sign(stick[0]) * (glide.snapDegrees * Math.PI)) / 180,
    snapReady: false,
  };
};

/**
 * One frame of gliding. Returns the next state, and the pose to report when the sticks
 * have just come to rest after moving it.
 */
export const glideFrame = (
  glider: Glider,
  glide: XrGlide,
  sticks: { readonly move: Stick; readonly turn: Stick },
  facing: readonly [number, number],
  seconds: number,
): { readonly glider: Glider; readonly stopped: GlidePose | undefined } => {
  const moving = !still(sticks.move, deadZone);
  const origin = moving
    ? moveBy(glider.pose.origin, sticks.move, facing, glide.speed * seconds)
    : glider.pose.origin;
  const { heading, snapReady } = turnBy(glider, glide, sticks.turn, seconds);
  const changed = moving || heading !== glider.pose.heading;
  const resting = !moving && still(sticks.turn, turnZone);
  const moved = glider.moved || changed;
  const pose = { origin, heading };
  if (resting && moved) return { glider: { pose, snapReady, moved: false }, stopped: pose };
  return { glider: { pose, snapReady, moved }, stopped: undefined };
};
