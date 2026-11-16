import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { DuckDBInstance } from '@duckdb/node-api';
import type { DuckDBConnection } from '@duckdb/node-api';

import { compilePlot, duckdbColumns, pushdown, rowsOf } from '../src/plot/index.js';
import type { ColumnTable, PlotSpec } from '../src/plot/index.js';

describe('pushdown', () => {
  let instance: DuckDBInstance;
  let connection: DuckDBConnection;
  let local: ColumnTable;
  const queries: string[] = [];

  const query = async (sql: string): Promise<ColumnTable> => {
    queries.push(sql);
    const reader = await connection.runAndReadAll(sql);
    return duckdbColumns(reader.columnNames(), reader.getColumnsJS());
  };

  beforeAll(async () => {
    instance = await DuckDBInstance.create(':memory:');
    connection = await instance.connect();
    await connection.run(`
      create table requests as
      select
        (range * 7919 % 2000)::double + (range % 7) / 10 as latency,
        (range * 104729 % 300)::double as payload,
        case range % 4 when 0 then 'read' when 1 then 'write' when 2 then 'read' else 'delete' end as kind,
        case when range % 97 = 0 then null else (range % 50)::double end as maybe
      from range(20000)`);
    local = await query('select * from requests');
  });

  afterAll(() => {
    connection.closeSync();
    instance.closeSync();
  });

  /** The same spec compiled from every row locally, and from the engine's summary. */
  async function both(spec: PlotSpec) {
    queries.length = 0;
    const pushed = await pushdown(spec, { from: 'requests', query });
    return {
      local: compilePlot({ ...spec, data: rowsOf(local) }),
      pushed: compilePlot(pushed),
      spec: pushed,
      queries: [...queries],
    };
  }

  const base = { width: 480, height: 300 } as const;

  it('bins a histogram in the engine, drawing exactly what binning every row locally draws', async () => {
    const result = await both({
      ...base,
      marks: [{ mark: 'rect', x: 'latency', transform: { type: 'bin', thresholds: 30 } }],
    });
    expect(result.pushed).toEqual(result.local);
    // The engine sends bins, not rows.
    const binned = result.spec.marks[0];
    expect(binned?.data === undefined ? 0 : rowsOf(binned.data).length).toBeLessThan(100);
  });

  it('bins each series on the same thresholds, in the order the series first appear', async () => {
    const result = await both({
      ...base,
      marks: [
        {
          mark: 'rect',
          x: 'latency',
          fill: 'kind',
          inset: 1,
          transform: { type: 'bin', thresholds: 20, reduce: 'proportion' },
        },
      ],
    });
    expect(result.pushed).toEqual(result.local);
  });

  it('honours a bin domain, leaving out rows beyond it, and skips nulls as local binning does', async () => {
    const result = await both({
      ...base,
      marks: [
        { mark: 'rect', x: 'maybe', transform: { type: 'bin', domain: [10, 40], thresholds: 6 } },
      ],
    });
    expect(result.pushed).toEqual(result.local);
  });

  it('bins in two dimensions, keeping only the non-empty cells', async () => {
    const result = await both({
      ...base,
      marks: [
        {
          mark: 'rect',
          x: 'latency',
          y: 'payload',
          fill: 'count',
          transform: { type: 'bin', thresholds: 12 },
        },
      ],
    });
    expect(result.pushed).toEqual(result.local);
  });

  it('pulls only the columns a mark it cannot push down uses, beside one it pushes', async () => {
    const result = await both({
      ...base,
      marks: [
        { mark: 'rect', x: 'latency', transform: { type: 'bin' } },
        { mark: 'dot', x: 'latency', y: 'payload', r: { value: 1 } },
      ],
    });
    expect(result.pushed).toEqual(result.local);
    expect(
      result.queries.some((sql) => /select "latency", "payload" from requests/i.test(sql)),
    ).toBe(true);
  });

  it('leaves a spec with its own data alone', async () => {
    const spec: PlotSpec = { ...base, data: [{ a: 1 }], marks: [{ mark: 'dot', x: 'a', y: 'a' }] };
    queries.length = 0;
    expect(await pushdown(spec, { from: 'requests', query })).toBe(spec);
    expect(queries).toEqual([]);
  });

  it('quotes field names, so a field cannot change the query', async () => {
    queries.length = 0;
    await pushdown(
      { ...base, marks: [{ mark: 'dot', x: 'odd"name', y: 'payload' }] },
      { from: 'requests', query: async (sql) => (queries.push(sql), { length: 0, columns: {} }) },
    );
    expect(queries[0]).toContain('"odd""name"');
  });
});
