import { expect, it } from 'bun:test';

import { linear, scalePow, sqrt } from '../src/math/scale.js';

it('maps an equal continuous domain to the range midpoint', () => {
  expect(linear({ domain: [5, 5], range: [0, 100] })(5)).toBe(50);
  expect(linear({ domain: [5, 5], range: [100, 0], clamp: true })(9)).toBe(50);
});

it('normalises tiny finite domains before an overflowing slope', () => {
  for (const endpoint of [1e-306, Number.MIN_VALUE]) {
    const scale = linear({ domain: [0, endpoint], range: [200, 0], clamp: true });
    expect(scale(0)).toBe(200);
    expect(scale(endpoint)).toBe(0);
    expect(scale(endpoint * 2)).toBe(0);
  }
});

it('maps signed square roots before interpolating and honours reversed clamps', () => {
  expect(sqrt({ domain: [1, 9], range: [0, 1] })(4)).toBeCloseTo(0.5);
  expect(sqrt({ domain: [-4, 16], range: [0, 1] })(0)).toBeCloseTo(1 / 3);
  const reversed = sqrt({ domain: [9, 1], range: [100, 0], clamp: true });
  expect(reversed(4)).toBeCloseTo(50);
  expect(reversed(25)).toBe(100);
  expect(reversed(0)).toBe(0);
});

it('maps equal domains to the midpoint for square-root and power scales', () => {
  const config = { domain: [4, 4], range: [0, 100] } as const;
  expect(sqrt(config)(4)).toBe(50);
  expect(scalePow({ ...config, exponent: 0.5 })(4)).toBe(50);
});
