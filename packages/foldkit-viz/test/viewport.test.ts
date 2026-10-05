import { expect, test } from 'bun:test';

import {
  constrainDomain,
  zoomDomain,
  panDomain,
  type ContinuousDomain,
} from '../src/interaction/viewport';
test('fits and expands domains without discarding their requested span', () => {
  expect(constrainDomain([-2, 3], [0, 10], 1)).toEqual([0, 5]);
  expect(constrainDomain([8, 13], [0, 10], 1)).toEqual([5, 10]);
  expect(constrainDomain([4, 5], [0, 10], 4)).toEqual([2.5, 6.5]);
  expect(constrainDomain([-5, 20], [0, 10], 1)).toEqual([0, 10]);
  expect(zoomDomain([2, 8], 0.5, 4, [0, 10], 1)).toEqual([3, 6]);
  expect(panDomain([2, 5], 9, [0, 10], 1)).toEqual([7, 10]);
  expect(zoomDomain([2, 8], 0.5, -10, [0, 10], 1)).toEqual([2, 5]);
});
test('retains epoch precision through anchored zoom and inverse', () => {
  const original: ContinuousDomain = [1700000000000, 1700000010000];
  const anchor = original[0] + 4000;
  const zoomed = zoomDomain(original, 0.5, anchor, original, 1);
  const restored = zoomDomain(zoomed, 2, anchor, original, 1);
  expect(Math.abs(restored[0] - original[0])).toBeLessThan(1e-3);
  expect(Math.abs(restored[1] - original[1])).toBeLessThan(1e-3);
});
test('rejects invalid domains parameters and representability loss', () => {
  for (const domain of [
    [1, 1],
    [2, 1],
    [NaN, 2],
    [-1e308, 1e308],
  ] as const)
    expect(() => constrainDomain(domain, [0, 10], 1)).toThrow(RangeError);
  for (const min of [0, -1, NaN, Infinity, 11])
    expect(() => constrainDomain([1, 2], [0, 10], min)).toThrow(RangeError);
  expect(() => constrainDomain([1, 2], [2, 1], 1)).toThrow(RangeError);
  for (const factor of [0, -1, Infinity, NaN])
    expect(() => zoomDomain([1, 2], factor, 1, [0, 10], 1)).toThrow(RangeError);
  expect(() => zoomDomain([1, 2], 1, NaN, [0, 10], 1)).toThrow(RangeError);
  expect(() => panDomain([1, 2], Infinity, [0, 10], 1)).toThrow(RangeError);
  expect(() => panDomain([1e308, 1.1e308], 1e308, [1e308, 1.2e308], 1)).toThrow(RangeError);
  expect(() =>
    zoomDomain([1e16, 1e16 + 4], Number.MIN_VALUE, 1e16 + 2, [1e16, 1e16 + 4], 1),
  ).toThrow(RangeError);
});
