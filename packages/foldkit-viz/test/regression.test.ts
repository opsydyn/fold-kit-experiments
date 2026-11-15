import { describe, expect, it } from 'bun:test';

import { linearRegression, loess, polynomialRegression } from '../src/math/regression';

type Point = Readonly<{ x: number; y: number }>;
const xy = { x: (p: Point) => p.x, y: (p: Point) => p.y };
const near = (actual: number | undefined, expected: number, tolerance = 1e-6): void => {
  expect(Math.abs((actual ?? Number.NaN) - expected)).toBeLessThan(tolerance);
};
const points = (pairs: ReadonlyArray<readonly [number, number]>): ReadonlyArray<Point> =>
  pairs.map(([x, y]) => ({ x, y }));

describe('linear regression', () => {
  // Worked by hand: slope 0.6, intercept 2.2, residual variance 0.8 on 3 degrees of freedom.
  const data = points([
    [1, 2],
    [2, 4],
    [3, 5],
    [4, 4],
    [5, 5],
  ]);

  it('fits slope, intercept and R squared', () => {
    const fit = linearRegression(data, xy);
    near(fit.coefficients[0], 2.2);
    near(fit.coefficients[1], 0.6);
    near(fit.rSquared, 0.6);
    near(fit.residualStandardError, Math.sqrt(0.8));
    expect(fit.n).toBe(5);
    near(fit.predict(10), 8.2);
  });

  it("gives the mean's confidence interval from Student's t", () => {
    const band = linearRegression(data, xy).interval(3, 0.95);
    near(band.fit, 4);
    // s * sqrt(1/n) = 0.4 at the mean of x; t(0.975, 3) = 3.182446305.
    near(band.lower, 4 - 0.4 * 3.182446305);
    near(band.upper, 4 + 0.4 * 3.182446305);
  });

  it('widens the interval away from the mean of x', () => {
    const fit = linearRegression(data, xy);
    const centre = fit.interval(3);
    const edge = fit.interval(5);
    expect(edge.upper - edge.lower).toBeGreaterThan(centre.upper - centre.lower);
  });

  it('matches Anscombe quartet I to published values', () => {
    const anscombe = points([
      [10, 8.04],
      [8, 6.95],
      [13, 7.58],
      [9, 8.81],
      [11, 8.33],
      [14, 9.96],
      [6, 7.24],
      [4, 4.26],
      [12, 10.84],
      [7, 4.82],
      [5, 5.68],
    ]);
    const fit = linearRegression(anscombe, xy);
    near(fit.coefficients[0], 3.0001, 1e-4);
    near(fit.coefficients[1], 0.5001, 1e-4);
    near(fit.rSquared, 0.6665, 1e-4);
  });

  it('skips non-finite pairs', () => {
    const fit = linearRegression([...data, { x: Number.NaN, y: 1 }, { x: 1, y: Infinity }], xy);
    expect(fit.n).toBe(5);
  });
});

describe('polynomial regression', () => {
  it('recovers an exact quadratic with a zero-width band', () => {
    const data = points([-2, -1, 0, 1, 2, 3].map((x) => [x, 2 * x * x - 3 * x + 1] as const));
    const fit = polynomialRegression(data, xy, { degree: 2 });
    near(fit.coefficients[0], 1);
    near(fit.coefficients[1], -3);
    near(fit.coefficients[2], 2);
    near(fit.rSquared, 1);
    const band = fit.interval(0.5);
    near(band.upper - band.lower, 0);
  });

  it('stays accurate on large x values', () => {
    const data = points([0, 1, 2, 3, 4, 5].map((i) => [1e6 + i, 3 + 0.5 * (1e6 + i)] as const));
    near(
      polynomialRegression(data, xy, { degree: 1 }).predict(1e6 + 10),
      3 + 0.5 * (1e6 + 10),
      1e-4,
    );
  });

  it.each([
    [
      'too few points for the degree',
      points([
        [0, 0],
        [1, 1],
      ]),
      2,
    ],
    [
      'a degree below one',
      points([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
      0,
    ],
    [
      'a single distinct x',
      points([
        [1, 0],
        [1, 1],
        [1, 2],
      ]),
      1,
    ],
  ])('rejects %s', (_, data, degree) => {
    expect(() => polynomialRegression(data, xy, { degree })).toThrow(RangeError);
  });
});

describe('LOESS', () => {
  it('reproduces a straight line exactly, sorted by x', () => {
    const data = points([5, 1, 4, 2, 3, 6, 7, 8].map((x) => [x, 2 * x + 1] as const));
    const curve = loess(data, xy, { bandwidth: 0.5 });
    expect(curve.map((p) => p.x)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    curve.forEach((p) => near(p.y, 2 * p.x + 1, 1e-9));
  });

  it('resists an outlier when robustness iterations are on', () => {
    // A noisy line, so residuals have a non-zero median, with one gross outlier.
    const data = points(
      Array.from(
        { length: 20 },
        (_, i) => [i, i === 10 ? 100 : i + 0.3 * Math.sin(i * 1.7)] as const,
      ),
    );
    const plain = loess(data, xy, { bandwidth: 0.3, iterations: 0 });
    const robust = loess(data, xy, { bandwidth: 0.3, iterations: 3 });
    const at = (curve: ReadonlyArray<Point>, x: number) => curve.find((p) => p.x === x)?.y ?? NaN;
    expect(Math.abs(at(robust, 9) - 9)).toBeLessThan(Math.abs(at(plain, 9) - 9));
    expect(Math.abs(at(robust, 9) - 9)).toBeLessThan(1);
  });

  it('rejects a bandwidth outside (0, 1]', () => {
    expect(() =>
      loess(
        points([
          [0, 0],
          [1, 1],
          [2, 2],
        ]),
        xy,
        { bandwidth: 0 },
      ),
    ).toThrow(RangeError);
  });
});
