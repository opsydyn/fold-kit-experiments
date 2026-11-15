import { chartLayout } from './layout.js';
import type { ChartFrame, PlotBounds } from './layout.js';

/**
 * Cell geometry for heatmaps: a grid of categorical rows and columns, one
 * rectangle per finite value. Calendar heatmaps (week by weekday) and
 * correlation matrices are the same shape. Colour is the caller's: map
 * `value` through `colorScale` or `divergingScale` over `valueDomain`.
 */

export type CellAccessors<T> = Readonly<{
  key: (datum: T, index: number) => string;
  row: (datum: T, index: number) => string;
  column: (datum: T, index: number) => string;
  value: (datum: T, index: number) => number;
}>;

export type CellConfig = Readonly<{
  frame: ChartFrame;
  /** Share of each band left empty between cells, in [0, 1). Default 0.05. */
  padding?: number;
  /** Explicit orders; every row and column in the data must appear. Default first-seen. */
  rowOrder?: ReadonlyArray<string>;
  columnOrder?: ReadonlyArray<string>;
}>;

export type Cell<T> = Readonly<{
  datum: T;
  key: string;
  row: string;
  column: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type CellBand = Readonly<{ key: string; position: number }>;

export type CellGeometry<T> = Readonly<{
  cells: ReadonlyArray<Cell<T>>;
  rows: ReadonlyArray<CellBand>;
  columns: ReadonlyArray<CellBand>;
  /** [min, max] of the finite values; [0, 0] when there are none. */
  valueDomain: readonly [number, number];
  plot: PlotBounds;
}>;

const ordered = (
  seen: ReadonlyArray<string>,
  explicit: ReadonlyArray<string> | undefined,
  name: string,
): ReadonlyArray<string> => {
  const unique = [...new Set(seen)];
  if (explicit === undefined) return unique;
  if (new Set(explicit).size !== explicit.length)
    throw new RangeError(`Cell ${name} order must not repeat keys`);
  const known = new Set(explicit);
  if (!unique.every((key) => known.has(key)))
    throw new RangeError(`Every ${name} in the data must appear in the ${name} order`);
  return explicit;
};

export function cellGeometry<T>(
  data: ReadonlyArray<T>,
  accessors: CellAccessors<T>,
  config: CellConfig,
): CellGeometry<T> {
  const padding = config.padding ?? 0.05;
  if (!Number.isFinite(padding) || padding < 0 || padding >= 1)
    throw new RangeError('Cell padding must be finite in [0, 1)');
  const { plot } = chartLayout(config.frame, [0, 1], [0, 1]);
  const keys = new Set<string>();
  const pairs = new Set<string>();
  const samples = data.map((datum, index) => {
    const key = accessors.key(datum, index);
    if (key === '' || keys.has(key)) throw new RangeError('Cell keys must be unique and non-empty');
    keys.add(key);
    const row = accessors.row(datum, index),
      column = accessors.column(datum, index);
    const pair = JSON.stringify([row, column]);
    if (pairs.has(pair))
      throw new RangeError(`Duplicate cell at row ${row}, column ${column}: aggregate first`);
    pairs.add(pair);
    return { datum, key, row, column, value: accessors.value(datum, index) };
  });
  const rows = ordered(
    samples.map((s) => s.row),
    config.rowOrder,
    'row',
  );
  const columns = ordered(
    samples.map((s) => s.column),
    config.columnOrder,
    'column',
  );
  const columnStep = plot.width / Math.max(1, columns.length);
  const rowStep = plot.height / Math.max(1, rows.length);
  const columnIndex = new Map(columns.map((key, i) => [key, i]));
  const rowIndex = new Map(rows.map((key, i) => [key, i]));
  const finite = samples.filter((s) => Number.isFinite(s.value));
  const values = finite.map((s) => s.value);
  return {
    cells: finite.map((s) => ({
      ...s,
      x: plot.left + (columnIndex.get(s.column) ?? 0) * columnStep + (columnStep * padding) / 2,
      y: plot.top + (rowIndex.get(s.row) ?? 0) * rowStep + (rowStep * padding) / 2,
      width: columnStep * (1 - padding),
      height: rowStep * (1 - padding),
    })),
    rows: rows.map((key, i) => ({ key, position: plot.top + (i + 0.5) * rowStep })),
    columns: columns.map((key, i) => ({ key, position: plot.left + (i + 0.5) * columnStep })),
    valueDomain: values.length === 0 ? [0, 0] : [Math.min(...values), Math.max(...values)],
    plot,
  };
}
