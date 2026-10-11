import { expect, test } from 'bun:test';

import { nearestByX } from '../src/interaction/inspection';
const accessors = {
  key: (d: { id: string; x: number }) => d.id,
  x: (d: { id: string; x: number }) => d.x,
};
test('chooses original references with order independent key ties', () => {
  const a = Object.freeze({ id: 'a', x: 2 }),
    b = Object.freeze({ id: 'b', x: 0 });
  const data = Object.freeze([b, a]);
  expect(nearestByX(data, accessors, 1)).toBe(a);
  expect(nearestByX([a, b], accessors, 1)).toBe(a);
  expect(nearestByX([b, { id: 'c', x: 0 }], accessors, 0)).toBe(b);
  expect(data).toEqual([b, a]);
  expect(nearestByX([], accessors, 0)).toBeNull();
});
test('compares large finite distances without false overflow ties', () => {
  const a = { id: 'a', x: 1.2e308 },
    b = { id: 'b', x: 1e308 };
  expect(nearestByX([a, b], accessors, -1e308)).toBe(b);
});
test('validates all keys coordinates and query even after an exact hit', () => {
  for (const data of [
    [{ id: '', x: 0 }],
    [
      { id: 'a', x: 0 },
      { id: 'a', x: 2 },
    ],
    [
      { id: 'a', x: 0 },
      { id: 'b', x: NaN },
    ],
  ])
    expect(() => nearestByX(data, accessors, 0)).toThrow(RangeError);
  expect(() => nearestByX([], accessors, Infinity)).toThrow(RangeError);
});
