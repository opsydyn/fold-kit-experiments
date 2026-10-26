/**
 * Relay jumps: following a relationship rides the camera along that edge's arc, from one
 * blip to the other, rather than flying straight there. The camera stays outside the arc
 * and keeps looking at the centre, then settles where a flight to the far blip would.
 * Pure: the update steps a journey by animation frames.
 */
import type { Vec3 } from '@opsydyn/effect-three';

import type { RadarPosition } from './layout';
import { flightApproach, flightTo } from './model';
import { bearingOf, blipPosition, edgeArc, elevationOf, onSphere, zoomLimits } from './space';

/** How long a relay jump takes, in milliseconds. */
export const relayDuration = 2400;

/** How closely the rendered camera follows the ride: enough to smooth each frame's step. */
export const relayDamping = 0.3;

/** Where the camera rides over a point on the arc: outside it, a little above, looking in. */
const ridingOver = (point: Vec3): Vec3 =>
  onSphere(
    bearingOf(point),
    Math.min(80, elevationOf(point) + 10),
    Math.max(zoomLimits.min, Math.hypot(...point) + flightApproach),
  );

/** The camera's path for a jump: over each point of the edge, then to the far blip's vantage. */
export const relayWaypoints = (from: RadarPosition, to: RadarPosition): ReadonlyArray<Vec3> => [
  ...edgeArc(blipPosition(from), blipPosition(to)).map(ridingOver),
  flightTo(to).position,
];

/** Slow out, faster through the middle, slow in: a smoothstep. */
export const easeInOut = (t: number): number => t * t * (3 - 2 * t);

/** The point `t` of the way along a path of waypoints, between the two it falls between. */
export const alongPath = (waypoints: ReadonlyArray<Vec3>, t: number): Vec3 => {
  const span = Math.max(0, waypoints.length - 1);
  const at = Math.min(span, Math.max(0, t * span));
  const index = Math.min(span - 1, Math.floor(at));
  const from = waypoints[Math.max(0, index)] ?? [0, 0, 0];
  const to = waypoints[Math.max(0, index + 1)] ?? from;
  const share = at - index;
  return [
    from[0] + (to[0] - from[0]) * share,
    from[1] + (to[1] - from[1]) * share,
    from[2] + (to[2] - from[2]) * share,
  ];
};
