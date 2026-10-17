import { expect, test } from 'bun:test';

import { locomote, teleport, xr } from '../src/kernel/index.ts';

const near = (values: ReadonlyArray<number>) =>
  values.map((value) => Math.round(value * 1e9) / 1e9 || 0);

test('the right stick snap-turns 45°, as pmndrs/xr’s; centring changes nothing', () => {
  const start = xr({ origin: [2, 0, 0] });
  const right = locomote(start, { hand: 'right', direction: 'right' });
  expect(right.heading).toBeCloseTo(-Math.PI / 4, 9);
  expect(locomote(right, { hand: 'right', direction: 'left' }).heading).toBeCloseTo(0, 9);
  expect(locomote(start, { hand: 'right', direction: 'center' })).toBe(start);
  expect(
    locomote(start, { hand: 'right', direction: 'right' }, { snapDegrees: 30 }).heading,
  ).toBeCloseTo(-Math.PI / 6, 9);
});

test('the left stick steps along where the player faces', () => {
  // Facing +x (heading −90°): forward is +x, right is +z.
  const facingX = xr({ origin: [2, 0, 0], heading: -Math.PI / 2 });
  expect(near(locomote(facingX, { hand: 'left', direction: 'forward' }).origin)).toEqual([3, 0, 0]);
  expect(near(locomote(facingX, { hand: 'left', direction: 'right' }).origin)).toEqual([2, 0, 1]);
  expect(near(locomote(facingX, { hand: 'left', direction: 'back' }, { step: 2 }).origin)).toEqual([
    0, 0, 0,
  ]);
  // Facing −z, the default: forward is −z.
  expect(near(locomote(xr(), { hand: 'left', direction: 'forward' }).origin)).toEqual([0, 0, -1]);
});

test('teleporting stands the player where they point, keeping their height and facing', () => {
  const moved = teleport(xr({ origin: [0, 0.5, 0], heading: 1 }), [3, 0, -2]);
  expect(moved.origin).toEqual([3, 0.5, -2]);
  expect(moved.heading).toBe(1);
});
