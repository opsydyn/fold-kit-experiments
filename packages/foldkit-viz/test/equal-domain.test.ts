import { expect, it } from 'bun:test';

import { linear } from '../src/math/scale.js';

it('maps an equal continuous domain to the range midpoint', () => {
  expect(linear({ domain: [5, 5], range: [0, 100] })(5)).toBe(50);
  expect(linear({ domain: [5, 5], range: [100, 0], clamp: true })(9)).toBe(50);
});
