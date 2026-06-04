// Bin quantitative values into consecutive non-overlapping intervals.
// Ported from d3-array/src/bin.js — functional API (no method chaining).

import { linearTicks } from './scale.js';

export type Bin<T = number> = Readonly<{
  values: ReadonlyArray<T>;
  x0: number;
  x1: number;
  count: number;
}>;

export type BinConfig<T = number> = Readonly<{
  /** Extract a numeric value from each datum. Defaults to identity. */
  value?: (datum: T, index: number) => number;
  /** Explicit [min, max] domain. Defaults to the extent of the values. */
  domain?: readonly [number, number];
  /**
   * Threshold breakpoints between bins.
   * - A number `n` → approximately `n` uniformly-spaced thresholds (via linearTicks).
   * - An explicit array → use those values as breakpoints.
   * Defaults to 10 auto thresholds.
   */
  thresholds?: number | ReadonlyArray<number>;
}>;

function valuesExtent(values: ReadonlyArray<number>): readonly [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/**
 * Bins an array of data into consecutive non-overlapping intervals.
 * Each bin contains the values that fall within its [x0, x1] range.
 * The first bin's lower bound and last bin's upper bound are inclusive;
 * interior boundaries are exclusive on the left, matching D3 parity.
 */
export function bin<T = number>(
  data: ReadonlyArray<T>,
  config: BinConfig<T> = {},
): ReadonlyArray<Bin<T>> {
  const accessor = config.value ?? ((d: T) => d as unknown as number);
  const values = data.map((d, i) => accessor(d, i));

  const [domainMin, domainMax] = config.domain ?? valuesExtent(values);
  if (!Number.isFinite(domainMin) || !Number.isFinite(domainMax)) return [];

  // Compute threshold breakpoints, excluding the domain endpoints
  let thresholds: ReadonlyArray<number>;
  if (config.thresholds === undefined || typeof config.thresholds === 'number') {
    const count = typeof config.thresholds === 'number' ? config.thresholds : 10;
    thresholds = linearTicks([domainMin, domainMax], count).filter(
      (t) => t > domainMin && t < domainMax,
    );
  } else {
    thresholds = (config.thresholds as ReadonlyArray<number>).filter(
      (t) => t > domainMin && t < domainMax,
    );
  }

  const n = thresholds.length;
  const buckets: Array<T[]> = Array.from({ length: n + 1 }, () => []);

  for (let i = 0; i < data.length; i++) {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v as number)) continue;
    if ((v as number) < domainMin || (v as number) > domainMax) continue;

    // Bisect right: find the first threshold strictly greater than v
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((v as number) >= (thresholds[mid] as number)) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    (buckets[lo] as T[]).push(data[i] as T);
  }

  return buckets.map((bucket, i) => {
    const x0 = i === 0 ? domainMin : (thresholds[i - 1] as number);
    const x1 = i === n ? domainMax : (thresholds[i] as number);
    return { values: bucket, x0, x1, count: bucket.length };
  });
}
