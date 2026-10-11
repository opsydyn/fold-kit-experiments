export type SegmentAccessors<T> = Readonly<{
  x: (datum: T, index: number) => number;
  defined: (datum: T, index: number) => boolean;
  connect: (previous: T, next: T) => boolean;
}>;

/** Contiguous caller-defined runs, without sorting, mutation or gap inference. */
export function contiguousRuns<T>(
  data: ReadonlyArray<T>,
  accessors: SegmentAccessors<T>,
): ReadonlyArray<ReadonlyArray<T>> {
  let previousX = -Infinity;
  for (const [index, datum] of data.entries()) {
    const x = accessors.x(datum, index);
    if (!Number.isFinite(x) || x <= previousX)
      throw new RangeError('Run X values must be finite and strictly increasing');
    previousX = x;
  }
  const runs: T[][] = [];
  let current: T[] = [];
  let previous: Readonly<{ datum: T }> | null = null;
  for (const [index, datum] of data.entries()) {
    if (!accessors.defined(datum, index)) {
      current = [];
      previous = null;
      continue;
    }
    if (current.length === 0 || (previous !== null && !accessors.connect(previous.datum, datum))) {
      current = [];
      runs.push(current);
    }
    current.push(datum);
    previous = { datum };
  }
  return runs;
}
