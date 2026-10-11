import { expect, it } from 'bun:test';

import { linear } from '../src/math/scale.js';

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
