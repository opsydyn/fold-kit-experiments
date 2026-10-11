import { area } from '../shape/area.js';
import { finiteCoordinate } from './layout.js';
import type { CartesianLayout } from './layout.js';
export type IntervalBandAccessors<T> = Readonly<{
  x: (datum: T, index: number) => number;
  lower: (datum: T, index: number) => number;
  upper: (datum: T, index: number) => number;
  datumKey: (datum: T, index: number) => string;
}>;
export type IntervalBandPoint<T> = Readonly<{
  datum: T;
  key: string;
  x: number;
  lowerY: number;
  upperY: number;
}>;
export type IntervalBandGeometry<T> = Readonly<{
  points: ReadonlyArray<IntervalBandPoint<T>>;
  path: string | null;
}>;

/** Project one ordered interval run. Bounds are supplied; no statistics are inferred. */
export function intervalBandGeometry<T>(
  data: ReadonlyArray<T>,
  accessors: IntervalBandAccessors<T>,
  layout: CartesianLayout,
): IntervalBandGeometry<T> {
  const keys = new Set<string>();
  let previousX = -Infinity;
  const points = data.map((datum, index) => {
    const x = accessors.x(datum, index),
      lower = accessors.lower(datum, index),
      upper = accessors.upper(datum, index),
      key = accessors.datumKey(datum, index);
    if (
      ![x, lower, upper].every(Number.isFinite) ||
      x <= previousX ||
      lower > upper ||
      key.length === 0 ||
      keys.has(key)
    )
      throw new RangeError(
        'Band requires ordered finite X, valid bounds and unique non-empty keys',
      );
    previousX = x;
    keys.add(key);
    return {
      datum,
      key,
      x: finiteCoordinate(layout.x(x)),
      lowerY: finiteCoordinate(layout.y(lower)),
      upperY: finiteCoordinate(layout.y(upper)),
    };
  });
  // D3 area: upper boundary forwards, lower boundary reversed, one closed run.
  const path =
    points.length < 2
      ? null
      : area(
          points.map((p) => [p.x, p.upperY] as const),
          points.map((p) => [p.x, p.lowerY] as const),
          { curve: 'linear' },
        );
  if (path !== null && /Infinity|NaN/.test(path))
    throw new RangeError('Band path cannot serialise projected coordinates finitely');
  return { points, path };
}
