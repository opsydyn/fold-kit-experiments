/**
 * One chart from its spec: inputs filled in, rows chosen by `where`, then compiled by
 * foldkit-viz. Pure and browser-safe, so the build and the page's script draw a chart
 * the same way.
 * @module Chart
 */
import { compilePlot, type PlotGeometry, type PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Result, Schema } from 'effect';

import { filterRows, type Values, withValues } from './inputs';
import { type Json, type JsonObject, Rows, Value } from './rows';

type Row = Rows[number];

const isRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));

/** Why a chart did not draw: its data, or its spec (with the path at fault when known). */
export type ChartProblem = {
  readonly kind: 'data' | 'spec';
  readonly path: string | null;
  readonly message: string;
};

/** A chart drawn: its spec as compiled, its geometry, and its series. */
export type Drawn = {
  readonly plot: PlotSpec;
  readonly geometry: PlotGeometry;
  readonly series: ReadonlyArray<Series>;
};

/** One series of a chart, as `describe` reports it: its points, and its low and high. */
export const Series = Schema.Struct({
  name: Schema.String,
  count: Schema.Int,
  /**
   * The lowest value, and every place it falls at (its `x`, or its category for
   * horizontal bars), in the order the rows give them.
   */
  low: Schema.Struct({ y: Schema.Finite, x: Schema.Array(Value) }),
  high: Schema.Struct({ y: Schema.Finite, x: Schema.Array(Value) }),
});
export type Series = typeof Series.Type;

const isNumber = Schema.is(Schema.Finite);

/** The marks whose rows are series of points along an axis. */
const seriesMarks = new Set(['line', 'area', 'dot', 'bar']);

/** A `where` in words, its conditions that filter (`region = Scotland`), or `''`. */
const conditionsText = (where: Json): string => {
  if (where === null || !isRecord(where)) return '';
  return Object.entries(where)
    .flatMap(([field, test]) => {
      if (test === null || test === undefined) return [];
      if (!isRecord(test)) return [`${field} = ${String(test)}`];
      const { min = null, max = null } = test;
      if (min !== null && max !== null) return [`${field} from ${String(min)} to ${String(max)}`];
      if (min !== null) return [`${field} at least ${String(min)}`];
      return max === null ? [] : [`${field} at most ${String(max)}`];
    })
    .join(' and ');
};

/** Where a group falls in `color.domain`, when the spec sets one; the rest after it. */
const domainOrder = (spec: JsonObject): ((name: string) => number) => {
  const color = spec['color'];
  const domain = isRecord(color) && Array.isArray(color['domain']) ? color['domain'] : [];
  const names = domain.map(String);
  return (name) => {
    const at = names.indexOf(name);
    return at === -1 ? names.length : at;
  };
};

/**
 * The series a chart's first mark draws (`line`, `area`, `dot` or `bar`, by its `stroke`,
 * `fill` or `z` field when that is not the axis it runs along, or one series), each with
 * its lowest and highest value and every place it is reached. A bar chart with its
 * numbers on x (horizontal bars) is measured along x. One series is named by its field
 * and the `where` that chose its rows (`orders where region = Scotland`). In
 * `color.domain` order when the spec sets one, else the rows' order. Empty for other
 * marks, or when x or y is not a field.
 */
const seriesOf = (spec: JsonObject, rows: Rows, where: Json): ReadonlyArray<Series> => {
  const marks = spec['marks'];
  const first = Array.isArray(marks) ? marks[0] : undefined;
  if (first === undefined || first === null || !isRecord(first)) return [];
  const { mark, x, y } = first;
  if (!isText(mark) || !seriesMarks.has(mark) || !isText(x) || !isText(y)) return [];
  const horizontal =
    mark === 'bar' && !rows.some((row) => isNumber(row[y])) && rows.some((row) => isNumber(row[x]));
  const [along, measure] = horizontal ? [y, x] : [x, y];
  const by = [first['stroke'], first['fill'], first['z']].find(
    (field) => isText(field) && field !== along,
  );
  const filtered = conditionsText(where);
  const single = filtered === '' ? measure : `${measure} where ${filtered}`;
  const groups = new Map<string, Array<Row>>();
  for (const row of rows) {
    const name = isText(by) ? String(row[by] ?? '') : single;
    groups.set(name, [...(groups.get(name) ?? []), row]);
  }
  const order = domainOrder(spec);
  return [...groups]
    .toSorted(([a], [b]) => order(a) - order(b))
    .flatMap(([name, members]) => {
      const points = members.flatMap((row) => {
        const value = row[measure];
        return isNumber(value) ? [{ x: row[along] ?? null, y: value }] : [];
      });
      const [start] = points;
      if (start === undefined) return [];
      const ys = points.map((point) => point.y);
      const extreme = (y: number) => ({
        y,
        x: points.filter((point) => point.y === y).map((point) => point.x),
      });
      return [
        {
          name,
          count: points.length,
          low: extreme(Math.min(...ys)),
          high: extreme(Math.max(...ys)),
        },
      ];
    });
};

/** The spec path at the start of a `compilePlot` message, such as `marks[0].y`. */
export const specPathOf = (message: string): string | null =>
  /^((?:[A-Za-z_$][\w$]*|\[\d+\])(?:\.[A-Za-z_$][\w$]*|\[\d+\])*):\s/.exec(message)?.[1] ?? null;

const problem = (kind: ChartProblem['kind'], message: string): ChartProblem => ({
  kind,
  path: kind === 'spec' ? specPathOf(message) : null,
  message,
});

const isText = Schema.is(Schema.String);
const decodeRows = Schema.decodeUnknownResult(Rows);

/** The rows a spec plots: its named data, or rows written in the spec. */
const rowsOf = (
  spec: JsonObject,
  data: ReadonlyMap<string, Rows>,
): Result.Result<Rows, ChartProblem> => {
  const named = spec['data'] ?? [];
  if (isText(named)) {
    const rows = data.get(named);
    return rows === undefined
      ? Result.fail(problem('data', `no data named "${named}"`))
      : Result.succeed(rows);
  }
  return Result.mapError(decodeRows(named), (error) =>
    problem('data', `data: inline rows must be objects of plain values: ${error.message}`),
  );
};

/** `where`, written for messages. */
const whereText = (where: Json): string => JSON.stringify(where);

/**
 * Draws a spec at `values`: references filled in, rows kept by `where` (an error when it
 * keeps none), and compiled. `data` holds the rows of every name the spec may use.
 */
export const drawSpec = (
  spec: JsonObject,
  data: ReadonlyMap<string, Rows>,
  values: Values,
): Result.Result<Drawn, ChartProblem> => {
  const filled = withValues(spec, values);
  // SAFETY: filling in values maps an object to an object of the same keys.
  const resolved = filled as JsonObject;
  return Result.flatMap(rowsOf(resolved, data), (rows) => {
    const where = resolved['where'] ?? null;
    const kept = filterRows(rows, where);
    if (Result.isFailure(kept)) return Result.fail(problem('spec', kept.failure));
    if (kept.success.length === 0 && rows.length > 0) {
      return Result.fail(problem('data', `where ${whereText(where)} keeps no rows`));
    }
    const { where: _, ...rest } = resolved;
    return Result.try({
      try: () => {
        const spec: JsonObject = { ...rest, data: kept.success };
        // SAFETY: compilePlot validates the whole spec and throws a RangeError naming the
        // path at fault, which becomes a `spec` problem; nothing reads it unchecked.
        const plot = spec as PlotSpec;
        return { plot, geometry: compilePlot(plot), series: seriesOf(spec, kept.success, where) };
      },
      catch: (error) => problem('spec', error instanceof Error ? error.message : String(error)),
    });
  });
};
