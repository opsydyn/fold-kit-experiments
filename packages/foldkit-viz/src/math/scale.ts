// LINEAR SCALE

export type LinearScaleConfig = Readonly<{
  domain: readonly [number, number];
  range: readonly [number, number];
  clamp?: boolean;
}>;

export function linear(config: LinearScaleConfig): (value: number) => number {
  const [d0, d1] = config.domain;
  const [r0, r1] = config.range;
  const clamp = config.clamp ?? false;
  const k = (r1 - r0) / (d1 - d0);

  return (value: number): number => {
    let t = (value - d0) * k + r0;
    if (clamp) t = r1 > r0 ? Math.max(r0, Math.min(r1, t)) : Math.max(r1, Math.min(r0, t));
    return t;
  };
}

function tickStep(start: number, stop: number, count: number): number {
  const step0 = Math.abs(stop - start) / Math.max(0, count);
  let step1 = 10 ** Math.floor(Math.log(step0) / Math.LN10);
  const error = step0 / step1;
  if (error >= Math.SQRT2 * Math.sqrt(5)) step1 *= 10;
  else if (error >= Math.sqrt(10)) step1 *= 5;
  else if (error >= Math.SQRT2) step1 *= 2;
  return stop < start ? -step1 : step1;
}

export function linearTicks(domain: readonly [number, number], count = 5): ReadonlyArray<number> {
  const [start, stop] = domain;
  const step = tickStep(start, stop, count);
  if (!Number.isFinite(step) || step === 0) return [];
  const t0 = Math.ceil(start / step) * step;
  const t1 = Math.floor(stop / step) * step;
  const n = Math.round((t1 - t0) / step) + 1;
  return Array.from({ length: n }, (_, i) => parseFloat((t0 + i * step).toPrecision(12)));
}

// SQRT SCALE — D3 scaleSqrt parity (d3-scale pow.js transformSqrt)

export type SqrtScaleConfig = Readonly<{
  domain: readonly [number, number];
  range: readonly [number, number];
  clamp?: boolean;
}>;

export function sqrt(config: SqrtScaleConfig): (value: number) => number {
  const [d0, d1] = config.domain;
  const [r0, r1] = config.range;
  const clamp = config.clamp ?? false;

  return (value: number): number => {
    const span = d1 - d0;
    const t = span === 0 ? 0 : (value - d0) / span;
    // D3: x < 0 ? -sqrt(-x) : sqrt(x)
    const st = t < 0 ? -Math.sqrt(-t) : Math.sqrt(t);
    let result = r0 + st * (r1 - r0);
    if (clamp) {
      const lo = Math.min(r0, r1);
      const hi = Math.max(r0, r1);
      result = Math.max(lo, Math.min(hi, result));
    }
    return result;
  };
}

// ORDINAL SCALE

/**
 * Maps a discrete domain to a discrete range, cycling through range values
 * if the domain is larger than the range — D3 scaleOrdinal parity.
 */
export function ordinal<R>(
  domain: ReadonlyArray<string>,
  range: ReadonlyArray<R>,
): (value: string) => R {
  const index = new Map(domain.map((d, i) => [d, i]));
  const n = range.length;
  return (value: string): R => {
    const i = index.get(value) ?? 0;
    return range[i % n] as R;
  };
}

// POINT SCALE — D3 scalePoint parity (band with paddingInner=1)

export type PointScale = Readonly<{
  position: (value: string) => number;
  step: number;
  domain: ReadonlyArray<string>;
}>;

export function point(config: {
  domain: ReadonlyArray<string>;
  range: readonly [number, number];
  padding?: number;
}): PointScale {
  const {
    domain,
    range: [r0, r1],
    padding = 0.5,
  } = config;
  const n = domain.length;
  const step = n <= 1 ? 0 : (r1 - r0) / Math.max(1, n - 1 + padding * 2);
  const start = r0 + padding * step;
  const index = new Map(domain.map((d, i) => [d, i]));
  return {
    position: (value: string): number => start + (index.get(value) ?? 0) * step,
    step,
    domain,
  };
}

// BAND SCALE

export type BandScaleConfig = Readonly<{
  domain: ReadonlyArray<string>;
  range: readonly [number, number];
  paddingInner?: number;
  paddingOuter?: number;
}>;

export type BandScale = Readonly<{
  position: (value: string) => number;
  bandwidth: number;
  step: number;
  domain: ReadonlyArray<string>;
}>;

export function band(config: BandScaleConfig): BandScale {
  const {
    domain,
    range: [r0, r1],
    paddingInner = 0.1,
    paddingOuter = 0.1,
  } = config;
  const n = domain.length;
  const step = (r1 - r0) / Math.max(1, n - paddingInner + paddingOuter * 2);
  const bandwidth = step * (1 - paddingInner);
  const start = r0 + paddingOuter * step;
  const index = new Map(domain.map((d, i) => [d, i]));

  return {
    position: (value: string): number => start + (index.get(value) ?? 0) * step,
    bandwidth,
    step,
    domain,
  };
}

// LOG SCALE — D3 scaleLog parity (d3-scale/src/log.js)

export type LogScaleConfig = Readonly<{
  domain: readonly [number, number];
  range: readonly [number, number];
  base?: number;
  clamp?: boolean;
}>;

export function log(config: LogScaleConfig): (value: number) => number {
  const [d0, d1] = config.domain;
  const [r0, r1] = config.range;
  const base = config.base ?? 10;
  const clamp = config.clamp ?? false;
  const logBase = Math.log(base);
  const logFn = (x: number) => Math.log(x) / logBase;

  const ld0 = logFn(d0);
  const ld1 = logFn(d1);
  const k = (r1 - r0) / (ld1 - ld0);

  return (value: number): number => {
    let t = (logFn(value) - ld0) * k + r0;
    if (clamp) t = r1 > r0 ? Math.max(r0, Math.min(r1, t)) : Math.max(r1, Math.min(r0, t));
    return t;
  };
}

/** Ticks at each power of base within [domain[0], domain[1]]. */
export function logTicks(domain: readonly [number, number], base = 10): ReadonlyArray<number> {
  const [d0, d1] = domain;
  const logBase = Math.log(base);
  const e0 = Math.floor(Math.log(d0) / logBase);
  const e1 = Math.ceil(Math.log(d1) / logBase);
  const ticks: number[] = [];
  for (let e = e0; e <= e1; e++) {
    const t = base ** e;
    if (t >= d0 && t <= d1) ticks.push(t);
  }
  return ticks;
}

// THRESHOLD SCALE — D3 scaleThreshold parity (d3-scale/src/threshold.js)
// Bisect-right: maps a numeric value to the corresponding range bucket.
// domain has n values; range must have n+1 entries.
export function threshold<T>(
  domain: ReadonlyArray<number>,
  range: ReadonlyArray<T>,
): (value: number) => T | undefined {
  return (value: number): T | undefined => {
    let lo = 0;
    let hi = domain.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((domain[mid] ?? 0) <= value) lo = mid + 1;
      else hi = mid;
    }
    return range[lo];
  };
}
