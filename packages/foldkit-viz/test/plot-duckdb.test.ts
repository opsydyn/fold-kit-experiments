import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { DuckDBInstance, JSDuckDBValueConverter } from '@duckdb/node-api';
import type { DuckDBConnection } from '@duckdb/node-api';

import { compilePlot, duckdbColumns, fromDuckDB, rowsOf } from '../src/plot/index.js';
import type { Column, Graphic, PlotSpec } from '../src/plot/index.js';

/** A column's values as numbers, checking it is the Float64Array the table promises. */
const floats = (column: Column | undefined): ReadonlyArray<number> => {
  if (!(column instanceof Float64Array)) throw new Error('expected a Float64Array column');
  return [...column];
};

describe('duckdbColumns', () => {
  it('types all-numeric columns as Float64Array, nulls as NaN', () => {
    const table = duckdbColumns(
      ['x', 'y'],
      [
        [1, 2, null],
        [0.5, 1.5, 2.5],
      ],
    );
    expect(table.length).toBe(3);
    expect(table.columns.x).toBeInstanceOf(Float64Array);
    expect(floats(table.columns.x)).toEqual([1, 2, Number.NaN]);
  });

  it('turns 64-bit integers into numbers and dates into epoch milliseconds, as fromArrow does', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const table = duckdbColumns(
      ['id', 'at'],
      [
        [1n, 2n],
        [at, null],
      ],
    );
    expect(floats(table.columns.id)).toEqual([1, 2]);
    expect(floats(table.columns.at)).toEqual([at.getTime(), Number.NaN]);
  });

  it('keeps any other column as JSON values', () => {
    const table = duckdbColumns(
      ['name', 'mixed', 'flag'],
      [
        ['a', null],
        [1, 'two'],
        [true, false],
      ],
    );
    expect(table.columns.name).toEqual(['a', null]);
    expect(table.columns.mixed).toEqual([1, 'two']);
    expect(table.columns.flag).toEqual([true, false]);
  });

  it('refuses names and columns that do not line up', () => {
    expect(() => duckdbColumns(['x'], [[1], [2]])).toThrow('1 column name for 2 columns');
    expect(() => duckdbColumns(['x', 'y'], [[1], [2, 3]])).toThrow(
      'column "y" has 2 values; "x" has 1',
    );
  });
});

describe('DuckDB results', () => {
  let instance: DuckDBInstance;
  let connection: DuckDBConnection;

  beforeAll(async () => {
    instance = await DuckDBInstance.create(':memory:');
    connection = await instance.connect();
    await connection.run(`
      create table requests as
      select
        (range * 37 % 2000)::integer as latency,
        (range * 13 % 300)::double as payload,
        case range % 3 when 0 then 'read' when 1 then 'write' else 'delete' end as kind,
        timestamp '2026-01-01' + to_seconds(range) as started
      from range(5000)`);
  });

  afterAll(() => {
    connection.closeSync();
    instance.closeSync();
  });

  const spec = (data: PlotSpec['data']): PlotSpec => ({
    width: 400,
    height: 300,
    data,
    x: { domain: [0, 2000] },
    y: { domain: [0, 300] },
    color: { domain: ['read', 'write', 'delete'] },
    marks: [{ mark: 'dot', x: 'latency', y: 'payload', fill: 'kind', dense: true }],
  });
  const points = (graphics: ReadonlyArray<Graphic>) => {
    const g = graphics[0];
    if (g?.kind !== 'points') throw new Error('expected packed points');
    return g;
  };

  it('plots a whole result as columns, the same chart as its rows', async () => {
    const reader = await connection.runAndReadAll('select * from requests');
    const table = fromDuckDB(reader);
    expect(table.length).toBe(5000);
    expect(table.columns.latency).toBeInstanceOf(Float64Array);
    expect(table.columns.kind?.[0]).toBe('read');
    expect(table.columns.started?.[1]).toBe(Date.UTC(2026, 0, 1, 0, 0, 1));
    const fromColumns = points(compilePlot(spec(table)).facets[0]!.marks[0]!.graphics);
    const fromRows = points(compilePlot(spec(rowsOf(table))).facets[0]!.marks[0]!.graphics);
    expect([...fromColumns.xs]).toEqual([...fromRows.xs]);
    expect([...fromColumns.ys]).toEqual([...fromRows.ys]);
    expect(fromColumns.palette).toEqual(fromRows.palette);
  });

  it('reads a streamed result a chunk at a time, through the JS value converter', async () => {
    const result = await connection.stream('select latency, payload, kind from requests');
    const names = result.columnNames();
    const chunks = [];
    for (
      let chunk = await result.fetchChunk();
      chunk !== null && chunk.rowCount > 0;
      chunk = await result.fetchChunk()
    )
      chunks.push(duckdbColumns(names, chunk.convertColumns(JSDuckDBValueConverter)));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.reduce((sum, chunk) => sum + chunk.length, 0)).toBe(5000);
    expect(chunks[0]?.columns.payload).toBeInstanceOf(Float64Array);
  });
});
