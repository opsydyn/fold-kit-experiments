import { expect, test } from 'bun:test';

import { clientToLocal } from '../src/interaction/coordinates';
test('inverts scale translation rotation and skew', () => {
  expect(clientToLocal({ x: 30, y: 60 }, { a: 2, b: 0, c: 0, d: 3, e: 10, f: 30 })).toEqual({
    x: 10,
    y: 10,
  });
  expect(clientToLocal({ x: 7, y: 24 }, { a: 0, b: 2, c: -3, d: 0, e: 10, f: 20 })).toEqual({
    x: 2,
    y: 1,
  });
  const skew = clientToLocal({ x: 10, y: 17 }, { a: 2, b: 1, c: 1, d: 3, e: 4, f: 7 });
  expect(skew?.x).toBeCloseTo(1.6, 10);
  expect(skew?.y).toBeCloseTo(2.8, 10);
});
test('rejects invalid arguments and fails closed on unusable inversions', () => {
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(() => clientToLocal({ x: value, y: 0 }, identity)).toThrow(RangeError);
    expect(() => clientToLocal({ x: 0, y: 0 }, { ...identity, f: value })).toThrow(RangeError);
  }
  expect(clientToLocal({ x: 1, y: 1 }, { a: 1, b: 2, c: 2, d: 4, e: 0, f: 0 })).toBeNull();
  expect(clientToLocal({ x: 1, y: 1 }, { ...identity, a: 1e308, d: 1e308 })).toBeNull();
});
test('round trips independently composed nested transforms', () => {
  // Outer (2x+10,3y-5), inner (x+0.5y+4,0.25x+y+8).
  const matrix = { a: 2, b: 0.75, c: 1, d: 3, e: 18, f: 19 };
  let seed = 71;
  for (let i = 0; i < 100; i++) {
    seed = (seed * 16807) % 2147483647;
    const x = (seed / 2147483647) * 200 - 100;
    seed = (seed * 16807) % 2147483647;
    const y = (seed / 2147483647) * 200 - 100;
    const result = clientToLocal(
      { x: 2 * (x + 0.5 * y + 4) + 10, y: 3 * (0.25 * x + y + 8) - 5 },
      matrix,
    );
    expect(result).not.toBeNull();
    expect(Math.abs((result?.x ?? Infinity) - x)).toBeLessThan(1e-10 * Math.max(1, Math.abs(x)));
    expect(Math.abs((result?.y ?? Infinity) - y)).toBeLessThan(1e-10 * Math.max(1, Math.abs(y)));
  }
});
