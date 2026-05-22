// D3 parity: d3-array/src/quantile.js (linear interpolation, method R-7)
export function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (p <= 0 || n < 2) return sorted[0] as number;
  if (p >= 1) return sorted[n - 1] as number;
  const i = (n - 1) * p;
  const lo = Math.floor(i);
  const h = i - lo;
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
  const min = sorted[0] as number;
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
