import { fromArrow, pushdown } from '@opsydyn/foldkit-viz/plot';
import type { ArrowTable, ColumnTable, PlotSpec } from '@opsydyn/foldkit-viz/plot';

/**
 * The page's data and charts, shared by the browser app and its Node test:
 * a million synthetic requests made in DuckDB by SQL, and two binned charts
 * that pushdown counts in DuckDB rather than pulling every row.
 */

export const ROWS = 1_000_000;

/**
 * Deterministic requests, made by SQL from hashed row numbers: each kind's
 * latency is a hump around its own typical time (reads fast, deletes slow),
 * and payload grows with latency, so both charts have shape to show.
 */
export const setupSql = (rows: number = ROWS): string => `
  CREATE TABLE requests AS
  WITH draws AS (
    SELECT
      CASE range % 3 WHEN 0 THEN 'read' WHEN 1 THEN 'write' ELSE 'delete' END AS kind,
      (hash(range) % 100000) / 100000.0 AS u1,
      (hash(range + 1000003) % 100000) / 100000.0 AS u2,
      (hash(range * 7 + 1) % 100000) / 100000.0 AS u3
    FROM range(${rows})
  ),
  timed AS (
    SELECT kind, u3,
      CASE kind WHEN 'read' THEN 120 WHEN 'write' THEN 320 ELSE 640 END * (0.4 + 0.6 * (u1 + u2)) AS latency
    FROM draws
  )
  SELECT latency, 20 + 0.12 * latency + 90 * u3 AS payload, kind FROM timed`;

export const KINDS = ['all', 'read', 'write', 'delete'] as const;
export type Kind = (typeof KINDS)[number];

export const BIN_CHOICES = [10, 20, 40, 80] as const;

/**
 * What the charts read from. Built only from the fixed kinds above, never from
 * text a visitor types: pushdown inserts it into the query as written.
 */
export const sourceOf = (kind: Kind): string =>
  kind === 'all' ? 'requests' : `(SELECT * FROM requests WHERE kind = '${kind}')`;

export const histogramSpec = (bins: number): PlotSpec => ({
  width: 640,
  height: 260,
  title: 'Latency by kind',
  description: 'Requests per latency bin, counted in DuckDB.',
  x: { label: 'Latency (ms)' },
  y: { label: 'Requests' },
  color: { domain: ['read', 'write', 'delete'] },
  marks: [
    {
      mark: 'rect',
      x: 'latency',
      fill: 'kind',
      // The kinds' histograms overlap, so each shows through the others.
      opacity: 0.6,
      inset: 0.5,
      transform: { type: 'bin', thresholds: bins },
    },
  ],
});

export const gridSpec = (bins: number): PlotSpec => ({
  width: 640,
  height: 300,
  title: 'Latency against payload',
  description: 'Requests per cell of a grid, counted in DuckDB.',
  x: { label: 'Latency (ms)' },
  y: { label: 'Payload (KB)' },
  color: { scheme: 'viridis' },
  marks: [
    {
      mark: 'rect',
      x: 'latency',
      y: 'payload',
      fill: 'count',
      transform: { type: 'bin', thresholds: bins },
    },
  ],
});

export type Ran = Readonly<{
  histogram: PlotSpec;
  grid: PlotSpec;
  /** Wall time for both charts' queries, in milliseconds. */
  ms: number;
  /** Every statement sent to DuckDB, in order. */
  statements: ReadonlyArray<string>;
}>;

/** A query function over a DuckDB-Wasm connection, whose results are Arrow tables. */
export const arrowQuery =
  (query: (sql: string) => Promise<ArrowTable> | ArrowTable) =>
  async (sql: string): Promise<ColumnTable> =>
    fromArrow(await query(sql));

/** Both charts for a bin count and kind, binned in DuckDB, with the statements it ran. */
export async function run(
  query: (sql: string) => Promise<ColumnTable>,
  bins: number,
  kind: Kind,
): Promise<Ran> {
  const statements: string[] = [];
  const recording = (sql: string) => {
    statements.push(sql);
    return query(sql);
  };
  const from = sourceOf(kind);
  const start = performance.now();
  const [histogram, grid] = await Promise.all([
    pushdown(histogramSpec(bins), { from, query: recording }),
    pushdown(gridSpec(Math.max(8, Math.round(bins / 2))), { from, query: recording }),
  ]);
  return { histogram, grid, ms: performance.now() - start, statements };
}
