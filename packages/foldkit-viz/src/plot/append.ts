import { columnTable, isColumnTable, rowsOf } from './columns.js';
import { compilePlot } from './compile.js';
import type {
  Channel,
  Column,
  ColumnTable,
  Graphic,
  PlotData,
  PlotGeometry,
  PlotSpec,
  Value,
} from './types.js';

/**
 * Streaming appends: data that arrives in chunks, such as a DuckDB result read
 * a chunk at a time, plotted as it grows. A column store holds the chunks
 * without copying what it already holds; appendPoints adds a chunk's dense
 * points to compiled geometry without recompiling the rows before it.
 */

const fail = (message: string): never => {
  throw new RangeError(message);
};

type Points = Extract<Graphic, { kind: 'points' }>;

/** A column a store grows: numbers in a Float64Array that doubles, anything else in an array. */
type Growing = { kind: 'numbers'; values: Float64Array } | { kind: 'values'; values: Value[] };

const isNumber = (value: Value): value is number => typeof value === 'number';

const isTyped = (column: Column): column is Exclude<Column, ReadonlyArray<Value>> =>
  !Array.isArray(column);

export type ColumnStore = Readonly<{
  /** Adds a chunk with the store's columns, and returns the table of every row so far. */
  append: (chunk: PlotData) => ColumnTable;
  /** The table of every row so far. */
  table: () => ColumnTable;
}>;

/**
 * A column table that grows chunk by chunk. Numeric columns live in buffers
 * that double, so an append copies only the chunk; each table is a view of the
 * rows so far, which later appends leave unchanged. In a numeric column a null
 * becomes NaN, as duckdbColumns gives.
 */
export function columnStore(): ColumnStore {
  let names: ReadonlyArray<string> | undefined;
  const growing = new Map<string, Growing>();
  let length = 0;
  let current: ColumnTable = columnTable({});

  const room = (column: Extract<Growing, { kind: 'numbers' }>, needed: number) => {
    if (column.values.length >= needed) return;
    const bigger = new Float64Array(Math.max(needed, column.values.length * 2, 1024));
    bigger.set(column.values.subarray(0, length));
    column.values = bigger;
  };

  const append = (chunk: PlotData): ColumnTable => {
    const table = isColumnTable(chunk) ? chunk : fromRows(chunk);
    const chunkNames = Object.keys(table.columns);
    if (names === undefined) {
      names = chunkNames;
      for (const name of names) {
        const column = table.columns[name];
        growing.set(
          name,
          column !== undefined && isTyped(column)
            ? { kind: 'numbers', values: new Float64Array(0) }
            : { kind: 'values', values: [] },
        );
      }
    } else if (
      chunkNames.length !== names.length ||
      chunkNames.some((name, i) => name !== names?.[i])
    )
      fail(
        `append: the chunk has columns ${chunkNames.join(', ')}; the store has ${names.join(', ')}`,
      );
    const end = length + table.length;
    for (const name of names) {
      const column = table.columns[name] ?? [];
      const into = growing.get(name);
      if (into === undefined) continue;
      if (into.kind === 'numbers') {
        room(into, end);
        if (isTyped(column)) into.values.set(column, length);
        else
          for (let i = 0; i < table.length; i += 1) {
            const value = column[i] ?? null;
            into.values[length + i] = isNumber(value) ? value : Number.NaN;
          }
      } else for (let i = 0; i < table.length; i += 1) into.values.push(column[i] ?? null);
    }
    length = end;
    current = columnTable(
      Object.fromEntries(
        [...growing].map(([name, column]) => [
          name,
          // A view of the rows so far: later appends write beyond it, or into a new buffer.
          column.kind === 'numbers'
            ? column.values.subarray(0, length)
            : column.values.slice(0, length),
        ]),
      ),
    );
    return current;
  };

  return { append, table: () => current };
}

const fromRows = (rows: PlotData): ColumnTable => {
  const list = rowsOf(rows);
  const names = [...new Set(list.flatMap((row) => Object.keys(row)))];
  return columnTable(
    Object.fromEntries(names.map((name) => [name, list.map((row) => row[name] ?? null)])),
  );
};

/** Why a spec cannot append: a scale a chunk could change, or a mark that needs every row. */
function refusal(spec: PlotSpec): string | undefined {
  if (spec.facet !== undefined) return 'appendPoints: facets come from the data; recompile instead';
  const bad = spec.marks.findIndex((mark) => mark.mark !== 'dot' || mark.dense !== true);
  if (bad >= 0)
    return `appendPoints: marks[${bad}] is a ${spec.marks[bad]?.mark} mark; only dense dot marks append`;
  const localData = spec.marks.findIndex((mark) => mark.data !== undefined);
  if (localData >= 0)
    return `appendPoints: marks[${localData}].data overrides the streamed data; recompile instead`;
  for (const axis of ['x', 'y'] as const)
    if (spec[axis]?.domain === undefined)
      return `appendPoints: ${axis} needs a fixed domain, or a new chunk could move every point; recompile instead`;
  const fieldOf = (channel: Channel | undefined): channel is string => typeof channel === 'string';
  const dots = spec.marks.flatMap((mark) => (mark.mark === 'dot' ? [mark] : []));
  if (
    dots.some((mark) => fieldOf(mark.fill) || fieldOf(mark.stroke)) &&
    spec.color?.domain === undefined
  )
    return 'appendPoints: color needs a fixed domain, or a new chunk could recolour every point; recompile instead';
  if (dots.some((mark) => fieldOf(mark.r)))
    return 'appendPoints: r from a field scales with the data, so a new chunk could resize every point; recompile instead';
  return undefined;
}

/** Two packed graphics as one: the chunk's colours mapped into the merged palette, its rows offset. */
function merged(before: Points | undefined, chunk: Points, rowOffset: number): Points {
  if (before === undefined) {
    const { dimmed: _dimmed, ...plain } = chunk;
    return { ...plain, rows: chunk.rows.map((row) => row + rowOffset) };
  }
  const palette = [...before.palette];
  const remap = chunk.palette.map((colour) => {
    const at = palette.indexOf(colour);
    if (at >= 0) return at;
    palette.push(colour);
    return palette.length - 1;
  });
  const count = before.count + chunk.count;
  const concat = <A extends Float64Array | Uint16Array | Uint32Array>(
    make: (n: number) => A,
    a: A,
    b: A,
  ): A => {
    const out = make(count);
    out.set(a, 0);
    out.set(b, before.count);
    return out;
  };
  const paint = new Uint16Array(count);
  paint.set(before.paint, 0);
  for (let i = 0; i < chunk.count; i += 1)
    paint[before.count + i] = remap[chunk.paint[i] ?? 0] ?? 0;
  const rows = new Uint32Array(count);
  rows.set(before.rows, 0);
  for (let i = 0; i < chunk.count; i += 1)
    rows[before.count + i] = (chunk.rows[i] ?? 0) + rowOffset;
  const radiusOf = (g: Points) =>
    g.radius instanceof Float64Array ? g.radius : new Float64Array(g.count).fill(g.radius);
  const radius =
    !(before.radius instanceof Float64Array) &&
    !(chunk.radius instanceof Float64Array) &&
    before.radius === chunk.radius
      ? before.radius
      : concat((n) => new Float64Array(n), radiusOf(before), radiusOf(chunk));
  const { dimmed: _dimmed, ...plain } = before;
  return {
    ...plain,
    count,
    xs: concat((n) => new Float64Array(n), before.xs, chunk.xs),
    ys: concat((n) => new Float64Array(n), before.ys, chunk.ys),
    radius,
    palette,
    paint,
    rows,
  };
}

/**
 * Geometry with a chunk of rows appended to its dense dot marks, compiling
 * only the chunk: for data that streams in. The spec must be the one the
 * geometry was compiled from (its data is ignored) with nothing a chunk could
 * change: fixed x and y domains, a fixed colour domain when colour is mapped,
 * no mapped radius or facets, and dense dot marks without mark-local data. Anything else is refused, to
 * be recompiled. `rowOffset` is how many rows came before the chunk, so each
 * point's row indexes the whole data. A highlight is dropped: restyle the new
 * geometry with highlightPoints.
 */
export function appendPoints(
  geometry: PlotGeometry,
  spec: PlotSpec,
  chunk: PlotData,
  options: Readonly<{ rowOffset: number }>,
): PlotGeometry {
  const refused = refusal(spec);
  if (refused !== undefined) fail(refused);
  const added = compilePlot({ ...spec, data: chunk });
  const facets = geometry.facets.map((facet, f) => ({
    ...facet,
    marks: facet.marks.map((mark, m) => {
      const incoming = added.facets[f]?.marks[m]?.graphics.find(
        (g): g is Points => g.kind === 'points',
      );
      if (incoming === undefined) return mark;
      const before = mark.graphics.find((g): g is Points => g.kind === 'points');
      const others = mark.graphics.filter((g) => g.kind !== 'points');
      return { ...mark, graphics: [...others, merged(before, incoming, options.rowOffset)] };
    }),
  }));
  return { ...geometry, facets };
}
