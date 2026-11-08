import { finitePoint } from './geometry';
import { ZlozError } from './graph';
import type {
  Point,
  PortAnchorSnapOptions,
  PortAnchorSnapResult,
  PortAnchorSnapOverrides,
  PortAnchorSnapSettings,
  PortAnchorSnapTargets,
  PortAnchorSnapGuide,
  PortAnchorSnapPriority,
  PortAnchorTargetStep,
  PortAnchorTargetStepResult,
  PortCorner,
  PortSide,
  Size,
} from './types';

const sides: readonly PortSide[] = ['left', 'right', 'top', 'bottom'];
const corners: readonly PortCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function resolvePriority(priority: PortAnchorSnapPriority | undefined): PortAnchorSnapPriority {
  if (priority === undefined) return 'corners-first';
  if (priority === 'corners-first' || priority === 'midpoints-first') return priority;
  throw new ZlozError(
    'invalid-edit',
    'Port anchor snap priority must be corners-first or midpoints-first',
  );
}

function cornerSnapTargets(): readonly Readonly<{ target: PortCorner; anchor: Point }>[] {
  return [
    { target: 'top-left', anchor: { x: 0, y: 0 } },
    { target: 'top-right', anchor: { x: 1, y: 0 } },
    { target: 'bottom-left', anchor: { x: 0, y: 1 } },
    { target: 'bottom-right', anchor: { x: 1, y: 1 } },
  ];
}

function midpointSnapTargets(): readonly Readonly<{ target: PortSide; anchor: Point }>[] {
  return [
    { target: 'left', anchor: { x: 0, y: 0.5 } },
    { target: 'right', anchor: { x: 1, y: 0.5 } },
    { target: 'top', anchor: { x: 0.5, y: 0 } },
    { target: 'bottom', anchor: { x: 0.5, y: 1 } },
  ];
}

function allowedTargets<T extends string>(
  values: readonly T[] | undefined,
  valid: readonly T[],
  kind: string,
): readonly T[] | undefined {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.some((value) => !valid.includes(value)))
    throw new ZlozError(
      'invalid-edit',
      `Port anchor allowed ${kind} must be an array of valid target names`,
    );
  return valid.filter((value) => values.includes(value));
}

function resolveTargetLists(
  defaults: PortAnchorSnapTargets,
  overrides: PortAnchorSnapTargets,
): PortAnchorSnapTargets {
  const allowedEdges = allowedTargets(
    overrides.allowedEdges === undefined ? defaults.allowedEdges : overrides.allowedEdges,
    sides,
    'edges',
  );
  const allowedCorners = allowedTargets(
    overrides.allowedCorners === undefined ? defaults.allowedCorners : overrides.allowedCorners,
    corners,
    'corners',
  );
  const allowedMidpoints = allowedTargets(
    overrides.allowedMidpoints === undefined
      ? defaults.allowedMidpoints
      : overrides.allowedMidpoints,
    sides,
    'midpoints',
  );
  let targets: PortAnchorSnapTargets = {};
  if (allowedEdges !== undefined) targets = { ...targets, allowedEdges };
  if (allowedCorners !== undefined) targets = { ...targets, allowedCorners };
  if (allowedMidpoints !== undefined) targets = { ...targets, allowedMidpoints };
  return targets;
}

/** Merge per-port overrides without mutating inputs. Throws ZlozError for invalid effective values. */
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
      throw new ZlozError(
        'invalid-edit',
        `Port anchor snap ${field} must be finite and non-negative`,
      );
  const priority = overrides.priority === undefined ? defaults.priority : overrides.priority;
  resolvePriority(priority);
  const result = { ...settings, ...resolveTargetLists(defaults, overrides) };
  return priority === undefined ? result : { ...result, priority };
}

/** Enumerate permitted targets with positive acquisition radii, independently of cursor distance. */
export function portAnchorSnapGuideTargets(
  options: PortAnchorSnapOverrides,
): readonly PortAnchorSnapGuide[] {
  const settings = resolvePortAnchorSnapSettings(options);
  const guides: PortAnchorSnapGuide[] = [];
  if (settings.cornerDistance > 0)
    for (const { target, anchor } of cornerSnapTargets())
      if (settings.allowedCorners === undefined || settings.allowedCorners.includes(target))
        guides.push({ type: 'corner', corner: target, point: anchor });
  if (settings.midpointDistance > 0)
    for (const { target, anchor } of midpointSnapTargets())
      if (settings.allowedMidpoints === undefined || settings.allowedMidpoints.includes(target))
        guides.push({ type: 'midpoint', side: target, point: anchor });
  const edges: readonly Readonly<{ side: PortSide; start: Point; end: Point }>[] = [
    { side: 'left', start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    { side: 'right', start: { x: 1, y: 0 }, end: { x: 1, y: 1 } },
    { side: 'top', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
    { side: 'bottom', start: { x: 0, y: 1 }, end: { x: 1, y: 1 } },
  ];
  if (settings.distance > 0)
    for (const edge of edges)
      if (settings.allowedEdges === undefined || settings.allowedEdges.includes(edge.side))
        guides.push({ type: 'edge', ...edge });
  return guides;
}

/** Choose an enabled point target in priority/canonical order without changing editor state. */
export function resolvePortAnchorTargetStep(
  anchor: Point,
  options: PortAnchorSnapOverrides,
  step: PortAnchorTargetStep,
): PortAnchorTargetStepResult {
  finitePoint(anchor);
  if (step !== 'next' && step !== 'previous' && step !== 'first' && step !== 'last')
    throw new ZlozError(
      'invalid-edit',
      'Port anchor target step must be next, previous, first or last',
    );
  const settings = resolvePortAnchorSnapSettings(options);
  const permitted = portAnchorSnapGuideTargets(settings).filter((target) => target.type !== 'edge');
  const targets =
    settings.priority === 'midpoints-first'
      ? [
          ...permitted.filter((target) => target.type === 'midpoint'),
          ...permitted.filter((target) => target.type === 'corner'),
        ]
      : permitted;
  if (targets.length === 0) return { type: 'empty' };
  const current = targets.findIndex(({ point }) => point.x === anchor.x && point.y === anchor.y);
  const index =
    step === 'first'
      ? 0
      : step === 'last'
        ? targets.length - 1
        : current < 0
          ? step === 'next'
            ? 0
            : targets.length - 1
          : (current + (step === 'next' ? 1 : -1) + targets.length) % targets.length;
  const target = targets[index];
  return target ? { type: 'target', target, index, count: targets.length } : { type: 'empty' };
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
    allowed?: readonly T[] | undefined;
  }>,
): Readonly<{ target: T; anchor: Point }> | undefined {
  const { size, zoom, distance, hysteresis, previous, preferred } = options;
  const eligible = targets.filter(
    ({ target }) => options.allowed === undefined || options.allowed.includes(target),
  );
  if (distance === 0 || eligible.length === 0) return undefined;
  const candidates = eligible.map((target) => ({
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

/** Clamp a normalized candidate, resolve the preferred point kind first, then fall back to edges. */
export function resolvePortAnchorSnap(
  candidate: Point,
  options: PortAnchorSnapOptions,
): PortAnchorSnapResult {
  finitePoint(candidate);
  const priority = resolvePriority(options.priority);
  const { allowedEdges, allowedCorners, allowedMidpoints } = resolveTargetLists({}, options);
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
    throw new ZlozError(
      'invalid-edit',
      'Anchor snapping requires positive frame dimensions and zoom, and finite non-negative edge/corner/midpoint distance and hysteresis',
    );
  const anchor = {
    x: Math.max(0, Math.min(1, candidate.x)),
    y: Math.max(0, Math.min(1, candidate.y)),
  };
  const corner = resolvePointAttraction<PortCorner>(anchor, cornerSnapTargets(), {
    size,
    zoom,
    distance: cornerDistance,
    hysteresis,
    previous: previousCorner,
    allowed: allowedCorners,
  });
  const midpoint = resolvePointAttraction<PortSide>(anchor, midpointSnapTargets(), {
    size,
    zoom,
    distance: midpointDistance,
    hysteresis,
    previous: previousMidpoint,
    preferred: preferredSide,
    allowed: allowedMidpoints,
  });
  if (priority === 'midpoints-first' && midpoint)
    return { anchor: midpoint.anchor, side: null, midpoint: midpoint.target };
  if (corner) return { anchor: corner.anchor, side: null, corner: corner.target };
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
  const eligible = edges.filter(
    ({ side }) => allowedEdges === undefined || allowedEdges.includes(side),
  );
  if (eligible.length === 0) return { anchor, side: null };
  const nearest = eligible.reduce((best, edge) =>
    edge.distance < best.distance ||
    (edge.distance === best.distance && edge.side === preferredSide)
      ? edge
      : best,
  );
  const previous = hysteresis > 0 ? eligible.find((edge) => edge.side === previousSide) : undefined;
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
