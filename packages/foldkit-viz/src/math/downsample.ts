/**
 * Downsampling for long series, so a chart draws thousands of points instead
 * of millions without losing the shape a reader would see.
 *
 * Both functions take data in increasing x order, drop non-finite points and
 * return original rows in their original order, so keys and tooltips survive.
 */

export type DownsampleAccessors<T> = Readonly<{
  x: (datum: T, index: number) => number;
  y: (datum: T, index: number) => number;
}>;

type Sample<T> = Readonly<{ datum: T; x: number; y: number }>;

function finiteSamples<T>(
  data: ReadonlyArray<T>,
  accessors: DownsampleAccessors<T>,
): ReadonlyArray<Sample<T>> {
  const samples = data
    .map((datum, index) => ({ datum, x: accessors.x(datum, index), y: accessors.y(datum, index) }))
    .filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y));
  samples.forEach((s, i) => {
    if (i > 0 && s.x < (samples[i - 1]?.x ?? -Infinity))
      throw new RangeError('Downsampling needs data in increasing x order');
  });
  return samples;
}

/**
 * Largest-Triangle-Three-Buckets (Steinarsson, 2013): keeps the first and last
 * points, and from each bucket between them the point forming the largest
 * triangle with the previous pick and the next bucket's average. Returns
 * `threshold` points, or the data unchanged when it has no more than that.
 */
export function lttb<T>(
  data: ReadonlyArray<T>,
  accessors: DownsampleAccessors<T>,
  threshold: number,
): ReadonlyArray<T> {
  if (!Number.isInteger(threshold) || threshold < 3)
    throw new RangeError('LTTB threshold must be an integer of at least three');
  const samples = finiteSamples(data, accessors);
  if (samples.length <= threshold) return samples.map((s) => s.datum);
  const picked: Sample<T>[] = [];
  const first = samples[0],
    last = samples[samples.length - 1];
  if (first === undefined || last === undefined) return [];
  picked.push(first);
  const every = (samples.length - 2) / (threshold - 2);
  let previous = first;
  for (let bucket = 0; bucket < threshold - 2; bucket += 1) {
    const start = Math.floor(bucket * every) + 1;
    const end = Math.floor((bucket + 1) * every) + 1;
    const nextEnd = Math.min(Math.floor((bucket + 2) * every) + 1, samples.length);
    let avgX = 0,
      avgY = 0;
    const nextStart = end;
    const nextCount = Math.max(1, nextEnd - nextStart);
    for (let i = nextStart; i < nextEnd; i += 1) {
      avgX += samples[i]?.x ?? 0;
      avgY += samples[i]?.y ?? 0;
    }
    if (nextEnd <= nextStart) {
      avgX = last.x;
      avgY = last.y;
    } else {
      avgX /= nextCount;
      avgY /= nextCount;
    }
    let best = samples[start] ?? last;
    let bestArea = -1;
    for (let i = start; i < end; i += 1) {
      const s = samples[i];
      if (s === undefined) continue;
      const area = Math.abs(
        (previous.x - avgX) * (s.y - previous.y) - (previous.x - s.x) * (avgY - previous.y),
      );
      if (area > bestArea) {
        bestArea = area;
        best = s;
      }
    }
    picked.push(best);
    previous = best;
  }
  picked.push(last);
  return picked.map((s) => s.datum);
}

/**
 * M4 aggregation (Jugel et al., 2014): split x into `width` equal columns,
 * one per pixel, and keep each column's first, last, lowest and highest
 * point. A line drawn through the result is pixel-identical to the full line
 * at that width.
 */
export function m4<T>(
  data: ReadonlyArray<T>,
  accessors: DownsampleAccessors<T>,
  options: Readonly<{ width: number }>,
): ReadonlyArray<T> {
  const { width } = options;
  if (!Number.isInteger(width) || width < 1)
    throw new RangeError('M4 width must be a positive integer of pixel columns');
  const samples = finiteSamples(data, accessors);
  const first = samples[0],
    last = samples[samples.length - 1];
  if (first === undefined || last === undefined) return [];
  const span = last.x - first.x;
  const column = (x: number): number =>
    span === 0 ? 0 : Math.min(width - 1, Math.floor(((x - first.x) / span) * width));
  const keep = new Set<number>();
  let start = 0;
  while (start < samples.length) {
    const col = column(samples[start]?.x ?? 0);
    let end = start,
      low = start,
      high = start;
    while (end + 1 < samples.length && column(samples[end + 1]?.x ?? 0) === col) {
      end += 1;
      if ((samples[end]?.y ?? 0) < (samples[low]?.y ?? 0)) low = end;
      if ((samples[end]?.y ?? 0) > (samples[high]?.y ?? 0)) high = end;
    }
    for (const index of [start, low, high, end]) keep.add(index);
    start = end + 1;
  }
  return [...keep]
    .sort((a, b) => a - b)
    .flatMap((index) => {
      const sample = samples[index];
      return sample === undefined ? [] : [sample.datum];
    });
}
