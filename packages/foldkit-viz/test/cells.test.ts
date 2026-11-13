import { describe, expect, it } from 'bun:test';

import { cellGeometry } from '../src/chart/cells';

type Row = Readonly<{ day: string; hour: string; value: number }>;
const data: ReadonlyArray<Row> = [
  { day: 'Mon', hour: '09', value: 3 },
  { day: 'Mon', hour: '10', value: 7 },
  { day: 'Tue', hour: '09', value: -2 },
  { day: 'Tue', hour: '11', value: Number.NaN },
];
const accessors = {
  key: (d: Row) => `${d.day}-${d.hour}`,
  row: (d: Row) => d.day,
  column: (d: Row) => d.hour,
  value: (d: Row) => d.value,
};
const frame = { width: 330, height: 220, margins: { top: 10, right: 0, bottom: 10, left: 30 } };

describe('cell geometry', () => {
  const geometry = cellGeometry(data, accessors, { frame, padding: 0 });

  it('lays rows and columns out in first-seen order across the plot', () => {
    expect(geometry.rows.map((r) => r.key)).toEqual(['Mon', 'Tue']);
    expect(geometry.columns.map((c) => c.key)).toEqual(['09', '10', '11']);
    expect(geometry.columns.map((c) => c.position)).toEqual([80, 180, 280]);
    expect(geometry.rows.map((r) => r.position)).toEqual([60, 160]);
  });

  it('places a rectangle per finite value and reports the value domain', () => {
    expect(geometry.cells.map((c) => [c.key, c.x, c.y, c.width, c.height])).toEqual([
      ['Mon-09', 30, 10, 100, 100],
      ['Mon-10', 130, 10, 100, 100],
      ['Tue-09', 30, 110, 100, 100],
    ]);
    expect(geometry.valueDomain).toEqual([-2, 7]);
    expect(geometry.cells[2]?.datum).toBe(data[2]!);
  });

  it('keeps a row or column whose only values are missing', () => {
    expect(geometry.columns.at(-1)?.key).toBe('11');
  });

  it('follows explicit row and column orders, and pads cells', () => {
    const ordered = cellGeometry(data, accessors, {
      frame,
      rowOrder: ['Tue', 'Mon'],
      columnOrder: ['11', '10', '09'],
      padding: 0.1,
    });
    expect(ordered.rows[0]?.key).toBe('Tue');
    expect(ordered.cells[0]?.width).toBeCloseTo(90);
  });

  it.each([
    ['duplicate row and column pairs', [...data, { day: 'Mon', hour: '09', value: 1 }], {}],
    ['a value outside an explicit order', data, { rowOrder: ['Mon'] }],
    ['padding of one', data, { padding: 1 }],
  ])('rejects %s', (_, rows, extra) => {
    const keyed = { ...accessors, key: (d: Row, i: number) => `${d.day}-${d.hour}-${i}` };
    expect(() => cellGeometry(rows, keyed, { frame, ...extra })).toThrow(RangeError);
  });
});
