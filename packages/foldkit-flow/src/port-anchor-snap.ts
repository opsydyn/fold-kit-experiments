import { finitePoint } from './geometry';
import { FlowError } from './graph';
import type { Point, PortAnchorSnapOptions, PortAnchorSnapResult, PortSide } from './types';

/** Clamp a normalized candidate and resolve edge attraction, optionally retaining the current gesture's edge. */
export function resolvePortAnchorSnap(
  candidate: Point,
  options: PortAnchorSnapOptions,
): PortAnchorSnapResult {
  finitePoint(candidate);
  const { size, zoom, distance, preferredSide, hysteresis = 0, previousSide } = options;
  if (
    !Number.isFinite(size.width) ||
    size.width <= 0 ||
    !Number.isFinite(size.height) ||
    size.height <= 0 ||
    !Number.isFinite(zoom) ||
    zoom <= 0 ||
    !Number.isFinite(distance) ||
    distance < 0 ||
    !Number.isFinite(hysteresis) ||
    hysteresis < 0
  )
    throw new FlowError(
      'invalid-edit',
      'Anchor snapping requires positive frame dimensions and zoom, and finite non-negative distance and hysteresis',
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
  const previous = hysteresis > 0 ? edges.find((edge) => edge.side === previousSide) : undefined;
  if (previous && previous.distance <= distance + hysteresis) {
    const switchEdge =
      nearest.side !== previous.side &&
      nearest.distance <= distance &&
      previous.distance - nearest.distance > hysteresis;
    if (!switchEdge) return { anchor: previous.anchor, side: previous.side };
  }
  return nearest.distance <= distance
    ? { anchor: nearest.anchor, side: nearest.side }
    : { anchor, side: null };
}
