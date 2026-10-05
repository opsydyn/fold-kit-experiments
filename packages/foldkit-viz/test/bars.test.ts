import { describe, expect, it } from 'bun:test';

import { barGeometry } from '../src/chart/bars';
const frame = { width: 300, height: 200, margins: { top: 10, right: 10, bottom: 30, left: 40 } };
const first = { id: 'a', month: 'Jan', team: 'One', count: 10 };
const data = [
  { id: 'a', month: 'Jan', team: 'One', count: 10 },
  { id: 'b', month: 'Jan', team: 'Two', count: 20 },
  { id: 'c', month: 'Feb', team: 'One', count: -5 },
];
const accessors = {
  key: (d: (typeof data)[number]) => d.id,
  category: (d: (typeof data)[number]) => d.month,
  series: (d: (typeof data)[number]) => d.team,
  value: (d: (typeof data)[number]) => d.count,
};
describe('bar geometry', () => {
  it('groups sparse series with stable category and datum identities', () => {
    const result = barGeometry(data, accessors, {
      frame,
      mode: 'grouped',
      orientation: 'vertical',
    });
    expect(result.bars.map((b) => b.key)).toEqual(['a', 'b', 'c']);
    expect(result.categories.map((c) => c.key)).toEqual(['Jan', 'Feb']);
    expect(result.bars[0]?.datum).toBe(data[0]);
    expect(result.bars[0]?.x).toBeLessThan(result.bars[1]?.x ?? 0);
    expect(result.domain).toEqual([-5, 20]);
  });
  it('stacks positive and negative values on separate zero baselines', () => {
    const signed = [
      ...data,
      { id: 'd', month: 'Jan', team: 'Three', count: -7 },
      { id: 'e', month: 'Jan', team: 'Four', count: -3 },
    ];
    const result = barGeometry(signed, accessors, {
      frame,
      mode: 'stacked',
      orientation: 'vertical',
    });
    expect(result.domain).toEqual([-10, 30]);
    expect(result.bars.map((b) => [b.start, b.end])).toEqual([
      [0, 10],
      [10, 30],
      [0, -5],
      [0, -7],
      [-7, -10],
    ]);
    expect(result.bars[0]?.x).toBe(result.bars[1]?.x);
  });
  it.each(['grouped', 'stacked'] as const)(
    'projects %s bars in either orientation without negative rectangle sizes',
    (mode) => {
      for (const orientation of ['vertical', 'horizontal'] as const) {
        const result = barGeometry(data, accessors, { frame, mode, orientation });
        expect(
          result.bars.every(
            (b) =>
              [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width >= 0 && b.height >= 0,
          ),
        ).toBe(true);
        expect(
          result.bars.every(
            (b) =>
              b.x >= 40 && b.y >= 10 && b.x + b.width <= 290.00001 && b.y + b.height <= 170.00001,
          ),
        ).toBe(true);
      }
    },
  );
  it('handles empty and zero-only data', () => {
    expect(
      barGeometry([], accessors, { frame, mode: 'grouped', orientation: 'vertical' }).bars,
    ).toEqual([]);
    const result = barGeometry([{ ...first, count: 0 }], accessors, {
      frame,
      mode: 'stacked',
      orientation: 'horizontal',
    });
    expect(result.bars[0]?.width).toBe(0);
    expect(result.domain[0]).toBeLessThanOrEqual(0);
  });
  it('rejects duplicate keys, invalid frame/padding/domains and non-finite values', () => {
    const config = { frame, mode: 'grouped', orientation: 'vertical' } as const;
    expect(() => barGeometry([first, first], accessors, config)).toThrow('Duplicate');
    expect(() => barGeometry([{ ...first, count: NaN }], accessors, config)).toThrow();
    expect(() => barGeometry(data, accessors, { ...config, padding: 1 })).toThrow();
    expect(() =>
      barGeometry(data, accessors, { ...config, frame: { ...frame, width: 0 } }),
    ).toThrow();
    expect(() => barGeometry(data, accessors, { ...config, valueDomain: [1, 20] })).toThrow();
    expect(() => barGeometry(data, accessors, { ...config, valueDomain: [0, 1] })).toThrow();
  });
});

it.each(['vertical', 'horizontal'] as const)(
  'keeps a global series stack order across reordered sparse rows (%s)',
  (orientation) => {
    const rows = [
      { id: 'ja', month: 'Jan', team: 'A', count: 10 },
      { id: 'jb', month: 'Jan', team: 'B', count: 20 },
      { id: 'fb', month: 'Feb', team: 'B', count: 20 },
      { id: 'fa', month: 'Feb', team: 'A', count: 10 },
      { id: 'fc', month: 'Feb', team: 'C', count: -4 },
      { id: 'jd', month: 'Jan', team: 'D', count: -6 },
    ];
    const result = barGeometry(rows, accessors, { frame, mode: 'stacked', orientation });
    expect(result.series).toEqual(['A', 'B', 'C', 'D']);
    expect(result.bars.map((d) => [d.key, d.start, d.end])).toEqual([
      ['ja', 0, 10],
      ['jb', 10, 30],
      ['fb', 10, 30],
      ['fa', 0, 10],
      ['fc', 0, -4],
      ['jd', 0, -6],
    ]);
  },
);
