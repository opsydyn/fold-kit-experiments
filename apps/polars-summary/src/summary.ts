import { columnTable } from '@opsydyn/foldkit-viz/plot';
import type { ColumnTable, PlotSpec } from '@opsydyn/foldkit-viz/plot';
import pl from 'nodejs-polars';

/**
 * Aggregation in the engine: Polars bins a million requests, and the plot
 * receives only the bins. Each summary is a column table of plain arrays, so a
 * spec built on it is still JSON.
 */

/** Where the summaries are cut: latency bin width, and the latency they stop at. */
export type SummaryOptions = Readonly<{ binWidth: number; maxLatency: number }>;

export const DEFAULT_OPTIONS: SummaryOptions = { binWidth: 50, maxLatency: 3_000 };

/** A frame's named float column as a plain array, the JSON form of a column. */
const plainColumn = (frame: pl.DataFrame, name: string): ReadonlyArray<number> =>
  Array.from(frame.getColumn(name).toTypedArray(), Number);

/** The requests at or under the latency cap. */
const capped = (requests: pl.DataFrame, { maxLatency }: SummaryOptions): pl.DataFrame =>
  requests.filter(pl.col('latency').ltEq(maxLatency));

/** Requests per latency bin: one row per non-empty bin, with its edges and count. */
export function latencyHistogram(requests: pl.DataFrame, options: SummaryOptions): ColumnTable {
  const { binWidth } = options;
  const bins = capped(requests, options)
    .select(pl.col('latency').div(binWidth).floor().mul(binWidth).alias('x1'))
    .groupBy('x1')
    .agg(pl.len().cast(pl.Float64).alias('count'))
    .sort('x1')
    .withColumns(pl.col('x1').add(binWidth).alias('x2'));
  return columnTable({
    x1: plainColumn(bins, 'x1'),
    x2: plainColumn(bins, 'x2'),
    count: plainColumn(bins, 'count'),
  });
}

/**
 * Requests per latency and payload cell: the density /explore shows point by
 * point, as a grid of counts. Empty cells are left out.
 */
export function densityGrid(
  requests: pl.DataFrame,
  options: SummaryOptions,
  payloadStep = 10,
): ColumnTable {
  const { binWidth } = options;
  const cells = capped(requests, options)
    .select(
      pl.col('latency').div(binWidth).floor().mul(binWidth).alias('x1'),
      pl.col('payload').div(payloadStep).floor().mul(payloadStep).alias('y1'),
    )
    .groupBy(['x1', 'y1'])
    .agg(pl.len().cast(pl.Float64).alias('count'))
    .sort(['x1', 'y1'])
    .withColumns(
      pl.col('x1').add(binWidth).alias('x2'),
      pl.col('y1').add(payloadStep).alias('y2'),
      // Counts span four orders of magnitude, so the colour reads their log, computed here.
      pl.col('count').log(10).alias('shade'),
    );
  return columnTable({
    x1: plainColumn(cells, 'x1'),
    x2: plainColumn(cells, 'x2'),
    y1: plainColumn(cells, 'y1'),
    y2: plainColumn(cells, 'y2'),
    count: plainColumn(cells, 'count'),
    shade: plainColumn(cells, 'shade'),
  });
}

/** The published schema, named in every spec this server sends. */
export const SCHEMA_URL = 'https://unpkg.com/@opsydyn/foldkit-viz/schema/plot-spec.schema.json';

export const histogramSpec = (bins: ColumnTable, options: SummaryOptions): PlotSpec => ({
  $schema: SCHEMA_URL,
  width: 720,
  height: 240,
  title: 'Requests by latency',
  description: `Requests up to ${options.maxLatency} ms, in ${options.binWidth} ms bins, counted by Polars.`,
  data: bins,
  x: { label: 'Latency (ms)' },
  y: { label: 'Requests' },
  marks: [{ mark: 'rect', x1: 'x1', x2: 'x2', y2: 'count', fill: { value: '#6366f1' } }],
});

export const densitySpec = (cells: ColumnTable, options: SummaryOptions): PlotSpec => ({
  $schema: SCHEMA_URL,
  width: 720,
  height: 420,
  title: 'Latency against payload',
  description: `How many requests fall in each ${options.binWidth} ms by 10 KB cell, counted by Polars.`,
  data: cells,
  x: { label: 'Latency (ms)' },
  y: { label: 'Payload (KB)' },
  color: { scheme: 'viridis', label: 'Requests per cell (log₁₀)' },
  marks: [{ mark: 'rect', x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', fill: 'shade', title: 'count' }],
});
