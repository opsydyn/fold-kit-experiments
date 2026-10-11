import { expect, test } from 'bun:test';

import { intervalBandGeometry } from '../src/chart/intervalBand';
import { chartLayout } from '../src/chart/layout';
const layout = chartLayout(
  { width: 100, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } },
  [0, 10],
  [-10, 10],
);
const a = { id: 'a', x: 2, lower: -2, upper: 4 };
const b = { id: 'b', x: 8, lower: -4, upper: 6 };
const accessors = {
  x: (d: typeof a) => d.x,
  lower: (d: typeof a) => d.lower,
  upper: (d: typeof a) => d.upper,
  datumKey: (d: typeof a) => d.id,
};
test('band endpoints share caller scales and singleton has no area', () => {
  const singleton = intervalBandGeometry([a], accessors, layout);
  expect(singleton.path).toBeNull();
  expect(singleton.points[0]).toEqual({ datum: a, key: 'a', x: 20, lowerY: 60, upperY: 30 });
  expect(singleton.points[0]?.datum).toBe(a);
  const result = intervalBandGeometry(Object.freeze([a, b]), accessors, layout);
  expect(result.path).toBe('M20,30L80,20 L80,70 L20,60 Z');
  expect(intervalBandGeometry([], accessors, layout)).toEqual({ points: [], path: null });
  expect(
    intervalBandGeometry(
      [
        { ...a, lower: 0, upper: 0 },
        { ...b, lower: 0, upper: 0 },
      ],
      accessors,
      layout,
    ).path,
  ).toBe('M20,50L80,50 L80,50 L20,50 Z');
});
test('invalid interval key and projection fail visibly', () => {
  for (const data of [
    [{ ...a, lower: 5 }],
    [{ ...a, upper: Infinity }],
    [{ ...a, x: NaN }],
    [a, { ...b, x: 2 }],
    [b, a],
    [a, { ...b, id: 'a' }],
    [{ ...a, id: '' }],
  ])
    expect(() => intervalBandGeometry(data, accessors, layout)).toThrow(RangeError);
  expect(() => intervalBandGeometry([a], accessors, { ...layout, y: () => Infinity })).toThrow(
    RangeError,
  );
});

test('finite projected coordinates cannot silently serialise to Infinity', () => {
  expect(() => intervalBandGeometry([a, b], accessors, { ...layout, x: (x) => x * 1e305 })).toThrow(
    RangeError,
  );
});
