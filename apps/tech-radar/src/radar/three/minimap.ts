/**
 * The minimap: the radar seen from directly above, as the universe view sees it, in a
 * small square over the stage. Longitude 0 (the home camera's side) is at the bottom and
 * positive longitudes to the right. A marker on the rim shows the camera's bearing. Pure:
 * points in a unit square, the view draws them.
 */
import type { Vec3 } from '@opsydyn/effect-three';

import type { Category } from './data';
import { type RadarPosition, sectorStarts } from './layout';
import { bearingOf, blipPosition, outerRadius } from './space';

/** The minimap's rim: a little outside the outer shell, so caution blips sit inside it. */
const rimRadius = outerRadius * 1.1;

export type Point = readonly [number, number];

/** A point of the radar seen from above, in the minimap's unit square. */
export const fromAbove = ([x, , z]: Vec3): Point => [x / rimRadius, z / rimRadius];

/** A blip on the minimap. */
export const minimapPoint = (position: RadarPosition): Point => fromAbove(blipPosition(position));

/** The point on the rim at a longitude, in degrees. */
const onRim = (longitude: number, radius = 1): Point => {
  const angle = (longitude * Math.PI) / 180;
  return [Math.sin(angle) * radius, Math.cos(angle) * radius];
};

const format = ([x, y]: Point): string => `${x.toFixed(4)} ${y.toFixed(4)}`;

/** A category's quarter, as an SVG path from the centre out to the rim and round. */
export const quarterPath = (category: Category): string => {
  const start = sectorStarts[category];
  const corners = Array.from({ length: 7 }, (_, step) => onRim(start + step * 15));
  return `M 0 0 L ${corners.map(format).join(' L ')} Z`;
};

/** A shell's ring on the minimap, as a radius in the unit square. */
export const ringRadius = (shellRadius: number): number => shellRadius / rimRadius;

/**
 * The camera's marker: a small triangle on the rim at its bearing, pointing at the
 * centre, as an SVG `points` list.
 */
export const cameraMarker = (camera: Vec3): string => {
  const bearing = bearingOf(camera);
  const tip = onRim(bearing, 0.86);
  const left = onRim(bearing - 7, 1.04);
  const right = onRim(bearing + 7, 1.04);
  return [tip, left, right].map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(' ');
};
