import { binThresholds } from '../math/bin.js';
import { rectBinEdges } from '../math/bin2d.js';
import { channelOf, fieldOf } from './channels.js';
import type { ChannelName } from './channels.js';
import { rowsOf } from './columns.js';
import { seriesField } from './marks-rect.js';
import type { ColumnTable, MarkSpec, PlotSpec, Row, Value } from './types.js';

/**
 * Pushdown: a spec whose data lives in a SQL engine (DuckDB in Bun, Node or
 * the browser, or Polars' SQL context), drawn from what the engine sends back
 * rather than every row. Binned rect marks are counted in the engine, on
 * breakpoints from the same functions local binning uses, so the chart is the
 * one compiling every row would draw; other marks pull only the columns they
 * use. As VegaFusion does for Vega.
 */

export type SqlSource = Readonly<{
  /**
   * What follows FROM: a table name, or a subquery or table function. It is
   * inserted as written, so it must never come from untrusted input. Field
   * names from the spec are quoted.
   */
  from: string;
  /** Runs a query and returns its result as a column table, such as with fromDuckDB. */
  query: (sql: string) => Promise<ColumnTable>;
}>;

const fail = (message: string): never => {
  throw new RangeError(message);
};

/**
 * A finite number, portably: DuckDB has isfinite but Polars SQL does not. A
 * range test excludes nulls and infinities, and NaN, which compares false.
 */
const finite = (field: string): string =>
  `${field} > CAST('-Infinity' AS DOUBLE) AND ${field} < CAST('Infinity' AS DOUBLE)`;

/** A quoted SQL identifier: a field name cannot change the query. */
const quote = (name: string): string => `"${name.replaceAll('"', '""')}"`;

/** A number as an exact SQL double: a bare decimal literal would be a DECIMAL in DuckDB. */
const double = (value: number): string => `CAST(${String(value)} AS DOUBLE)`;

const isNumber = (value: Value): value is number => typeof value === 'number';

/** Two-dimensional bins take a count of bins per side. */
const isCount = (thresholds: number | ReadonlyArray<number> | undefined): thresholds is number =>
  typeof thresholds === 'number';

const CHANNELS: ReadonlyArray<ChannelName> = [
  'x',
  'y',
  'x0',
  'y0',
  'x1',
  'y1',
  'x2',
  'y2',
  'r',
  'fill',
  'stroke',
  'text',
  'title',
  'path',
  'value',
  'source',
  'target',
  'symbol',
];

/** Marks whose fields are all channels, so pulling those columns is enough. */
const PLAIN_MARKS: ReadonlySet<MarkSpec['mark']> = new Set([
  'dot',
  'line',
  'area',
  'bar',
  'rect',
  'rule',
  'text',
  'cell',
  'box',
  'violin',
  'density',
  'link',
  'arc',
]);

type Rect = Extract<MarkSpec, { mark: 'rect' }>;

/** A binned rect the engine can count: its carried fields are only the field it groups by. */
function pushable(mark: MarkSpec): mark is Rect & { transform: NonNullable<Rect['transform']> } {
  if (mark.mark !== 'rect' || mark.transform === undefined || mark.data !== undefined) return false;
  const series = seriesField(mark);
  const carried = [mark.z, fieldOf(mark.fill), fieldOf(mark.stroke)].filter((f) => f !== undefined);
  return mark.y !== undefined ? true : carried.every((field) => field === series);
}

/** The columns a mark reads, or every column when its fields are not all channels. */
function columnsOf(mark: MarkSpec): ReadonlyArray<string> | 'all' {
  if (!PLAIN_MARKS.has(mark.mark)) return 'all';
  const fields = new Set<string>();
  for (const name of CHANNELS) {
    const field = fieldOf(channelOf(mark, name));
    if (field !== undefined) fields.add(field);
  }
  if ('z' in mark && mark.z !== undefined) fields.add(mark.z);
  if ('highlight' in mark && mark.highlight !== undefined) fields.add(mark.highlight.field);
  return [...fields];
}

/** The finite extent of a column, or none. */
async function extentOf(
  source: SqlSource,
  field: string,
): Promise<readonly [number, number] | undefined> {
  const f = quote(field);
  const result = await source.query(
    `SELECT min(${f}) AS lo, max(${f}) AS hi FROM ${source.from} WHERE ${finite(f)}`,
  );
  const lo = result.columns.lo?.[0] ?? null,
    hi = result.columns.hi?.[0] ?? null;
  return isNumber(lo) && isNumber(hi) && Number.isFinite(lo) && Number.isFinite(hi)
    ? [lo, hi]
    : undefined;
}

/** A one-dimensional histogram's rows, as binRows writes them. */
async function histogram(
  mark: Rect & { transform: NonNullable<Rect['transform']> },
  source: SqlSource,
) {
  const x = fieldOf(mark.x) ?? fail('pushdown: a binned rect mark needs an x field');
  const transform = mark.transform;
  const reduce = transform.reduce ?? 'count';
  const domain = transform.domain ?? (await extentOf(source, x));
  if (domain === undefined) return [];
  const thresholds = binThresholds(domain, transform.thresholds ?? 20);
  const edges = thresholds.length + 1;
  const series = seriesField(mark);
  const f = quote(x);
  const key = series === undefined ? 'NULL' : quote(series);
  // A value's bin is how many breakpoints are at or below it, as bin() bisects.
  const bucket =
    thresholds.length === 0
      ? '0'
      : thresholds.map((t) => `(CASE WHEN ${f} >= ${double(t)} THEN 1 ELSE 0 END)`).join(' + ');
  // Series in the order they first appear, as local binning groups them, with every row counted for proportions.
  const order = await source.query(
    `SELECT s, min(n) AS first, count(*) AS total FROM (SELECT ${key} AS s, row_number() OVER () AS n FROM ${source.from}) GROUP BY s ORDER BY first`,
  );
  const counts = await source.query(
    `SELECT ${key} AS s, ${bucket} AS b, count(*) AS c FROM ${source.from} WHERE ${finite(f)} AND ${f} >= ${double(domain[0])} AND ${f} <= ${double(domain[1])} GROUP BY s, b`,
  );
  const tally = new Map<string, number>();
  const keyOf = (value: Value): string => (series === undefined ? 'all' : String(value ?? ''));
  for (const row of rowsOf(counts))
    tally.set(`${keyOf(row.s ?? null)}\u0000${Number(row.b)}`, Number(row.c));
  const out: Row[] = [];
  for (const group of rowsOf(order)) {
    const value = group.s ?? null;
    const total = Number(group.total);
    for (let b = 0; b < edges; b += 1) {
      const count = tally.get(`${keyOf(value)}\u0000${b}`) ?? 0;
      const row: Row = {
        x1: b === 0 ? domain[0] : (thresholds[b - 1] ?? domain[0]),
        x2: b === edges - 1 ? domain[1] : (thresholds[b] ?? domain[1]),
        count,
        proportion: total === 0 ? 0 : count / total,
      };
      out.push(series === undefined ? row : { [series]: value, ...row });
    }
  }
  return out;
}

/** A two-dimensional histogram's non-empty cells, as binRows writes them. */
async function grid(mark: Rect & { transform: NonNullable<Rect['transform']> }, source: SqlSource) {
  const x = fieldOf(mark.x) ?? fail('pushdown: a binned rect mark needs an x field');
  const y = fieldOf(mark.y) ?? fail('pushdown: a two-dimensional bin needs a y field');
  const xSpan = mark.transform.domain ?? (await extentOf(source, x)),
    ySpan = await extentOf(source, y);
  if (xSpan === undefined || ySpan === undefined) return [];
  const widen = (span: readonly [number, number]): readonly [number, number] =>
    span[0] < span[1] ? span : [span[0] - 0.5, span[1] + 0.5];
  const xDomain = widen(xSpan),
    yDomain = widen(ySpan);
  const count = isCount(mark.transform.thresholds) ? mark.transform.thresholds : 20;
  const index = (field: string, [lo, hi]: readonly [number, number]) =>
    `CASE WHEN ${quote(field)} = ${double(hi)} THEN ${count - 1} ELSE CAST(floor((${quote(field)} - ${double(lo)}) / (${double(hi)} - ${double(lo)}) * ${count}) AS INTEGER) END`;
  const inside = (field: string, [lo, hi]: readonly [number, number]) =>
    `${finite(quote(field))} AND ${quote(field)} >= ${double(lo)} AND ${quote(field)} <= ${double(hi)}`;
  const cells = await source.query(
    `SELECT ${index(x, xDomain)} AS i, ${index(y, yDomain)} AS j, count(*) AS c FROM ${source.from} WHERE ${inside(x, xDomain)} AND ${inside(y, yDomain)} GROUP BY i, j ORDER BY i, j`,
  );
  const edges = rectBinEdges({ xDomain, yDomain, xCount: count, yCount: count });
  return rowsOf(cells).map((cell) => {
    const { x0, x1, y0, y1 } = edges(Number(cell.i), Number(cell.j));
    return { x1: x0, x2: x1, y1: y0, y2: y1, count: Number(cell.c) };
  });
}

/** The label compiling every row would give an axis: its one field, or none. */
function labelOf(spec: PlotSpec, axis: 'x' | 'y'): string {
  const fields = new Set<string>();
  for (const mark of spec.marks) {
    if (mark.mark === 'rect' && mark.transform !== undefined) {
      const reduce = mark.transform.reduce ?? 'count';
      const field =
        axis === 'x' ? fieldOf(mark.x) : mark.y === undefined ? reduce : fieldOf(mark.y);
      if (field !== undefined) fields.add(field);
      continue;
    }
    const field = fieldOf(channelOf(mark, axis));
    if (field !== undefined) fields.add(field);
  }
  return fields.size === 1 ? ([...fields][0] ?? '') : '';
}

/**
 * The spec with its data drawn from a SQL engine: each binned rect mark's bins
 * counted there, and every other mark's columns pulled. A spec that already
 * has data is returned as it is. Faceted specs are refused: facets need every
 * mark's rows.
 */
export async function pushdown(spec: PlotSpec, source: SqlSource): Promise<PlotSpec> {
  if (spec.data !== undefined) return spec;
  if (spec.facet !== undefined)
    fail('pushdown: facets need every row; query the data and compile it');
  const marks = await Promise.all(
    spec.marks.map(async (mark): Promise<MarkSpec> => {
      if (mark.data !== undefined) return mark;
      if (pushable(mark)) {
        const two = mark.y !== undefined;
        const rows = two ? await grid(mark, source) : await histogram(mark, source);
        const { x: _x, y: _y, transform, ...rest } = mark;
        return two
          ? { ...rest, data: rows, x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2' }
          : { ...rest, data: rows, x1: 'x1', x2: 'x2', y2: transform.reduce ?? 'count' };
      }
      const columns = columnsOf(mark);
      const list = columns === 'all' ? '*' : columns.map(quote).join(', ');
      return { ...mark, data: await source.query(`SELECT ${list} FROM ${source.from}`) };
    }),
  );
  return {
    ...spec,
    x: { ...spec.x, label: spec.x?.label ?? labelOf(spec, 'x') },
    y: { ...spec.y, label: spec.y?.label ?? labelOf(spec, 'y') },
    marks,
  };
}
