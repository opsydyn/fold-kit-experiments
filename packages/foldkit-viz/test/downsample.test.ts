import { describe, expect, it } from 'bun:test';

import { lttb, m4 } from '../src/math/downsample';

type P = Readonly<{ x: number; y: number }>;
const xy = { x: (p: P) => p.x, y: (p: P) => p.y };
const series = (ys: ReadonlyArray<number>): ReadonlyArray<P> => ys.map((y, x) => ({ x, y }));
// A noisy wave with one sharp spike, the kind of feature downsampling must keep.
const long = series(
  Array.from({ length: 10_000 }, (_, i) =>
    i === 6_543 ? 50 : Math.sin(i / 300) + 0.1 * Math.sin(i * 7.3),
  ),
);

describe('LTTB', () => {
  it('picks the point forming the largest triangle in each bucket', () => {
    const data = series([0, 0, 0, 10, 0, 0, 0, 0, 0, 0]);
    // Worked by hand: buckets [1, 5) and [5, 9) between the fixed first and last points.
    expect(lttb(data, xy, 4).map((p) => p.x)).toEqual([0, 3, 5, 9]);
  });

  it('returns exactly the threshold, keeping the ends, the spike and the original rows', () => {
    const sampled = lttb(long, xy, 500);
    expect(sampled).toHaveLength(500);
    expect(sampled[0]).toBe(long[0]!);
    expect(sampled.at(-1)).toBe(long.at(-1)!);
    expect(sampled.some((p) => p.y === 50)).toBe(true);
    expect(sampled.every((p, i) => i === 0 || p.x > (sampled[i - 1]?.x ?? -Infinity))).toBe(true);
  });

  it('returns the data unchanged when it is already small enough', () => {
    const data = series([1, 2, 3]);
    expect(lttb(data, xy, 10)).toEqual(data);
  });

  it('drops non-finite points', () => {
    expect(lttb(series([1, Number.NaN, 3]), xy, 5).map((p) => p.y)).toEqual([1, 3]);
  });

  it.each([
    ['a threshold below three', () => lttb(long, xy, 2)],
    [
      'x values out of order',
      () =>
        lttb(
          [
            { x: 2, y: 0 },
            { x: 1, y: 0 },
          ],
          xy,
          3,
        ),
    ],
  ])('rejects %s', (_, run) => {
    expect(run).toThrow(RangeError);
  });
});

describe('M4', () => {
  const sampled = m4(long, xy, { width: 100 });

  it('keeps at most four points per pixel column', () => {
    expect(sampled.length).toBeLessThanOrEqual(400);
    expect(sampled.length).toBeGreaterThan(200);
  });

  it('keeps the global extremes and both ends, in the original order', () => {
    const ys = long.map((p) => p.y);
    expect(sampled.some((p) => p.y === Math.max(...ys))).toBe(true);
    expect(sampled.some((p) => p.y === Math.min(...ys))).toBe(true);
    expect(sampled[0]).toBe(long[0]!);
    expect(sampled.at(-1)).toBe(long.at(-1)!);
    expect(sampled.every((p, i) => i === 0 || p.x > (sampled[i - 1]?.x ?? -Infinity))).toBe(true);
  });

  it('keeps each column’s first, last, lowest and highest point', () => {
    const data = series([5, 1, 9, 3, 4, 8, 0, 6]);
    expect(m4(data, xy, { width: 2 }).map((p) => p.x)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(m4(data, xy, { width: 1 }).map((p) => p.x)).toEqual([0, 2, 6, 7]);
  });

  it('rejects a width below one', () => {
    expect(() => m4(long, xy, { width: 0 })).toThrow(RangeError);
  });
});
