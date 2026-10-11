export type ContinuousDomain = readonly [number, number];

const spanOf = ([lower, upper]: ContinuousDomain): number => {
  const span = upper - lower;
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || !Number.isFinite(span) || span <= 0)
    throw new RangeError('Domain must have finite increasing endpoints and a representable span');
  return span;
};
const validate = (domain: ContinuousDomain, bounds: ContinuousDomain, minSpan: number): number => {
  const span = spanOf(domain);
  const boundSpan = spanOf(bounds);
  if (!Number.isFinite(minSpan) || minSpan <= 0 || minSpan > boundSpan)
    throw new RangeError('Minimum span must be positive and fit within bounds');
  return span;
};

/** Expand about the centre, then translate to fit bounds, preserving span when possible. */
export function constrainDomain(
  domain: ContinuousDomain,
  bounds: ContinuousDomain,
  minSpan: number,
): ContinuousDomain {
  const requested = validate(domain, bounds, minSpan);
  const span = Math.max(requested, minSpan);
  if (span >= spanOf(bounds)) return [bounds[0], bounds[1]];
  let lower = domain[0] - (span - requested) / 2;
  let upper = lower + span;
  spanOf([lower, upper]);
  if (lower < bounds[0]) {
    lower = bounds[0];
    upper = lower + span;
  }
  if (upper > bounds[1]) {
    upper = bounds[1];
    lower = upper - span;
  }
  spanOf([lower, upper]);
  return [lower, upper];
}

/** Factor 0.5 halves the span; preserve the clamped anchor's fractional position. */
export function zoomDomain(
  domain: ContinuousDomain,
  factor: number,
  anchor: number,
  bounds: ContinuousDomain,
  minSpan: number,
): ContinuousDomain {
  const span = validate(domain, bounds, minSpan);
  if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(anchor))
    throw new RangeError('Zoom factor must be positive and anchor finite');
  const clamped = Math.max(domain[0], Math.min(domain[1], anchor));
  const fraction = (clamped - domain[0]) / span;
  const nextSpan = span * factor;
  const lower = clamped - nextSpan * fraction;
  const upper = clamped + nextSpan * (1 - fraction);
  // Reject lost representability before minimum-span expansion can conceal it.
  return constrainDomain([lower, upper], bounds, minSpan);
}

/** Translate in domain units; no dependence on pixels or browser state. */
export function panDomain(
  domain: ContinuousDomain,
  delta: number,
  bounds: ContinuousDomain,
  minSpan: number,
): ContinuousDomain {
  validate(domain, bounds, minSpan);
  if (!Number.isFinite(delta)) throw new RangeError('Pan delta must be finite');
  return constrainDomain([domain[0] + delta, domain[1] + delta], bounds, minSpan);
}
