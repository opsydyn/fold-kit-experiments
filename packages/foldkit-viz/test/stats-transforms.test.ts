import { describe, expect, it } from 'bun:test';

import { ecdf, movingWindow, normalQuantile, qqNormal, studentTQuantile } from '../src/math/stats';

const near = (actual: number | undefined, expected: number, tolerance = 1e-6): void => {
  expect(Math.abs((actual ?? Number.NaN) - expected)).toBeLessThan(tolerance);
};

describe('distribution quantiles', () => {
  it('inverts the standard normal to published values', () => {
    near(normalQuantile(0.975), 1.959963985);
    near(normalQuantile(0.5), 0);
    near(normalQuantile(0.025), -1.959963985);
    near(normalQuantile(0.999), 3.090232306);
    near(normalQuantile(1e-6), -4.753424309, 1e-5);
  });

  it("inverts Student's t to published values", () => {
    near(studentTQuantile(0.975, 1), 12.70620474, 1e-5);
    near(studentTQuantile(0.975, 3), 3.182446305);
    near(studentTQuantile(0.975, 10), 2.228138852);
    near(studentTQuantile(0.975, 30), 2.042272456);
    near(studentTQuantile(0.025, 10), -2.228138852);
    near(studentTQuantile(0.5, 5), 0);
  });

  it.each([
    ['p of zero', () => normalQuantile(0)],
    ['p of one', () => studentTQuantile(1, 3)],
    ['zero degrees of freedom', () => studentTQuantile(0.9, 0)],
  ])('rejects %s', (_, run) => {
    expect(run).toThrow(RangeError);
  });
});

describe('empirical cumulative distribution', () => {
  it('steps once per distinct value, with ties sharing a step', () => {
    expect(ecdf([3, 1, 2, 2])).toEqual([
      { x: 1, p: 0.25 },
      { x: 2, p: 0.75 },
      { x: 3, p: 1 },
    ]);
  });

  it('ignores non-finite values and returns nothing for no data', () => {
    expect(ecdf([Number.NaN, 5, Number.POSITIVE_INFINITY])).toEqual([{ x: 5, p: 1 }]);
    expect(ecdf([])).toEqual([]);
  });
});

describe('normal QQ', () => {
  it('pairs sorted samples with normal quantiles at the (i - 0.5) / n positions', () => {
    const pairs = qqNormal([30, 10, 20]);
    expect(pairs.map((pair) => pair.sample)).toEqual([10, 20, 30]);
    near(pairs[0]?.theoretical, normalQuantile(0.5 / 3));
    near(pairs[1]?.theoretical, 0);
    near(pairs[2]?.theoretical, normalQuantile(2.5 / 3));
  });
});

describe('moving windows', () => {
  const values = [1, 2, 3, 4, 5];

  it('reduces trailing windows, leaving incomplete ones undefined', () => {
    expect(movingWindow(values, { size: 3, reduce: 'mean' })).toEqual([
      Number.NaN,
      Number.NaN,
      2,
      3,
      4,
    ]);
  });

  it('centres windows on request', () => {
    expect(movingWindow(values, { size: 3, reduce: 'sum', anchor: 'centre' })).toEqual([
      Number.NaN,
      6,
      9,
      12,
      Number.NaN,
    ]);
  });

  it('shrinks windows at the edges when partial windows are allowed', () => {
    expect(movingWindow(values, { size: 3, reduce: 'max', partial: true })).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(movingWindow([5, 1, 4, 2], { size: 2, reduce: 'min', partial: true })).toEqual([
      5, 1, 1, 2,
    ]);
  });

  it('takes medians, and treats a window holding a gap as undefined', () => {
    expect(movingWindow([1, 9, 2, 8], { size: 3, reduce: 'median' })).toEqual([
      Number.NaN,
      Number.NaN,
      2,
      8,
    ]);
    expect(movingWindow([1, Number.NaN, 3, 4], { size: 2, reduce: 'mean' })).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
      3.5,
    ]);
  });

  it('rejects a window size below one', () => {
    expect(() => movingWindow(values, { size: 0, reduce: 'mean' })).toThrow(RangeError);
  });
});
