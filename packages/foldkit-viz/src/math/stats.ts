// D3 parity: d3-array/src/quantile.js (linear interpolation, method R-7)
export function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (p <= 0 || n < 2) {
    // SAFETY: A non-empty sorted input has an element at index zero.
    return sorted[0] as number;
  }
  if (p >= 1) {
    // SAFETY: A sorted input with at least two elements has an element at its final index.
    return sorted[n - 1] as number;
  }
  const i = (n - 1) * p;
  const lo = Math.floor(i);
  const h = i - lo;
  // SAFETY: The chart algorithm establishes this representation before the assertion.
  return (sorted[lo] as number) * (1 - h) + (sorted[lo + 1] as number) * h;
}

export interface BoxStats {
  readonly min: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly max: number;
  readonly iqr: number;
  readonly fenceLow: number;
  readonly fenceHigh: number;
  readonly outliers: readonly number[];
}

// KDE — Epanechnikov kernel density estimation

export type DensityPoint = Readonly<{ value: number; density: number }>;

function epanechnikov(u: number): number {
  return Math.abs(u) <= 1 ? 0.75 * (1 - u * u) : 0;
}

// Silverman's rule of thumb for bandwidth selection
export function silvermanBandwidth(values: ReadonlyArray<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n < 2) return 1;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const sigma = Math.sqrt(variance);
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const s = Math.min(sigma, iqr / 1.34);
  return 0.9 * s * n ** -0.2;
}

// Evaluate KDE at each threshold using Epanechnikov kernel
export function kde(
  data: ReadonlyArray<number>,
  thresholds: ReadonlyArray<number>,
  bandwidth: number,
): ReadonlyArray<DensityPoint> {
  const n = data.length;
  const h = bandwidth > 0 ? bandwidth : 1;
  return thresholds.map((t) => {
    let sum = 0;
    for (const x of data) sum += epanechnikov((t - x) / h);
    return { value: t, density: sum / (n * h) };
  });
}

export function boxStats(values: readonly number[]): BoxStats {
  const sorted = [...values].sort((a, b) => a - b);
  // SAFETY: The chart algorithm establishes this representation before the assertion.
  const min = sorted[0] as number;
  // SAFETY: The chart algorithm establishes this representation before the assertion.
  const max = sorted[sorted.length - 1] as number;
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const fenceLow = Math.max(min, q1 - 1.5 * iqr);
  const fenceHigh = Math.min(max, q3 + 1.5 * iqr);
  const outliers = sorted.filter((v) => v < fenceLow || v > fenceHigh);
  return { min, q1, median, q3, max, iqr, fenceLow, fenceHigh, outliers };
}

// ── Distribution quantiles ────────────────────────────────────────────────────

const probability = (p: number): number => {
  if (!(p > 0 && p < 1)) throw new RangeError('Probability must be strictly between 0 and 1');
  return p;
};

// Acklam's rational approximation to the inverse normal CDF (relative error
// below 1.2e-9). https://web.archive.org/web/2007/home.online.no/~pjacklam/notes/invnorm/
const A = [
  -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
  2.506628277459239,
];
const B = [
  -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572,
];
const C = [
  -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
];
const D = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];

const polynomial = (coefficients: ReadonlyArray<number>, x: number): number =>
  coefficients.reduce((sum, c) => sum * x + c, 0);

/** The standard normal quantile: the z with P(Z <= z) = p. */
export function normalQuantile(p: number): number {
  probability(p);
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return polynomial(C, q) / (polynomial(D, q) * q + 1);
  }
  if (p > 1 - low) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (polynomial(A, r) * q) / (polynomial(B, r) * r + 1);
}

// Lanczos approximation to ln Γ(x), g = 7, n = 9.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];
function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  const z = x - 1;
  let sum = LANCZOS[0] ?? 0;
  for (let i = 1; i < LANCZOS.length; i += 1) sum += (LANCZOS[i] ?? 0) / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betaFraction(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const step = d * c;
    h *= step;
    if (Math.abs(step - 1) < 1e-15) break;
  }
  return h;
}

/** The regularised incomplete beta function I_x(a, b). */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaFraction(a, b, x)) / a
    : 1 - (front * betaFraction(b, a, 1 - x)) / b;
}

/** P(T <= t) for Student's t with `df` degrees of freedom. */
function studentTCdf(t: number, df: number): number {
  const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Student's t quantile: the t with P(T <= t) = p for `df` degrees of freedom. */
export function studentTQuantile(p: number, df: number): number {
  probability(p);
  if (!Number.isFinite(df) || df <= 0)
    throw new RangeError('Degrees of freedom must be finite and positive');
  if (p === 0.5) return 0;
  if (p < 0.5) return -studentTQuantile(1 - p, df);
  let hi = 1;
  while (studentTCdf(hi, df) < p) hi *= 2;
  let lo = 0;
  for (let i = 0; i < 200 && hi - lo > 1e-12 * hi; i += 1) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── Empirical distribution ────────────────────────────────────────────────────

export type EcdfStep = Readonly<{ x: number; p: number }>;

/** Empirical CDF: one step per distinct finite value, p the share of values at or below it. */
export function ecdf(values: ReadonlyArray<number>): ReadonlyArray<EcdfStep> {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const steps: EcdfStep[] = [];
  sorted.forEach((x, index) => {
    if (sorted[index + 1] !== x) steps.push({ x, p: (index + 1) / sorted.length });
  });
  return steps;
}

export type QuantilePair = Readonly<{ theoretical: number; sample: number }>;

/** Normal QQ pairs: sorted finite samples against normal quantiles at (i - 0.5) / n. */
export function qqNormal(values: ReadonlyArray<number>): ReadonlyArray<QuantilePair> {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.map((sample, index) => ({
    theoretical: normalQuantile((index + 0.5) / sorted.length),
    sample,
  }));
}

// ── Moving windows ────────────────────────────────────────────────────────────

export type WindowReducer = 'mean' | 'median' | 'sum' | 'min' | 'max';
export type MovingWindowOptions = Readonly<{
  size: number;
  reduce: WindowReducer;
  /** Trailing windows end at each value; centred windows surround it. Default trailing. */
  anchor?: 'trailing' | 'centre';
  /** Shrink windows at the edges instead of leaving them undefined. Default false. */
  partial?: boolean;
}>;

const reducers = {
  mean: (w) => w.reduce((s, v) => s + v, 0) / w.length,
  sum: (w) => w.reduce((s, v) => s + v, 0),
  min: (w) => Math.min(...w),
  max: (w) => Math.max(...w),
  median: (w) =>
    quantile(
      [...w].sort((a, b) => a - b),
      0.5,
    ),
} satisfies Readonly<Record<WindowReducer, (window: ReadonlyArray<number>) => number>>;

/**
 * Reduces a sliding window at each position. Incomplete windows, and windows
 * holding a non-finite value, are NaN, which charts omit and lines break at.
 */
export function movingWindow(
  values: ReadonlyArray<number>,
  options: MovingWindowOptions,
): ReadonlyArray<number> {
  const { size } = options;
  if (!Number.isInteger(size) || size < 1)
    throw new RangeError('Window size must be a positive integer');
  const before = options.anchor === 'centre' ? Math.floor((size - 1) / 2) : size - 1;
  const after = size - 1 - before;
  const reduce = reducers[options.reduce];
  return values.map((_, index) => {
    const start = index - before,
      end = index + after;
    if (!options.partial && (start < 0 || end >= values.length)) return Number.NaN;
    const span = values.slice(Math.max(0, start), Math.min(values.length, end + 1));
    return span.every(Number.isFinite) ? reduce(span) : Number.NaN;
  });
}
