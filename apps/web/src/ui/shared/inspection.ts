export type KeyedPoint = Readonly<{ id: string; x: number; y: number; label: string }>;

export type Inspection =
  | { _tag: 'Point'; key: string }
  | { _tag: 'Range'; lower: number; upper: number; includeEnd: boolean };

function validateIds(points: ReadonlyArray<KeyedPoint>): void {
  const seen = new Set<string>();
  for (const point of points) {
    if (point.id.length === 0 || seen.has(point.id)) {
      throw new RangeError('Inspection requires non-empty, unique point IDs');
    }
    seen.add(point.id);
  }
}

export function containsValue(value: number, lo: number, hi: number, includeEnd: boolean): boolean {
  return (value >= lo && value < hi) || (includeEnd && value === hi);
}

export function matchingKeys(
  points: ReadonlyArray<KeyedPoint>,
  inspection: Inspection,
): ReadonlyArray<string> {
  validateIds(points);
  return points
    .filter((point) =>
      inspection._tag === 'Point'
        ? point.id === inspection.key
        : Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          containsValue(point.y, inspection.lower, inspection.upper, inspection.includeEnd),
    )
    .map((point) => point.id);
}

export function matchingBinIndices(
  points: ReadonlyArray<KeyedPoint>,
  keys: ReadonlyArray<string>,
  bins: ReadonlyArray<{ x0: number; x1: number }>,
): ReadonlyArray<number> {
  validateIds(points);
  const selected = new Set(keys);
  return bins.flatMap((bin, index) =>
    points.some(
      (point) =>
        selected.has(point.id) && containsValue(point.y, bin.x0, bin.x1, index === bins.length - 1),
    )
      ? [index]
      : [],
  );
}
