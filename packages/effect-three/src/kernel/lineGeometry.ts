/**
 * A line's geometry, as Drei's `Line` builds it: three's `LineGeometry` through the points
 * (or `LineSegmentsGeometry`, a segment for each pair), with a colour per point when it
 * has them. Shared by the render kits, whose materials differ; the geometry does not.
 *
 * @module
 */
import { type BufferGeometry, Color, EdgesGeometry } from 'three';
import type { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import type { Edges, LineNode, Vec3 } from './description.ts';

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

/**
 * The line segments along a geometry's edges where faces meet at more than `threshold`
 * degrees, as Drei's `Edges` takes them from three's `EdgesGeometry`.
 */
export const edgePoints = (geometry: BufferGeometry, threshold: number): ReadonlyArray<Vec3> => {
  const found = new EdgesGeometry(geometry, threshold);
  const position = found.getAttribute('position');
  const points = Array.from(
    { length: position.count },
    (_, index): Vec3 => [position.getX(index), position.getY(index), position.getZ(index)],
  );
  found.dispose();
  return points;
};

/** The line a mesh's edges are drawn as: segments in the mesh's own space. */
export const edgeLine = (key: string, look: Edges, points: ReadonlyArray<Vec3>): LineNode => ({
  _tag: 'Line',
  key: `${key}:edges`,
  position: [0, 0, 0],
  rotation: { _tag: 'Fixed', euler: [0, 0, 0] },
  scale: [1, 1, 1],
  transition: { _tag: 'Instant' },
  behaviour: null,
  interactive: false,
  points,
  segments: true,
  color: look.color,
  vertexColors: null,
  width: look.width,
  worldUnits: look.worldUnits,
  dashed: look.dashed,
  dashSize: look.dashSize,
  gapSize: look.gapSize,
  dashScale: 1,
  dashOffset: 0,
  opacity: look.opacity,
  transparent: look.transparent,
});
