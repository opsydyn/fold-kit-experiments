import { finitePoint } from './geometry';
import { FlowError } from './graph';
import type {
  Point,
  PortAnchorSnapOptions,
  PortAnchorSnapResult,
  PortAnchorSnapOverrides,
  PortAnchorSnapSettings,
  PortCorner,
  PortSide,
  Size,
} from './types';

/** Merge per-port overrides without mutating inputs. Throws FlowError for invalid effective values. */
export function resolvePortAnchorSnapSettings(
  defaults: PortAnchorSnapOverrides,
  overrides: PortAnchorSnapOverrides = {},
): PortAnchorSnapSettings {
  const settings = {
    distance: overrides.distance ?? defaults.distance ?? 0,
    cornerDistance: overrides.cornerDistance ?? defaults.cornerDistance ?? 0,
    midpointDistance: overrides.midpointDistance ?? defaults.midpointDistance ?? 0,
    hysteresis: overrides.hysteresis ?? defaults.hysteresis ?? 0,
  };
  for (const [field, value] of Object.entries(settings))
    if (!Number.isFinite(value) || value < 0)
      throw new FlowError(
        'invalid-edit',
        `Port anchor snap ${field} must be finite and non-negative`,
      );
  return settings;
}

/** Shared circular attraction and retention for discrete frame points. */
function resolvePointAttraction<T extends string>(
  anchor: Point,
  targets: readonly Readonly<{ target: T; anchor: Point }>[],
  options: Readonly<{
    size: Size;
    zoom: number;
    distance: number;
    hysteresis: number;
    previous?: T | null;
    preferred?: T;
  }>,
): Readonly<{ target: T; anchor: Point }> | undefined {
  const { size, zoom, distance, hysteresis, previous, preferred } = options;
  if (distance === 0) return undefined;
  const candidates = targets.map((target) => ({
    ...target,
    distance: Math.hypot(
      (anchor.x - target.anchor.x) * size.width * zoom,
      (anchor.y - target.anchor.y) * size.height * zoom,
    ),
  }));
  const nearest = candidates.reduce((best, target) =>
    target.distance < best.distance ||
    (target.distance === best.distance && target.target === preferred)
      ? target
      : best,
  );
  const retained =
    hysteresis > 0 ? candidates.find(({ target }) => target === previous) : undefined;
  if (retained && retained.distance <= distance + hysteresis) {
    const switchTarget =
      nearest.target !== retained.target &&
      nearest.distance <= distance &&
      retained.distance - nearest.distance > hysteresis;
    if (!switchTarget) return retained;
  }
  return nearest.distance <= distance ? nearest : undefined;
}

/** Clamp a normalized candidate, resolve corners, then edge midpoints, then edges. */
export function resolvePortAnchorSnap(
  candidate: Point,
  options: PortAnchorSnapOptions,
): PortAnchorSnapResult {
  finitePoint(candidate);
  const {
    size,
    zoom,
    distance,
    preferredSide,
    hysteresis = 0,
    previousSide,
    cornerDistance = 0,
    previousCorner,
    midpointDistance = 0,
    previousMidpoint,
  } = options;
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
    hysteresis < 0 ||
    !Number.isFinite(cornerDistance) ||
    cornerDistance < 0 ||
    !Number.isFinite(midpointDistance) ||
    midpointDistance < 0
  )
    throw new FlowError(
      'invalid-edit',
      'Anchor snapping requires positive frame dimensions and zoom, and finite non-negative edge/corner/midpoint distance and hysteresis',
    );
  const anchor = {
    x: Math.max(0, Math.min(1, candidate.x)),
    y: Math.max(0, Math.min(1, candidate.y)),
  };
  const corner = resolvePointAttraction<PortCorner>(
    anchor,
    [
      { target: 'top-left', anchor: { x: 0, y: 0 } },
      { target: 'top-right', anchor: { x: 1, y: 0 } },
      { target: 'bottom-left', anchor: { x: 0, y: 1 } },
      { target: 'bottom-right', anchor: { x: 1, y: 1 } },
    ],
    { size, zoom, distance: cornerDistance, hysteresis, previous: previousCorner },
  );
  if (corner) return { anchor: corner.anchor, side: null, corner: corner.target };
  const midpoint = resolvePointAttraction<PortSide>(
    anchor,
    [
      { target: 'left', anchor: { x: 0, y: 0.5 } },
      { target: 'right', anchor: { x: 1, y: 0.5 } },
      { target: 'top', anchor: { x: 0.5, y: 0 } },
      { target: 'bottom', anchor: { x: 0.5, y: 1 } },
    ],
    {
      size,
      zoom,
      distance: midpointDistance,
      hysteresis,
      previous: previousMidpoint,
      preferred: preferredSide,
    },
  );
  if (midpoint) return { anchor: midpoint.anchor, side: null, midpoint: midpoint.target };
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
