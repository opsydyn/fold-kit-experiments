import { expect, test } from 'bun:test';

import { errorBarGeometry } from '../src/chart/errorBars';
import { chartLayout } from '../src/chart/layout';
const frame = { width: 100, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } };
const layout = chartLayout(frame, [0, 10], [-10, 10]);
const datum = { id: 'a', position: 2, lower: -2, upper: 4 };
const accessors = {
  position: (d: typeof datum) => d.position,
  lower: (d: typeof datum) => d.lower,
  upper: (d: typeof datum) => d.upper,
  datumKey: (d: typeof datum) => d.id,
};
test('projects Y interval through shared scales without serialisation', () => {
  const marks = errorBarGeometry(Object.freeze([datum]), accessors, layout, {
    axis: 'y',
    capSize: 8,
  });
  expect(marks).toHaveLength(1);
  expect(marks[0]).toEqual({
    datum,
    key: 'a',
    stem: { start: [20, 60], end: [20, 30] },
    lowerCap: { start: [16, 60], end: [24, 60] },
    upperCap: { start: [16, 30], end: [24, 30] },
  });
  expect(marks[0]?.datum).toBe(datum);
});
test('projects X interval with orthogonal caps', () => {
  const marks = errorBarGeometry([datum], accessors, chartLayout(frame, [-10, 10], [0, 10]), {
    axis: 'x',
    capSize: 8,
  });
  expect(marks[0]?.stem).toEqual({ start: [40, 80], end: [70, 80] });
  expect(marks[0]?.lowerCap).toEqual({ start: [40, 76], end: [40, 84] });
  expect(marks[0]?.upperCap).toEqual({ start: [70, 76], end: [70, 84] });
});
test('independent marks retain order repeated positions and accessor indices', () => {
  const b = { ...datum, id: 'b' };
  const calls: number[] = [];
  const marks = errorBarGeometry(
    [b, datum],
    {
      ...accessors,
      datumKey: (d, i) => {
        calls.push(i);
        return d.id;
      },
    },
    layout,
    { axis: 'y', capSize: 0 },
  );
  expect(marks.map((m) => m.key)).toEqual(['b', 'a']);
  expect(marks[0]?.datum).toBe(b);
  expect(calls).toEqual([0, 1]);
  expect(marks[0]?.lowerCap).toEqual({ start: [20, 60], end: [20, 60] });
  expect(errorBarGeometry([], accessors, layout, { axis: 'y', capSize: 8 })).toEqual([]);
});
test('equal bounds and reversed or equal domains preserve numeric endpoint identity', () => {
  const equal = errorBarGeometry([{ ...datum, lower: 0, upper: 0 }], accessors, layout, {
    axis: 'y',
    capSize: 8,
  })[0];
  expect(equal?.stem).toEqual({ start: [20, 50], end: [20, 50] });
  expect(equal?.lowerCap).toEqual(equal?.upperCap);
  const reversed = errorBarGeometry([datum], accessors, chartLayout(frame, [10, 0], [10, -10]), {
    axis: 'y',
    capSize: 8,
  })[0];
  expect(reversed?.stem).toEqual({ start: [80, 40], end: [80, 70] });
  const same = errorBarGeometry([datum], accessors, chartLayout(frame, [2, 2], [0, 0]), {
    axis: 'y',
    capSize: 8,
  })[0];
  expect(same?.stem).toEqual({ start: [50, 50], end: [50, 50] });
});
test('bad bounds keys options and projections fail rather than repair or drop data', () => {
  for (const data of [
    [{ ...datum, position: NaN }],
    [{ ...datum, lower: Infinity }],
    [{ ...datum, upper: NaN }],
    [{ ...datum, lower: 5 }],
    [{ ...datum, id: '' }],
    [datum, datum],
  ])
    expect(() => errorBarGeometry(data, accessors, layout, { axis: 'y', capSize: 8 })).toThrow(
      RangeError,
    );
  for (const capSize of [-1, NaN, Infinity])
    expect(() => errorBarGeometry([], accessors, layout, { axis: 'y', capSize })).toThrow(
      RangeError,
    );
  // SAFETY: Deliberately violate the typed axis to exercise the JavaScript boundary rejection.
  expect(() => errorBarGeometry([], accessors, layout, { axis: 'z' as 'y', capSize: 8 })).toThrow(
    RangeError,
  );
  expect(() =>
    errorBarGeometry(
      [datum],
      accessors,
      { ...layout, y: () => Infinity },
      { axis: 'y', capSize: 8 },
    ),
  ).toThrow(RangeError);
  expect(() =>
    errorBarGeometry(
      [datum],
      accessors,
      { ...layout, x: () => Number.MAX_VALUE },
      { axis: 'y', capSize: Number.MAX_VALUE },
    ),
  ).toThrow(RangeError);
  const error = new Error('caller accessor');
  expect(() =>
    errorBarGeometry(
      [datum],
      {
        ...accessors,
        lower: () => {
          throw error;
        },
      },
      layout,
      { axis: 'y', capSize: 8 },
    ),
  ).toThrow(error);
});
test('tiny accepted domains retain finite coordinates without rounding caller values', () => {
  const tiny = { ...datum, position: 0, lower: 0, upper: 1e-306 };
  const result = errorBarGeometry([tiny], accessors, chartLayout(frame, [0, 1], [0, 1e-306]), {
    axis: 'y',
    capSize: 8,
  });
  expect(result[0]?.stem).toEqual({ start: [0, 100], end: [0, 0] });
  expect(result[0]?.datum.upper).toBe(1e-306);
  const large = errorBarGeometry(
    [datum],
    accessors,
    { ...layout, x: () => 1e305 },
    { axis: 'y', capSize: 8 },
  );
  expect(large[0]?.stem.start[0]).toBe(1e305);
});
