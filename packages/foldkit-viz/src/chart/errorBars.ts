import { finiteCoordinate } from './layout.js';
import type { CartesianLayout } from './layout.js';

export type ErrorBarAccessors<T> = Readonly<{
  position: (datum: T, index: number) => number;
  lower: (datum: T, index: number) => number;
  upper: (datum: T, index: number) => number;
  datumKey: (datum: T, index: number) => string;
}>;
export type ErrorBarSegment = Readonly<{
  start: readonly [number, number];
  end: readonly [number, number];
}>;
export type ErrorBarMark<T> = Readonly<{
  datum: T;
  key: string;
  stem: ErrorBarSegment;
  lowerCap: ErrorBarSegment;
  upperCap: ErrorBarSegment;
}>;

/** Independent straight segments, as in D3 curve/linear. Bounds are supplied, not inferred. */
export function errorBarGeometry<T>(
  data: ReadonlyArray<T>,
  accessors: ErrorBarAccessors<T>,
  layout: CartesianLayout,
  options: Readonly<{ axis: 'x' | 'y'; capSize: number }>,
): ReadonlyArray<ErrorBarMark<T>> {
  const { axis, capSize } = options;
  if ((axis !== 'x' && axis !== 'y') || !Number.isFinite(capSize) || capSize < 0)
    throw new RangeError('Error bars require an x/y axis and finite non-negative cap size');
  const keys = new Set<string>();
  const half = capSize / 2;
  return data.map((datum, index) => {
    const position = accessors.position(datum, index),
      lower = accessors.lower(datum, index),
      upper = accessors.upper(datum, index),
      key = accessors.datumKey(datum, index);
    if (
      ![position, lower, upper].every(Number.isFinite) ||
      lower > upper ||
      key.length === 0 ||
      keys.has(key)
    )
      throw new RangeError(
        'Error bars require finite positions, ordered bounds and unique non-empty keys',
      );
    keys.add(key);
    const orthogonal = finiteCoordinate(axis === 'y' ? layout.x(position) : layout.y(position));
    const lo = finiteCoordinate(axis === 'y' ? layout.y(lower) : layout.x(lower));
    const hi = finiteCoordinate(axis === 'y' ? layout.y(upper) : layout.x(upper));
    const before = finiteCoordinate(orthogonal - half),
      after = finiteCoordinate(orthogonal + half);
    return axis === 'y'
      ? {
          datum,
          key,
          stem: { start: [orthogonal, lo], end: [orthogonal, hi] },
          lowerCap: { start: [before, lo], end: [after, lo] },
          upperCap: { start: [before, hi], end: [after, hi] },
        }
      : {
          datum,
          key,
          stem: { start: [lo, orthogonal], end: [hi, orthogonal] },
          lowerCap: { start: [lo, before], end: [lo, after] },
          upperCap: { start: [hi, before], end: [hi, after] },
        };
  });
}
