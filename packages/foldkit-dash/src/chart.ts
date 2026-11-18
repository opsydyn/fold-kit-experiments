/**
 * One chart from its spec: inputs filled in, rows chosen by `where`, then compiled by
 * foldkit-viz. Pure and browser-safe, so the build and the page's script draw a chart
 * the same way.
 * @module Chart
 */
import { compilePlot, type PlotGeometry, type PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Option, Result, Schema } from 'effect';

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

/**
 * The input a chart sets when a reader clicks one of its categories (ADR 0116): the
 * input's name, the axis of categories, and those categories as the axis names them.
 */
export type Selects = {
  readonly input: string;
  readonly axis: 'x' | 'y';
  readonly categories: ReadonlyArray<string>;
};

/** A chart drawn: its spec as compiled, its geometry, its series, and what it selects. */
export type Drawn = {
  readonly plot: PlotSpec;
  readonly geometry: PlotGeometry;
  readonly series: ReadonlyArray<Series>;
  readonly selects: Selects | null;
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
  /** A bar chart's bars, highest first, when there are at most `rankedBars` (ADR 0116). */
  ranked: Schema.optionalKey(Schema.Array(Schema.Struct({ x: Value, y: Schema.Finite }))),
});
export type Series = typeof Series.Type;

const isNumber = Schema.is(Schema.Finite);

/** The most bars `describe` ranks one by one; past it, only the highest and lowest. */
export const rankedBars = 24;

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
      const series = {
        name,
        count: points.length,
        low: extreme(Math.min(...ys)),
        high: extreme(Math.max(...ys)),
      };
      return [
        mark === 'bar' && points.length <= rankedBars
          ? { ...series, ranked: points.toSorted((a, b) => b.y - a.y) }
          : series,
      ];
    });
};

/** A chart's axis of categories, if it has one: the first facet's band axis. */
const bandOf = (geometry: PlotGeometry): Option.Option<Omit<Selects, 'input'>> => {
  const facet = geometry.facets[0];
  const axis = (['x', 'y'] as const).find((each) => facet?.[each]?.type === 'band');
  const scale = axis === undefined ? undefined : facet?.[axis];
  return axis === undefined || scale === undefined || scale === null
    ? Option.none()
    : Option.some({ axis, categories: scale.domain.map(String) });
};

/**
 * The spec with its first mark dimmed except where its field on the `axis` of categories
 * is `chosen` (foldkit-viz's `highlight`), so a reader sees what they clicked. None
 * when nothing is chosen, or the mark already has a highlight of its own.
 */
const highlightOf = (
  spec: JsonObject,
  axis: 'x' | 'y',
  chosen: Json,
): Option.Option<JsonObject> => {
  const marks = spec['marks'];
  const [first, ...others] = Array.isArray(marks) ? marks : [];
  const mark = first !== undefined && first !== null && isRecord(first) ? first : undefined;
  const field = mark?.[axis];
  return chosen === null || mark === undefined || !isText(field) || mark['highlight'] !== undefined
    ? Option.none()
    : Option.some({
        ...spec,
        marks: [{ ...mark, highlight: { field, values: [chosen] } }, ...others],
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
    const { where: _, select, ...rest } = resolved;
    if (select !== undefined && !isText(select)) {
      return Result.fail(problem('spec', 'select: name an input, as "select": "region"'));
    }
    return Result.flatMap(
      Result.try({
        try: () => {
          const spec: JsonObject = { ...rest, data: kept.success };
          // SAFETY: compilePlot validates the whole spec and throws a RangeError naming the
          // path at fault, which becomes a `spec` problem; nothing reads it unchecked.
          const plot = spec as PlotSpec;
          return { spec, plot, geometry: compilePlot(plot) };
        },
        catch: (error) => problem('spec', error instanceof Error ? error.message : String(error)),
      }),
      ({ spec, plot, geometry }): Result.Result<Drawn, ChartProblem> => {
        const series = seriesOf(spec, kept.success, where);
        if (select === undefined) return Result.succeed({ plot, geometry, series, selects: null });
        const band = bandOf(geometry);
        if (Option.isNone(band)) {
          return Result.fail(
            problem('spec', 'select: the chart has no axis of categories for a reader to click'),
          );
        }
        const selects = { input: select, ...band.value };
        const highlighted = highlightOf(spec, band.value.axis, values[select] ?? null);
        if (Option.isNone(highlighted)) return Result.succeed({ plot, geometry, series, selects });
        // SAFETY: the spec compiled above; a highlight on its first mark's own field is one
        // compilePlot accepts.
        const lit = highlighted.value as PlotSpec;
        return Result.succeed({ plot: lit, geometry: compilePlot(lit), series, selects });
      },
    );
  });
};
