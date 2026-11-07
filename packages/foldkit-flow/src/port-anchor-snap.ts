import { finitePoint } from './geometry';
import { FlowError } from './graph';
import type { Point, PortAnchorSnapOptions, PortAnchorSnapResult, PortSide } from './types';

/** Clamp a normalized candidate, then attract it to the nearest eligible frame edge. Ties prefer the routing hint. */
export function resolvePortAnchorSnap(
  candidate: Point,
  options: PortAnchorSnapOptions,
): PortAnchorSnapResult {
  finitePoint(candidate);
  const { size, zoom, distance, preferredSide } = options;
  if (
    !Number.isFinite(size.width) ||
    size.width <= 0 ||
    !Number.isFinite(size.height) ||
    size.height <= 0 ||
    !Number.isFinite(zoom) ||
    zoom <= 0 ||
    !Number.isFinite(distance) ||
    distance < 0
  )
    throw new FlowError(
      'invalid-edit',
      'Anchor snapping requires positive frame dimensions and zoom, and a finite non-negative distance',
    );
  const anchor = {
    x: Math.max(0, Math.min(1, candidate.x)),
    y: Math.max(0, Math.min(1, candidate.y)),
  };
  if (distance === 0) return { anchor, side: null };
  const edges: { side: PortSide; distance: number; anchor: Point }[] = [
    { side: 'left', distance: anchor.x * size.width * zoom, anchor: { x: 0, y: anchor.y } },
    { side: 'right', distance: (1 - anchor.x) * size.width * zoom, anchor: { x: 1, y: anchor.y } },
    { side: 'top', distance: anchor.y * size.height * zoom, anchor: { x: anchor.x, y: 0 } },
    {
      side: 'bottom',
      distance: (1 - anchor.y) * size.height * zoom,
      anchor: { x: anchor.x, y: 1 },
    },
  ];
  const nearest = edges.reduce((best, edge) =>
    edge.distance < best.distance ||
    (edge.distance === best.distance && edge.side === preferredSide)
      ? edge
      : best,
  );
  return nearest.distance <= distance
    ? { anchor: nearest.anchor, side: nearest.side }
    : { anchor, side: null };
}
