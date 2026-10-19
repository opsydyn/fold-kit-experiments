/**
 * A line's geometry, as Drei's `Line` builds it: three's `LineGeometry` through the points
 * (or `LineSegmentsGeometry`, a segment for each pair), with a colour per point when it
 * has them. Shared by the render kits, whose materials differ; the geometry does not.
 *
 * @module
 */
import { Color } from 'three';
import type { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import type { LineNode } from './description.ts';

/** Whether there is anything to draw: two points for a line, a pair for segments. */
export const drawable = (line: LineNode): boolean => line.points.length >= 2;

/**
 * Fills a line's geometry: a `LineGeometry` through the points, or a
 * `LineSegmentsGeometry` for segments. Too few points give one empty segment (hidden).
 */
export const fillLineGeometry = <G extends LineSegmentsGeometry>(
  geometry: G,
  line: LineNode,
): G => {
  const points = drawable(line) ? line.points : [[0, 0, 0] as const, [0, 0, 0] as const];
  // Segments come in pairs: an odd last point has nothing to join.
  const used = line.segments ? points.slice(0, points.length - (points.length % 2)) : points;
  geometry.setPositions(used.flat());
  const colors = line.vertexColors;
  if (colors !== null) {
    // A colour for every point: the last given carries on, as a line can't skip one.
    const per = used.map((_, index) => colors[Math.min(index, colors.length - 1)] ?? line.color);
    geometry.setColors(per.flatMap((color) => new Color(color).toArray()));
  }
  return geometry;
};
