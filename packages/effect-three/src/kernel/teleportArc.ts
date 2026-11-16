/**
 * The teleport arc (`xr({ teleportArc })`): a curve from a controller down to the floor,
 * where the player goes when they let go of select over somewhere they may stand. The
 * maths, pure; the adapter draws the arc each frame and casts its segments at the scene.
 *
 * Behavioural reference: pmndrs/xr at `0e1acd8`, `packages/xr/src/teleport.ts`:
 * `createTeleportRayLine` is the quadratic Bézier from (0, 0, 0) through (0, 0, −8) to
 * (0, −20, −15) in 20 segments; `syncTeleportPointerRayGroup` places it at the
 * controller's target ray, keeping only its yaw and pitch (`YXZ` Euler, roll dropped),
 * pitched 10° further down and clamped between straight down and 49.5° up, and eases the
 * curve toward that over 100 ms; `makeTeleportTarget` moves the player so the head, not
 * the origin, stands over the point the curve met.
 *
 * @module
 */
import { Euler, Quaternion, QuadraticBezierCurve3, Vector3 } from 'three';

import type { Vec3, Xr } from './description.ts';
import type { Quat } from './physics.ts';

/** Segments in the arc, as pmndrs/xr's `createTeleportRayLine`. */
const segments = 20;

/** The arc in its own space, from the controller along −z and down: 21 points. */
const curve: ReadonlyArray<Vector3> = new QuadraticBezierCurve3(
  new Vector3(0, 0, 0),
  new Vector3(0, 0, -8),
  new Vector3(0, -20, -15),
).getPoints(segments);

/** How far the arc's aim is pitched below the controller's. */
const dip = (10 * Math.PI) / 180;
/** The highest the arc may leave at: 1.1 × 45°, as pmndrs/xr clamps it. */
const highest = (1.1 * Math.PI) / 4;
/** Over this long the arc's aim catches up with the controller's. */
const easeMilliseconds = 100;

const euler = new Euler(0, 0, 0, 'YXZ');
const turn = new Quaternion();

/**
 * The way an arc leaves a controller turned by `quaternion`: its yaw, and its pitch dipped
 * 10° and kept between straight down and 49.5° up. Its roll is dropped.
 */
export const arcAim = (quaternion: Quat): Quat => {
  euler.setFromQuaternion(turn.set(...quaternion));
  euler.z = 0;
  euler.x = Math.min(Math.max(euler.x - dip, -Math.PI / 2), highest);
  const aimed = turn.setFromEuler(euler);
  return [aimed.x, aimed.y, aimed.z, aimed.w];
};

/** The aim `elapsed` milliseconds on from `from` toward `to`: there after 100 ms. */
export const easeAim = (from: Quat, to: Quat, elapsed: number): Quat => {
  const eased = new Quaternion(...from).slerp(
    new Quaternion(...to),
    Math.min(1, Math.max(0, elapsed / easeMilliseconds)),
  );
  return [eased.x, eased.y, eased.z, eased.w];
};

/** The arc's 21 points in the scene, leaving `position` along `aim`. */
export const arcPoints = (position: Vec3, aim: Quat): ReadonlyArray<Vec3> => {
  const rotation = new Quaternion(...aim);
  const at = new Vector3(...position);
  function placed(point: Vector3): Vec3 {
    const moved = point.clone().applyQuaternion(rotation).add(at);
    return [moved.x, moved.y, moved.z];
  }
  return curve.map(placed);
};

/** Where an arc met something: the point, and the segment it met it on. */
export type ArcHit = { readonly point: Vec3; readonly segment: number };

/**
 * The first place along the arc that `cast` meets: each segment cast in turn from its start
 * to its end, `cast` answering with the nearest point it met between them, if any.
 */
export const arcHit = (
  points: ReadonlyArray<Vec3>,
  cast: (from: Vec3, to: Vec3) => Vec3 | undefined,
): ArcHit | undefined => {
  for (let segment = 0; segment < points.length - 1; segment++) {
    const from = points[segment];
    const to = points[segment + 1];
    const point = from === undefined || to === undefined ? undefined : cast(from, to);
    if (point !== undefined) return { point, segment };
  }
  return undefined;
};

/**
 * Where the player's origin goes so that their head, at `head` in the scene, stands over
 * `landing` (and their feet on it), facing as before: as pmndrs/xr's teleport target
 * takes the head's offset from the origin off the point.
 */
export const teleportOrigin = (settings: Xr, landing: Vec3, head: Vec3): Vec3 => [
  landing[0] - (head[0] - settings.origin[0]),
  landing[1],
  landing[2] - (head[2] - settings.origin[2]),
];
