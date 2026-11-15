import { describe, expect, it } from 'bun:test';

import fc from 'fast-check';

import {
  columnTable,
  compilePlot,
  describePlot,
  fromArrow,
  highlightPoints,
  plotTable,
} from '../src/plot';
import type { ColumnTable, MarkSpec, PlotSpec, Row, Value } from '../src/plot';
import { isNumber } from '../src/plot/channels';

const isNumbers = (values: ReadonlyArray<Value>): values is ReadonlyArray<number> =>
  values.every(isNumber);

/** The same rows as a column table: numbers as typed arrays, the rest as arrays. */
function asColumns(rows: ReadonlyArray<Row>): ColumnTable {
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return columnTable(
    Object.fromEntries(
      fields.map((field) => {
        const values = rows.map((row) => row[field] ?? null);
        return [field, isNumbers(values) ? Float64Array.from(values) : values];
      }),
    ),
  );
}

const rows: ReadonlyArray<Row> = Array.from({ length: 120 }, (_, i) => ({
  x: (i * 37) % 101,
  y: Math.round(Math.sin(i) * 500) / 10,
  size: (i % 7) + 1,
  group: ['north', 'south', 'east'][i % 3] ?? 'north',
  month: `2026-${String((i % 12) + 1).padStart(2, '0')}-01`,
  ok: i % 2 === 0,
}));

const plot = (marks: ReadonlyArray<MarkSpec>, extra: Partial<PlotSpec> = {}): PlotSpec => ({
  width: 480,
  height: 320,
  marks,
  ...extra,
});

const cases: ReadonlyArray<readonly [string, PlotSpec]> = [
  ['dots with colour and size', plot([{ mark: 'dot', x: 'x', y: 'y', fill: 'group', r: 'size' }])],
  [
    'dense dots with colour and a highlight',
    plot([
      {
        mark: 'dot',
        x: 'x',
        y: 'y',
        fill: 'group',
        dense: true,
        highlight: { field: 'x', range: [10, 60] },
      },
    ]),
  ],
  ['a line per group over dates', plot([{ mark: 'line', x: 'month', y: 'y', stroke: 'group' }])],
  ['stacked bars', plot([{ mark: 'bar', x: 'group', y: 'size', fill: 'ok', stack: 'zero' }])],
  ['a histogram', plot([{ mark: 'rect', x: 'x', transform: { type: 'bin', thresholds: 8 } }])],
  ['a density curve', plot([{ mark: 'density', x: 'y' }])],
  [
    'facets of dense dots',
    plot([{ mark: 'dot', x: 'x', y: 'y', dense: true }], { facet: { x: 'group' } }),
  ],
  ['an area', plot([{ mark: 'area', x: 'x', y: 'size' }])],
  [
    'a mark with its own data beside a rule',
    plot([
      { mark: 'rule', y: { value: 10 } },
      { mark: 'dot', x: 'x', y: 'y', data: rows.slice(0, 40) },
    ]),
  ],
];

describe('a column table compiles as its rows do', () => {
  it.each(cases)('%s', (_, spec) => {
    const asRows = compilePlot({ ...spec, data: rows });
    const marks = spec.marks.map((mark) =>
      mark.data === undefined || !Array.isArray(mark.data)
        ? mark
        : { ...mark, data: asColumns(mark.data) },
    );
    expect(compilePlot({ ...spec, marks, data: asColumns(rows) })).toEqual(asRows);
  });

  it('for any dense table of numbers, including gaps', () => {
    const value = fc.oneof(fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.constant(null));
    fc.assert(
      fc.property(
        fc.array(fc.record({ a: value, b: value }), { minLength: 1, maxLength: 200 }),
        (data) => {
          const spec = plot([{ mark: 'dot', x: 'a', y: 'b', dense: true }]);
          const columns = columnTable({ a: data.map((row) => row.a), b: data.map((row) => row.b) });
          expect(compilePlot({ ...spec, data: columns })).toEqual(compilePlot({ ...spec, data }));
          return true;
        },
      ),
      { numRuns: 60 },
    );
  });

  it('restyles a highlight from the columns alone', () => {
    const spec = plot([{ mark: 'dot', x: 'x', y: 'y', dense: true }]);
    const columns = asColumns(rows);
    const highlight = { field: 'y', range: [-10, 20] as const };
    expect(highlightPoints(compilePlot({ ...spec, data: columns }), 0, columns, highlight)).toEqual(
      highlightPoints(compilePlot({ ...spec, data: rows }), 0, rows, highlight),
    );
  });

  it('describes and tabulates a column table as it does rows', () => {
    const spec = plot([{ mark: 'bar', x: 'group', y: 'size', title: 'group' }]);
    const columns = asColumns(rows);
    expect(plotTable({ ...spec, data: columns })).toEqual(plotTable({ ...spec, data: rows }));
    expect(describePlot(compilePlot({ ...spec, data: columns }))).toBe(
      describePlot(compilePlot({ ...spec, data: rows })),
    );
  });
});

describe('a dense mark over columns', () => {
  /** A column table that records whether anything listed its columns, as building rows must. */
  const watched = (columns: Readonly<Record<string, Float64Array>>, length: number) => {
    const seen = { listed: false };
    const proxy = new Proxy(columns, {
      ownKeys: (target) => {
        seen.listed = true;
        return Reflect.ownKeys(target);
      },
    });
    return { table: { length, columns: proxy }, seen };
  };

  it('reads its columns without building rows', () => {
    const { table, seen } = watched(
      {
        x: new Float64Array([1, 2, 3, 4]),
        y: new Float64Array([4, 3, 2, 1]),
        v: new Float64Array(4),
      },
      4,
    );
    const spec = plot(
      [
        {
          mark: 'dot',
          x: 'x',
          y: 'y',
          fill: 'v',
          r: 'v',
          dense: true,
          highlight: { field: 'x', range: [2, 3] },
        },
      ],
      { data: table },
    );
    const geometry = compilePlot(spec);
    highlightPoints(geometry, 0, table, { field: 'y', range: [1, 2] });
    expect(seen.listed).toBe(false);
  });

  it('builds rows for a facet, which filters them', () => {
    const { table, seen } = watched(
      { x: new Float64Array([1, 2]), g: new Float64Array([0, 1]) },
      2,
    );
    compilePlot(
      plot([{ mark: 'dot', x: 'x', y: 'x', dense: true }], { data: table, facet: { x: 'g' } }),
    );
    expect(seen.listed).toBe(true);
  });
});

describe('columnTable', () => {
  it('takes its length from its columns', () => {
    expect(columnTable({ a: [1, 2, 3], b: new Float64Array(3) }).length).toBe(3);
    expect(columnTable({}).length).toBe(0);
  });

  it('refuses columns of different lengths', () => {
    expect(() => columnTable({ a: [1, 2], b: [1] })).toThrow('column "b" has 1 values; "a" has 2');
  });

  it('reports a missing field as rows do', () => {
    const spec = plot([{ mark: 'dot', x: 'x', y: 'nope' }]);
    expect(() => compilePlot({ ...spec, data: rows })).toThrow(
      'marks[0].y: field "nope" is missing',
    );
    expect(() => compilePlot({ ...spec, data: asColumns(rows) })).toThrow(
      'marks[0].y: field "nope" is missing',
    );
  });
});

describe('fromArrow', () => {
  /** An Arrow table as flechette and apache-arrow present one, structurally. */
  const arrowTable = (columns: Readonly<Record<string, ArrayLike<unknown>>>, numRows: number) => ({
    numRows,
    schema: { fields: Object.keys(columns).map((name) => ({ name })) },
    getChild: (name: string) => {
      const values = columns[name];
      return values === undefined ? null : { toArray: () => values };
    },
  });

  it('keeps float and integer columns as they are', () => {
    const x = new Float64Array([1.5, 2.5]);
    const n = new Int32Array([3, 4]);
    const table = fromArrow(arrowTable({ x, n }, 2));
    expect(table.length).toBe(2);
    expect(table.columns.x).toBe(x);
    expect(table.columns.n).toBe(n);
  });

  it('turns 64-bit integers into numbers and dates into epoch milliseconds', () => {
    const when = new Date(Date.UTC(2026, 10, 15));
    const table = fromArrow(
      arrowTable({ big: new BigInt64Array([1n, 2n]), at: [when, null], label: ['a', null] }, 2),
    );
    expect(Array.from(table.columns.big ?? [])).toEqual([1, 2]);
    expect(table.columns.at).toEqual([when.getTime(), null]);
    expect(table.columns.label).toEqual(['a', null]);
  });

  it('plots an Arrow table', () => {
    const table = fromArrow(
      arrowTable({ x: new Float64Array([1, 2, 3]), y: new Float64Array([3, 1, 2]) }, 3),
    );
    const geometry = compilePlot(
      plot([{ mark: 'dot', x: 'x', y: 'y', dense: true }], { data: table }),
    );
    const [points] = geometry.facets[0]?.marks[0]?.graphics ?? [];
    expect(points?.kind === 'points' ? points.count : 0).toBe(3);
  });
});
