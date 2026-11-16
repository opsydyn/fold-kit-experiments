import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import * as duckdb from '@duckdb/duckdb-wasm/blocking';
import { compilePlot, rowsOf } from '@opsydyn/foldkit-viz/plot';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { arrowQuery, gridSpec, histogramSpec, run, setupSql, sourceOf } from './engine';

/** The same DuckDB-Wasm engine the page runs, from local files, so the test needs no network. */
const dist = dirname(
  createRequire(import.meta.url).resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'),
);

describe('DuckDB-Wasm pushdown', () => {
  let db: duckdb.DuckDBBindings;
  let connection: duckdb.DuckDBConnection;

  beforeAll(async () => {
    db = await duckdb.createDuckDB(
      {
        mvp: {
          mainModule: join(dist, 'duckdb-mvp.wasm'),
          mainWorker: join(dist, 'duckdb-node-mvp.worker.cjs'),
        },
        eh: {
          mainModule: join(dist, 'duckdb-eh.wasm'),
          mainWorker: join(dist, 'duckdb-node-eh.worker.cjs'),
        },
      },
      new duckdb.VoidLogger(),
      duckdb.NODE_RUNTIME,
    );
    await db.instantiate(() => undefined);
    connection = db.connect();
    connection.query(setupSql(50_000));
  }, 60_000);

  afterAll(() => {
    connection.close();
  });

  const query = () => arrowQuery((sql) => connection.query(sql));

  it('reads Arrow results as columns and draws exactly what binning every row draws', async () => {
    const ran = await run(query(), 20, 'all');
    const every = rowsOf(await query()('SELECT * FROM requests'));
    expect(compilePlot(ran.histogram)).toEqual(compilePlot({ ...histogramSpec(20), data: every }));
    expect(compilePlot(ran.grid)).toEqual(compilePlot({ ...gridSpec(10), data: every }));
    expect(ran.statements.length).toBeGreaterThan(2);
  });

  it('filters by kind through the source it queries', async () => {
    const ran = await run(query(), 10, 'write');
    const writes = rowsOf(await query()(`SELECT * FROM ${sourceOf('write')}`));
    expect(writes.every((row) => row.kind === 'write')).toBe(true);
    expect(compilePlot(ran.histogram)).toEqual(compilePlot({ ...histogramSpec(10), data: writes }));
  });
});
