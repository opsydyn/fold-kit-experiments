import { describe, expect, it } from 'vitest';

import { containsValue, type KeyedPoint, matchingBinIndices, matchingKeys } from './inspection';

const points: ReadonlyArray<KeyedPoint> = Object.freeze([
  Object.freeze({ id: 'a', x: 1, y: 10, label: 'same' }),
  Object.freeze({ id: 'b', x: 2, y: 20, label: 'same' }),
  Object.freeze({ id: 'c', x: 2, y: 20, label: 'same' }),
  Object.freeze({ id: 'd', x: 3, y: 30, label: 'same' }),
]);
const bins = Object.freeze([
  { x0: 10, x1: 20 },
  { x0: 20, x1: 30 },
]);

describe('semantic inspection matching', () => {
  it('exposes one interval predicate with explicit final-endpoint membership', () => {
    expect(containsValue).toEqual(expect.any(Function));
    for (const [value, lo, hi, includeEnd, expected] of [
      [9, 10, 20, false, false],
      [10, 10, 20, false, true],
      [15, 10, 20, false, true],
      [20, 10, 20, false, false],
      [20, 10, 20, true, true],
      [21, 10, 20, true, false],
      [20, 20, 20, false, false],
      [20, 20, 20, true, true],
    ] as const)
      expect(containsValue(value, lo, hi, includeEnd)).toBe(expected);
  });

  it('selects every salary in the interval with an explicit endpoint policy', () => {
    expect(
      matchingKeys(points, { _tag: 'Range', lower: 10, upper: 20, includeEnd: false }),
    ).toEqual(['a']);
    expect(matchingKeys(points, { _tag: 'Range', lower: 20, upper: 30, includeEnd: true })).toEqual(
      ['b', 'c', 'd'],
    );
    expect(
      matchingKeys(points, { _tag: 'Range', lower: 40, upper: 50, includeEnd: false }),
    ).toEqual([]);
  });

  it('resolves identity independently of duplicate labels and coordinates', () => {
    expect(matchingKeys(points, { _tag: 'Point', key: 'c' })).toEqual(['c']);
    expect(matchingKeys([], { _tag: 'Point', key: 'c' })).toEqual([]);
    expect(matchingKeys(points, { _tag: 'Point', key: 'missing' })).toEqual([]);
  });

  it('ignores non-finite coordinates for range matching', () => {
    expect(
      matchingKeys(
        [
          ...points,
          { id: 'e', x: NaN, y: 20, label: 'same' },
          { id: 'f', x: Infinity, y: 20, label: 'same' },
          { id: 'g', x: 2, y: Infinity, label: 'same' },
          { id: 'h', x: 2, y: NaN, label: 'same' },
        ],
        { _tag: 'Range', lower: 20, upper: 30, includeEnd: true },
      ),
    ).toEqual(['b', 'c', 'd']);
  });

  it.each([
    [{ id: '', x: 1, y: 10, label: 'same' }],
    [
      { id: 'a', x: 1, y: 10, label: 'same' },
      { id: 'a', x: 2, y: 20, label: 'same' },
    ],
  ])('rejects ambiguous identities before either matching operation', (...invalid) => {
    expect(() => matchingKeys(invalid, { _tag: 'Point', key: 'missing' })).toThrow(RangeError);
    expect(() =>
      matchingKeys(invalid, { _tag: 'Range', lower: 40, upper: 50, includeEnd: false }),
    ).toThrow(RangeError);
    expect(() => matchingBinIndices(invalid, [], bins)).toThrow(RangeError);
  });

  it('highlights only bins containing selected data, including the final endpoint', () => {
    expect(matchingBinIndices(points, ['a', 'b', 'c', 'd'], bins)).toEqual([0, 1]);
    expect(matchingBinIndices(points, ['c'], bins)).toEqual([1]);
    expect(matchingBinIndices(points, ['d'], bins)).toEqual([1]);
    expect(matchingBinIndices(points, [], bins)).toEqual([]);
    expect(matchingBinIndices(points, ['missing'], bins)).toEqual([]);
    expect(matchingBinIndices(points, ['a'], [])).toEqual([]);
    expect(matchingBinIndices([], ['a'], bins)).toEqual([]);
    expect(matchingBinIndices(points, ['c'], [{ x0: 0, x1: 5 }])).toEqual([]);
  });
});
