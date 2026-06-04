// ── Reduction ─────────────────────────────────────────────────────────────────

export function extent<T>(
  values: ReadonlyArray<T>,
  accessor?: (v: T) => number,
): readonly [number, number] | readonly [undefined, undefined] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    const n = accessor ? accessor(v) : (v as unknown as number);
    if (n < lo) lo = n;
    if (n > hi) hi = n;
  }
  if (!Number.isFinite(lo)) return [undefined, undefined] as const;
  return [lo, hi] as const;
}

export function sum<T>(values: ReadonlyArray<T>, accessor?: (v: T) => number): number {
  let s = 0;
  for (const v of values) s += accessor ? accessor(v) : (v as unknown as number);
  return s;
}

export function mean<T>(values: ReadonlyArray<T>, accessor?: (v: T) => number): number {
  if (values.length === 0) return Number.NaN;
  return sum(values, accessor) / values.length;
}

export function median<T>(values: ReadonlyArray<T>, accessor?: (v: T) => number): number {
  const ns = [...values]
    .map(accessor ? accessor : (v) => v as unknown as number)
    .sort((a, b) => a - b);
  const m = ns.length;
  if (m === 0) return Number.NaN;
  const mid = m >> 1;
  return m & 1 ? (ns[mid] as number) : ((ns[mid - 1] as number) + (ns[mid] as number)) / 2;
}

export function variance<T>(values: ReadonlyArray<T>, accessor?: (v: T) => number): number {
  if (values.length < 2) return Number.NaN;
  const mu = mean(values, accessor);
  let s = 0;
  for (const v of values) {
    const d = (accessor ? accessor(v) : (v as unknown as number)) - mu;
    s += d * d;
  }
  return s / (values.length - 1);
}

export function deviation<T>(values: ReadonlyArray<T>, accessor?: (v: T) => number): number {
  return Math.sqrt(variance(values, accessor));
}

// ── Running totals ─────────────────────────────────────────────────────────────

export function cumsum<T>(
  values: ReadonlyArray<T>,
  accessor?: (v: T) => number,
): ReadonlyArray<number> {
  const result: number[] = [];
  let acc = 0;
  for (const v of values) {
    acc += accessor ? accessor(v) : (v as unknown as number);
    result.push(acc);
  }
  return result;
}

// ── Grouping ──────────────────────────────────────────────────────────────────

export function group<T, K>(values: ReadonlyArray<T>, key: (v: T) => K): Map<K, ReadonlyArray<T>> {
  const map = new Map<K, T[]>();
  for (const v of values) {
    const k = key(v);
    const arr = map.get(k);
    if (arr) arr.push(v);
    else map.set(k, [v]);
  }
  return map as Map<K, ReadonlyArray<T>>;
}

export function rollup<T, K, R>(
  values: ReadonlyArray<T>,
  reduce: (group: ReadonlyArray<T>) => R,
  key: (v: T) => K,
): Map<K, R> {
  const grouped = group(values, key);
  const result = new Map<K, R>();
  for (const [k, g] of grouped) result.set(k, reduce(g));
  return result;
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Returns the index of the first value in `sorted` greater than `value`.
 * Equivalent to D3's `bisectRight` — the default `d3.bisect`.
 */
export function bisect(sorted: ReadonlyArray<number>, value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] as number) <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Returns the index of the first value in `sorted` greater than or equal to `value`.
 * Equivalent to D3's `bisectLeft`.
 */
export function bisectLeft(sorted: ReadonlyArray<number>, value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ── Combinatorial ─────────────────────────────────────────────────────────────

export function pairs<T>(values: ReadonlyArray<T>): ReadonlyArray<readonly [T, T]> {
  const result: Array<readonly [T, T]> = [];
  for (let i = 1; i < values.length; i++) {
    result.push([values[i - 1] as T, values[i] as T]);
  }
  return result;
}

export function zip<A, B>(
  a: ReadonlyArray<A>,
  b: ReadonlyArray<B>,
): ReadonlyArray<readonly [A, B]> {
  const len = Math.min(a.length, b.length);
  const result: Array<readonly [A, B]> = [];
  for (let i = 0; i < len; i++) result.push([a[i] as A, b[i] as B]);
  return result;
}

// ── Range ─────────────────────────────────────────────────────────────────────

/** Generate an array of `count` evenly-spaced values from `start` to `stop` (inclusive). */
export function range(start: number, stop: number, step = 1): ReadonlyArray<number> {
  const result: number[] = [];
  for (let i = start; step > 0 ? i <= stop : i >= stop; i += step) result.push(i);
  return result;
}
