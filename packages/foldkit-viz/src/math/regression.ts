import { studentTQuantile } from './stats.js';

/**
 * Least-squares and locally weighted regression for chart overlays.
 *
 * Non-finite pairs are skipped. Fits are computed on centred and scaled x, so
 * large x values such as epoch milliseconds stay accurate; `coefficients` are
 * still reported for the original x, lowest power first.
 */

export type RegressionAccessors<T> = Readonly<{
  x: (datum: T, index: number) => number;
  y: (datum: T, index: number) => number;
}>;

export type ConfidenceInterval = Readonly<{ fit: number; lower: number; upper: number }>;

export type RegressionFit = Readonly<{
  degree: number;
  /** Polynomial coefficients in x, lowest power first. */
  coefficients: ReadonlyArray<number>;
  n: number;
  rSquared: number;
  residualStandardError: number;
  predict: (x: number) => number;
  /** Confidence interval for the fitted mean at x. Default level 0.95. */
  interval: (x: number, level?: number) => ConfidenceInterval;
}>;

const pairsOf = <T>(data: ReadonlyArray<T>, accessors: RegressionAccessors<T>) =>
  data
    .map((datum, index) => ({ x: accessors.x(datum, index), y: accessors.y(datum, index) }))
    .filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y));

/** Gauss–Jordan inverse with partial pivoting; throws on a singular matrix. */
function invert(
  matrix: ReadonlyArray<ReadonlyArray<number>>,
): ReadonlyArray<ReadonlyArray<number>> {
  const size = matrix.length;
  const rows = matrix.map((row, i) => [...row, ...matrix.map((_, j) => (i === j ? 1 : 0))]);
  const scale = Math.max(...matrix.flat().map(Math.abs), 1);
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < size; r += 1)
      if (Math.abs(rows[r]?.[col] ?? 0) > Math.abs(rows[pivot]?.[col] ?? 0)) pivot = r;
    const pivotRow = rows[pivot] ?? [];
    const value = pivotRow[col] ?? 0;
    if (Math.abs(value) < 1e-12 * scale)
      throw new RangeError('Regression is singular: x needs more distinct values for this degree');
    rows[pivot] = rows[col] ?? [];
    rows[col] = pivotRow.map((v) => v / value);
    for (let r = 0; r < size; r += 1) {
      if (r === col) continue;
      const factor = rows[r]?.[col] ?? 0;
      rows[r] = (rows[r] ?? []).map((v, c) => v - factor * (rows[col]?.[c] ?? 0));
    }
  }
  return rows.map((row) => row.slice(size));
}

const binomial = (n: number, k: number): number => {
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return result;
};

/** Least-squares polynomial fit of the given degree, with confidence intervals for the mean. */
export function polynomialRegression<T>(
  data: ReadonlyArray<T>,
  accessors: RegressionAccessors<T>,
  options: Readonly<{ degree: number }>,
): RegressionFit {
  const { degree } = options;
  if (!Number.isInteger(degree) || degree < 1)
    throw new RangeError('Regression degree must be a positive integer');
  const pairs = pairsOf(data, accessors);
  const terms = degree + 1;
  if (pairs.length <= terms)
    throw new RangeError(`A degree ${degree} fit needs more than ${terms} points`);

  const mean = pairs.reduce((s, p) => s + p.x, 0) / pairs.length;
  const spread = Math.max(...pairs.map((p) => Math.abs(p.x - mean))) || 1;
  const basis = (x: number): ReadonlyArray<number> => {
    const u = (x - mean) / spread;
    return Array.from({ length: terms }, (_, k) => u ** k);
  };
  const rows = pairs.map((p) => basis(p.x));
  const normal = Array.from({ length: terms }, (_, i) =>
    Array.from({ length: terms }, (_, j) =>
      rows.reduce((s, r) => s + (r[i] ?? 0) * (r[j] ?? 0), 0),
    ),
  );
  const inverse = invert(normal);
  const moments = Array.from({ length: terms }, (_, i) =>
    rows.reduce((s, r, index) => s + (r[i] ?? 0) * (pairs[index]?.y ?? 0), 0),
  );
  const beta = inverse.map((row) => row.reduce((s, v, j) => s + v * (moments[j] ?? 0), 0));
  const evaluate = (x: number): number => basis(x).reduce((s, v, k) => s + v * (beta[k] ?? 0), 0);

  const meanY = pairs.reduce((s, p) => s + p.y, 0) / pairs.length;
  const sse = pairs.reduce((s, p) => s + (p.y - evaluate(p.x)) ** 2, 0);
  const sst = pairs.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const df = pairs.length - terms;
  const variance = sse / df;

  // Expand sum_k beta_k ((x - mean) / spread)^k into powers of x.
  const coefficients = Array.from({ length: terms }, (_, power) => {
    let sum = 0;
    for (let k = power; k < terms; k += 1)
      sum += ((beta[k] ?? 0) * binomial(k, power) * (-mean) ** (k - power)) / spread ** k;
    return sum;
  });

  return {
    degree,
    coefficients,
    n: pairs.length,
    rSquared: sst === 0 ? (sse === 0 ? 1 : 0) : 1 - sse / sst,
    residualStandardError: Math.sqrt(variance),
    predict: evaluate,
    interval: (x, level = 0.95) => {
      if (!(level > 0 && level < 1)) throw new RangeError('Confidence level must be in (0, 1)');
      const v = basis(x);
      const leverage = v.reduce(
        (s, vi, i) => s + vi * (inverse[i] ?? []).reduce((t, m, j) => t + m * (v[j] ?? 0), 0),
        0,
      );
      const half = studentTQuantile(1 - (1 - level) / 2, df) * Math.sqrt(variance * leverage);
      const fit = evaluate(x);
      return { fit, lower: fit - half, upper: fit + half };
    },
  };
}

/** Ordinary least-squares straight line: `coefficients` are [intercept, slope]. */
export function linearRegression<T>(
  data: ReadonlyArray<T>,
  accessors: RegressionAccessors<T>,
): RegressionFit {
  return polynomialRegression(data, accessors, { degree: 1 });
}

export type LoessOptions = Readonly<{
  /** Share of points in each local fit, in (0, 1]. Default 0.3. */
  bandwidth?: number;
  /** Robustness iterations that down-weight outliers. Default 2. */
  iterations?: number;
}>;

export type SmoothedPoint = Readonly<{ x: number; y: number }>;

const tricube = (u: number): number => (u >= 1 ? 0 : (1 - u ** 3) ** 3);
const bisquare = (u: number): number => (u >= 1 ? 0 : (1 - u * u) ** 2);

/**
 * Cleveland's LOESS: a weighted local linear fit at each point, with optional
 * robustness iterations. Returns the smoothed curve sorted by x.
 */
export function loess<T>(
  data: ReadonlyArray<T>,
  accessors: RegressionAccessors<T>,
  options: LoessOptions = {},
): ReadonlyArray<SmoothedPoint> {
  const bandwidth = options.bandwidth ?? 0.3;
  const iterations = options.iterations ?? 2;
  if (!(bandwidth > 0 && bandwidth <= 1)) throw new RangeError('LOESS bandwidth must be in (0, 1]');
  if (!Number.isInteger(iterations) || iterations < 0)
    throw new RangeError('LOESS iterations must be a non-negative integer');
  const pairs = pairsOf(data, accessors).sort((a, b) => a.x - b.x);
  const n = pairs.length;
  if (n < 2) return pairs;
  const span = Math.min(n, Math.max(2, Math.floor(bandwidth * n)));
  const xs = pairs.map((p) => p.x),
    ys = pairs.map((p) => p.y);
  let robustness: ReadonlyArray<number> = xs.map(() => 1);
  let fitted: number[] = [];

  // Weighted local linear fit at index i over its window; undefined when every
  // weight is zero.
  const localFit = (
    i: number,
    left: number,
    right: number,
    radius: number,
    weight: ReadonlyArray<number>,
  ): number | undefined => {
    const xi = xs[i] ?? 0;
    let sw = 0,
      swx = 0,
      swy = 0,
      swxx = 0,
      swxy = 0;
    for (let j = left; j <= right; j += 1) {
      const xj = xs[j] ?? 0,
        yj = ys[j] ?? 0;
      const w = (radius === 0 ? 1 : tricube(Math.abs(xj - xi) / radius)) * (weight[j] ?? 0);
      sw += w;
      swx += w * xj;
      swy += w * yj;
      swxx += w * xj * xj;
      swxy += w * xj * yj;
    }
    if (sw <= 0) return undefined;
    const mx = swx / sw,
      my = swy / sw;
    const varX = swxx / sw - mx * mx;
    const slope = Math.abs(varX) < 1e-12 * Math.max(1, mx * mx) ? 0 : (swxy / sw - mx * my) / varX;
    return my + slope * (xi - mx);
  };
  const unit = xs.map(() => 1);

  for (let pass = 0; pass <= iterations; pass += 1) {
    fitted = [];
    let left = 0;
    for (let i = 0; i < n; i += 1) {
      const xi = xs[i] ?? 0;
      // Slide the window of `span` nearest neighbours along the sorted xs.
      while (left + span < n && xi - (xs[left] ?? 0) > (xs[left + span] ?? 0) - xi) left += 1;
      const right = left + span - 1;
      const radius = Math.max(xi - (xs[left] ?? 0), (xs[right] ?? 0) - xi);
      // When robustness weights empty a window, fall back to distance weights
      // alone: falling back to the raw value would make an outlier fit itself.
      fitted.push(
        localFit(i, left, right, radius, robustness) ??
          localFit(i, left, right, radius, unit) ??
          ys[i] ??
          0,
      );
    }
    if (pass === iterations) break;
    const residuals = ys.map((y, i) => Math.abs(y - (fitted[i] ?? 0)));
    const sorted = [...residuals].sort((a, b) => a - b);
    const median = sorted[Math.floor((n - 1) / 2)] ?? 0;
    if (median === 0) break;
    robustness = residuals.map((r) => bisquare(r / (6 * median)));
  }
  return xs.map((x, i) => ({ x, y: fitted[i] ?? 0 }));
}
