/** Round to 3 decimal places — keeps SVG attribute strings short. */
export const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Returns a [min, max] domain with symmetric padding applied as a fraction of
 * the range. e.g. extentWithPadding([0, 100], 0.1) → [0, 110].
 * min is clamped to 0 when the raw min is 0 (the common case for counts/values).
 */
export function extentWithPadding(
  values: ReadonlyArray<number>,
  pad = 0.1,
): readonly [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) return [0, 1];
  const range = max - min;
  const rawMin = min === 0 ? 0 : min - range * pad;
  const rawMax = max + range * pad;
  return [rawMin, rawMax];
}
