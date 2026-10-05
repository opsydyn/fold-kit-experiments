import { expect, test } from 'bun:test';

import { contiguousRuns } from '../src/chart/segments';

test('excluded records and explicit connection breaks preserve references', () => {
  const a = { x: 0 },
    missing = { x: 1 },
    b = { x: 2 },
    c = { x: 3 },
    d = { x: 8 };
  const calls: ReadonlyArray<number>[] = [];
  const accessors = {
    x: (v: typeof a) => v.x,
    defined: (v: typeof a) => v !== missing,
    connect: (p: typeof a, n: typeof a) => {
      calls.push([p.x, n.x]);
      return n.x - p.x < 2;
    },
  };
  const data = Object.freeze([a, missing, b, c, d]);
  const runs = contiguousRuns(data, accessors);
  expect(runs).toEqual([[a], [b, c], [d]]);
  expect(runs[1]?.[0]).toBe(b);
  expect(calls).toEqual([
    [2, 3],
    [3, 8],
  ]);
  expect(contiguousRuns([], accessors)).toEqual([]);
  expect(contiguousRuns([missing], accessors)).toEqual([]);
});
test('all X inputs are strictly ordered even when excluded', () => {
  const accessors = { x: (x: number) => x, defined: () => false, connect: () => true };
  for (const data of [[0, 0], [1, 0], [0, NaN], [Infinity], [-Infinity]])
    expect(() => contiguousRuns(data, accessors)).toThrow(RangeError);
});
test('undefined drawable data still obeys caller connection policy', () => {
  expect(
    contiguousRuns([undefined, undefined], {
      x: (_d, i) => i,
      defined: () => true,
      connect: () => false,
    }),
  ).toEqual([[undefined], [undefined]]);
});
