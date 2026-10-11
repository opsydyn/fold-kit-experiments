export type XInspectionAccessors<T> = Readonly<{
  key: (datum: T, index: number) => string;
  x: (datum: T, index: number) => number;
}>;

/** Return an original observation; equal distances choose the lexicographically smaller key. */
export function nearestByX<T>(
  data: ReadonlyArray<T>,
  accessors: XInspectionAccessors<T>,
  x: number,
): T | null {
  if (!Number.isFinite(x)) throw new RangeError('Inspection coordinate must be finite');
  const seen = new Set<string>();
  let best: { datum: T; key: string; x: number } | null = null;
  for (const [index, datum] of data.entries()) {
    const key = accessors.key(datum, index);
    const value = accessors.x(datum, index);
    if (key.length === 0 || seen.has(key) || !Number.isFinite(value))
      throw new RangeError('Observations require unique non-empty keys and finite coordinates');
    seen.add(key);
    if (best === null) {
      best = { datum, key, x: value };
      continue;
    }
    let distance = Math.abs(value - x),
      bestDistance = Math.abs(best.x - x);
    // Only rescale when subtraction overflows; ordinary/subnormal precision is retained.
    if (!Number.isFinite(distance) || !Number.isFinite(bestDistance)) {
      distance = Math.abs(value / 2 - x / 2);
      bestDistance = Math.abs(best.x / 2 - x / 2);
    }
    if (distance < bestDistance || (distance === bestDistance && key < best.key))
      best = { datum, key, x: value };
  }
  return best === null ? null : best.datum;
}
