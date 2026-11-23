/**
 * One chart from its spec: inputs filled in, rows chosen by `where`, then compiled by
 * foldkit-viz. Pure and browser-safe, so the build and the page's script draw a chart
 * the same way.
 * @module Chart
 */
import { compileChecked, decodePlot, type PlotIssue } from '@opsydyn/foldkit-viz/effect/plot';
import {
  invertAxis,
  invertPlot,
  type PlotAxis,
  type PlotGeometry,
  type PlotSpec,
} from '@opsydyn/foldkit-viz/plot';
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
 * The input a chart sets when a reader clicks it: its name, and the categories a click
 * can choose. A chart of bars (or any chart with an axis of categories) chooses the
 * category on that `axis` (ADR 0116); a line, area or dot chart of several series
 * chooses the series nearest the press, by its `field` (ADR 0117).
 */
export type Selects = {
  readonly input: string;
  readonly categories: ReadonlyArray<string>;
  readonly by:
    | { readonly _tag: 'Band'; readonly axis: 'x' | 'y' }
    | { readonly _tag: 'Series'; readonly field: string; readonly x: string; readonly y: string };
};

/** A chart drawn: its spec as compiled, its geometry, its series, and what it selects. */
export type Drawn = {
  readonly plot: PlotSpec;
  readonly geometry: PlotGeometry;
  readonly series: ReadonlyArray<Series>;
  readonly selects: Selects | null;
  /** The rows drawn, after `where`. */
  readonly rows: Rows;
  /** The first mark's fields and the axes' labels, for read-outs (ADR 0118). */
  readonly fields: Fields | null;
  /** The `between` input a drag across the chart's `x` sets (ADR 0119), if any. */
  readonly brushes: string | null;
};

/** What a chart's first mark plots, and how its axes are labelled. */
export type Fields = {
  readonly mark: string;
  readonly x: string;
  readonly y: string;
  /** The series field (`stroke`, `fill` or `z`), unless it is the category axis's. */
  readonly by: string | null;
  readonly xLabel: string;
  readonly yLabel: string;
};

/** A point of a series: its `x` (or category) and its value. */
const Point = Schema.Struct({ x: Value, y: Schema.Finite });
type Point = typeof Point.Type;

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
  ranked: Schema.optionalKey(Schema.Array(Point)),
  /**
   * A line, area or dot series' largest fall, from a high to a later low, and largest
   * rise, from a low to a later high, in `x` order (ADR 0117); absent when it never falls
   * (or rises).
   */
  fall: Schema.optionalKey(Schema.Struct({ from: Point, to: Point })),
  rise: Schema.optionalKey(Schema.Struct({ from: Point, to: Point })),
  /**
   * The climb after the largest fall: from its low to the highest point after it (the
   * first, on a tie); absent when nothing after the low is higher. "Dips, then climbs"
   * is the fall and this, not the largest rise, which can start before the dip.
   */
  recovery: Schema.optionalKey(Schema.Struct({ from: Point, to: Point })),
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
  const each = [...groups]
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
      if (mark === 'bar') {
        return [
          points.length <= rankedBars
            ? { ...series, ranked: points.toSorted((a, b) => b.y - a.y) }
            : series,
        ];
      }
      return [{ ...series, ...movesOf(inXOrder(points)) }];
    });
  // A grouped or stacked bar chart also gives each category's total, first.
  const totals = mark === 'bar' && isText(by) ? barTotals(rows, along, measure) : [];
  return [...totals, ...each];
};

const isoDate = /^\d{4}-\d{2}-\d{2}/;

/**
 * A grouped or stacked bar chart's total per category (ADR 0119): the sum of every
 * group's value in it, ranked, as a series named `total <field>`. It confirms "South
 * East had the most orders in July and August" when the bars stack a week each.
 */
const barTotals = (rows: Rows, along: string, measure: string): ReadonlyArray<Series> => {
  const sums = new Map<string, { readonly x: Value; readonly y: number }>();
  for (const row of rows) {
    const value = row[measure];
    if (!isNumber(value)) continue;
    const key = String(row[along] ?? '');
    sums.set(key, { x: row[along] ?? null, y: (sums.get(key)?.y ?? 0) + value });
  }
  const points = [...sums.values()].map(({ x, y }) => ({ x, y: Math.round(y * 1e9) / 1e9 }));
  if (points.length === 0) return [];
  const ys = points.map((point) => point.y);
  const extreme = (y: number) => ({
    y,
    x: points.filter((point) => point.y === y).map((point) => point.x),
  });
  const series = {
    name: `total ${measure}`,
    count: points.length,
    low: extreme(Math.min(...ys)),
    high: extreme(Math.max(...ys)),
  };
  return [
    points.length <= rankedBars
      ? { ...series, ranked: points.toSorted((a, b) => b.y - a.y) }
      : series,
  ];
};

/**
 * Points sorted by `x` when every `x` is a number, or every `x` an ISO date; otherwise
 * (categories such as month names) in the rows' order.
 */
const inXOrder = (points: ReadonlyArray<Point>): ReadonlyArray<Point> => {
  if (points.every((point) => isNumber(point.x))) {
    return points.toSorted((a, b) => Number(a.x) - Number(b.x));
  }
  if (points.every((point) => isText(point.x) && isoDate.test(point.x))) {
    return points.toSorted((a, b) => String(a.x).localeCompare(String(b.x)));
  }
  return points;
};

/** A move from one point to a later one. */
type Move = { from: Point; to: Point };

/** A series' largest fall and rise, each only when it has one. */
type Moves = { fall?: Move; rise?: Move; recovery?: Move };

/**
 * A series' largest fall (from the highest point so far to a later lower one) and its
 * largest rise (from the lowest so far to a later higher one). On a tie, the first.
 */
const movesOf = (points: ReadonlyArray<Point>): Pick<Series, 'fall' | 'rise' | 'recovery'> => {
  const [first] = points;
  if (first === undefined) return {};
  let peak = first;
  let trough = first;
  let fall: Move | undefined;
  let rise: Move | undefined;
  for (const point of points) {
    if (point.y > peak.y) peak = point;
    if (point.y < trough.y) trough = point;
    if (peak.y - point.y > (fall === undefined ? 0 : fall.from.y - fall.to.y)) {
      fall = { from: peak, to: point };
    }
    if (point.y - trough.y > (rise === undefined ? 0 : rise.to.y - rise.from.y)) {
      rise = { from: trough, to: point };
    }
  }
  const moves: Moves = {};
  if (fall !== undefined) moves.fall = fall;
  if (rise !== undefined) moves.rise = rise;
  const low = fall?.to;
  const after = low === undefined ? [] : points.slice(points.indexOf(low) + 1);
  const top = after.reduce<Point | undefined>(
    (best, point) => (best === undefined || point.y > best.y ? point : best),
    undefined,
  );
  if (low !== undefined && top !== undefined && top.y > low.y) {
    moves.recovery = { from: low, to: top };
  }
  return moves;
};

/** A chart's axis of categories, if it has one: the first facet's band axis. */
const bandOf = (
  geometry: PlotGeometry,
): Option.Option<{ readonly axis: 'x' | 'y'; readonly categories: ReadonlyArray<string> }> => {
  const facet = geometry.facets[0];
  const axis = (['x', 'y'] as const).find((each) => facet?.[each]?.type === 'band');
  const scale = axis === undefined ? undefined : facet?.[axis];
  return axis === undefined || scale === undefined || scale === null
    ? Option.none()
    : Option.some({ axis, categories: scale.domain.map(String) });
};

/** The marks foldkit-viz's `highlight` dims (lines and areas a series at a time). */
const highlightMarks = new Set(['bar', 'dot', 'cell', 'text', 'line', 'area']);

/**
 * The spec with its first mark dimmed except where `field` is `chosen` (foldkit-viz's
 * `highlight`), so a reader sees what they clicked. None when nothing is chosen, the
 * mark cannot be highlighted, or it has a highlight of its own.
 */
const highlightOf = (spec: PlotSpec, field: string, chosen: Json): Option.Option<PlotSpec> => {
  const [mark, ...others] = spec.marks;
  if (
    chosen === null ||
    !Schema.is(Value)(chosen) ||
    mark === undefined ||
    !highlightMarks.has(mark.mark) ||
    mark.highlight !== undefined
  )
    return Option.none();
  return Option.some({
    ...spec,
    marks: [{ ...mark, highlight: { field, values: [chosen] } }, ...others],
  });
};

/** The series, x and y fields of a line, area or dot chart's first mark, if it draws several. */
const seriesFieldOf = (
  spec: JsonObject,
): Option.Option<{ readonly field: string; readonly x: string; readonly y: string }> => {
  const marks = spec['marks'];
  const first = Array.isArray(marks) ? marks[0] : undefined;
  if (first === undefined || first === null || !isRecord(first)) return Option.none();
  const { mark, x, y } = first;
  if (!isText(mark) || mark === 'bar' || !seriesMarks.has(mark)) return Option.none();
  if (!isText(x) || !isText(y)) return Option.none();
  const field = [first['stroke'], first['fill'], first['z']].find(
    (each) => isText(each) && each !== x,
  );
  return isText(field) ? Option.some({ field, x, y }) : Option.none();
};

/**
 * What a chart's `select` chooses: a series, for a line, area or dot chart of several,
 * else the category on its axis of categories. None when it has neither.
 */
const selectsOf = (
  input: string,
  spec: JsonObject,
  rows: Rows,
  geometry: PlotGeometry,
): Option.Option<Selects> => {
  const series = seriesFieldOf(spec);
  if (Option.isSome(series)) {
    const { field } = series.value;
    const categories = [...new Set(rows.map((row) => String(row[field] ?? '')))];
    return Option.some({ input, categories, by: { _tag: 'Series', ...series.value } });
  }
  return Option.map(bandOf(geometry), ({ axis, categories }) => ({
    input,
    categories,
    by: { _tag: 'Band', axis },
  }));
};

/** The field a chart's choice is made on: the series field, or the category axis's. */
const choiceFieldOf = (spec: JsonObject, selects: Selects): Option.Option<string> => {
  if (selects.by._tag === 'Series') return Option.some(selects.by.field);
  const marks = spec['marks'];
  const first = Array.isArray(marks) ? marks[0] : undefined;
  const field =
    first !== undefined && first !== null && isRecord(first) ? first[selects.by.axis] : undefined;
  return isText(field) ? Option.some(field) : Option.none();
};

const problem = (
  kind: ChartProblem['kind'],
  message: string,
  path: string | null = null,
): ChartProblem => ({ kind, path, message });

const plotProblem = (issue: PlotIssue): ChartProblem => problem('spec', issue.message, issue.path);

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
    if (Result.isFailure(kept)) return Result.fail(problem('spec', kept.failure, 'where'));
    if (kept.success.length === 0 && rows.length > 0) {
      return Result.fail(problem('data', `where ${whereText(where)} keeps no rows`));
    }
    const { where: _, select, brush, ...rest } = resolved;
    if (select !== undefined && !isText(select)) {
      return Result.fail(problem('spec', 'select: name an input, as "select": "region"', 'select'));
    }
    if (brush !== undefined && !isText(brush)) {
      return Result.fail(
        problem('spec', 'brush: name a between input, as "brush": "weeks"', 'brush'),
      );
    }
    const brushed = (drawn: Drawn): Result.Result<Drawn, ChartProblem> => {
      if (brush === undefined) return Result.succeed(drawn);
      const type = drawn.geometry.facets[0]?.x?.type;
      return type === 'linear' || type === 'time'
        ? Result.succeed({ ...drawn, brushes: brush })
        : Result.fail(
            problem(
              'spec',
              'brush: the chart needs an x axis of numbers or dates to drag across',
              'brush',
            ),
          );
    };
    const spec: JsonObject = { ...rest, data: kept.success };
    const drawn = decodePlot(spec).pipe(
      Result.flatMap((plot) =>
        Result.map(compileChecked(plot), (geometry) => ({ plot, geometry })),
      ),
      Result.mapError(plotProblem),
    );
    return Result.flatMap(drawn, ({ plot, geometry }): Result.Result<Drawn, ChartProblem> => {
      const series = seriesOf(spec, kept.success, where);
      const fields = Option.getOrNull(fieldsOf(spec));
      if (select === undefined)
        return Result.succeed({
          plot,
          geometry,
          series,
          selects: null,
          rows: kept.success,
          fields,
          brushes: null,
        });
      const chosen = selectsOf(select, spec, kept.success, geometry);
      if (Option.isNone(chosen)) {
        return Result.fail(
          problem('spec', 'select: the chart has no categories or series for a reader to click'),
        );
      }
      const selects = chosen.value;
      const highlighted = Option.flatMap(choiceFieldOf(spec, selects), (field) =>
        highlightOf(plot, field, values[select] ?? null),
      );
      if (Option.isNone(highlighted)) {
        return Result.succeed({
          plot,
          geometry,
          series,
          selects,
          rows: kept.success,
          fields,
          brushes: null,
        });
      }
      const lit = highlighted.value;
      return compileChecked(lit).pipe(
        Result.mapError(plotProblem),
        Result.map((geometry) => ({
          plot: lit,
          geometry,
          series,
          selects,
          rows: kept.success,
          fields,
          brushes: null,
        })),
      );
    }).pipe(Result.flatMap(brushed));
  });
};

/** Where the ends of a span sit on a chart's `x`, in its pixels, inside its plot area. */
export const spanPixels = (
  drawn: Drawn,
  span: { readonly min: Json; readonly max: Json },
): Option.Option<readonly [number, number]> => {
  const facet = drawn.geometry.facets[0];
  const axis = facet?.x ?? null;
  if (facet === undefined || axis === null) return Option.none();
  const clamp = (px: number) => Math.min(facet.plot.right, Math.max(facet.plot.left, px));
  const from = pixelOf(axis, span.min);
  const to = pixelOf(axis, span.max);
  return from === undefined || to === undefined
    ? Option.none()
    : Option.some([clamp(Math.min(from, to)), clamp(Math.max(from, to))] as const);
};

/**
 * The value a drag end at a pixel picks (ADR 0119): the chart's own `x` value nearest it
 * (a week start on weekly data), or the value at the pixel when the rows give none.
 */
export const snappedAt = (drawn: Drawn, px: number): Option.Option<number | string> => {
  const axis = drawn.geometry.facets[0]?.x ?? null;
  const field = drawn.fields?.x;
  if (axis === null || field === undefined) return valueAtPixel(drawn, px);
  let nearest: { readonly value: number | string; readonly distance: number } | undefined;
  for (const row of drawn.rows) {
    const value = row[field];
    if (!isNumber(value) && !(isText(value) && isoDate.test(value))) continue;
    const at = pixelOf(axis, value);
    if (at === undefined) continue;
    const distance = Math.abs(at - px);
    if (nearest === undefined || distance < nearest.distance) nearest = { value, distance };
  }
  return nearest === undefined ? valueAtPixel(drawn, px) : Option.some(nearest.value);
};

/**
 * The value at a pixel on a chart's `x` (ADR 0119): a number, or for a time axis the ISO
 * date of the instant there. None off a continuous axis.
 */
export const valueAtPixel = (drawn: Drawn, px: number): Option.Option<number | string> => {
  const axis = drawn.geometry.facets[0]?.x ?? null;
  if (axis === null || (axis.type !== 'linear' && axis.type !== 'time')) return Option.none();
  const value = Number(invertAxis(axis, px));
  if (!Number.isFinite(value)) return Option.none();
  return Option.some(axis.type === 'time' ? new Date(value).toISOString().slice(0, 10) : value);
};

/** An axis's label as the spec gives it, or the field it plots. */
const labelOf = (spec: JsonObject, axis: 'x' | 'y', field: string): string => {
  const scale = spec[axis];
  const label = isRecord(scale) ? scale['label'] : undefined;
  return isText(label) && label !== '' ? label : field;
};

/** The first mark's fields, when its `x` and `y` are fields. */
const fieldsOf = (spec: JsonObject): Option.Option<Fields> => {
  const marks = spec['marks'];
  const first = Array.isArray(marks) ? marks[0] : undefined;
  if (first === undefined || first === null || !isRecord(first)) return Option.none();
  const { mark, x, y } = first;
  if (!isText(mark) || !isText(x) || !isText(y)) return Option.none();
  const by = [first['stroke'], first['fill'], first['z']].find(
    (each) => isText(each) && each !== x && each !== y,
  );
  return Option.some({
    mark,
    x,
    y,
    by: isText(by) ? by : null,
    xLabel: labelOf(spec, 'x', x),
    yLabel: labelOf(spec, 'y', y),
  });
};

/** Every digit, grouped by thousands for a reader (`14,764.5`); anything else as it is. */
const grouped = new Intl.NumberFormat('en', { maximumFractionDigits: 20 });
const readable = (value: Json | undefined): string =>
  isNumber(value) ? grouped.format(value) : String(value ?? '');

/**
 * A value a reader can point at (ADR 0118): where it is drawn, in the chart's pixels,
 * what it reads as, and what choosing it picks on a chart that selects.
 */
export type Target = {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly choice: string | null;
  /** The series it belongs to (`''` on a chart of one). */
  readonly series: string;
};

/**
 * The values a reader can point at or step through with the keyboard, in reading
 * order: series by series (in `color.domain` order, else as they first appear), each
 * along `x` (sorted for numbers and ISO dates); bars as the rows give them.
 */
export const targetsOf = (drawn: Drawn, spec: JsonObject): ReadonlyArray<Target> => {
  const { fields, geometry, rows, selects } = drawn;
  const facet = geometry.facets[0];
  const xAxis = facet?.x ?? null;
  const yAxis = facet?.y ?? null;
  if (fields === null || xAxis === null || yAxis === null) return [];
  const { by } = fields;
  const order = domainOrder(spec);
  const firstSeen = [...new Set(rows.map((row) => String(by === null ? '' : (row[by] ?? ''))))];
  const rank = (row: Row) => {
    const name = String(by === null ? '' : (row[by] ?? ''));
    return order(name) * rows.length + firstSeen.indexOf(name);
  };
  const along = (row: Row): number => {
    const value = row[fields.x];
    return isNumber(value) ? value : isText(value) && isoDate.test(value) ? Date.parse(value) : 0;
  };
  const sorted =
    fields.mark === 'bar'
      ? rows
      : rows.toSorted((a, b) => rank(a) - rank(b) || along(a) - along(b));
  const choiceField =
    selects === null
      ? undefined
      : selects.by._tag === 'Series'
        ? selects.by.field
        : selects.by.axis === 'x'
          ? fields.x
          : fields.y;
  const choiceOf = (row: Row): string | null =>
    choiceField === undefined ? null : String(row[choiceField] ?? '');
  return sorted.flatMap((row) => {
    const px = pixelOf(xAxis, row[fields.x]);
    const py = pixelOf(yAxis, row[fields.y]);
    if (px === undefined || py === undefined) return [];
    const series = by === null ? '' : `${String(row[by] ?? '')}, `;
    const text = `${series}${fields.xLabel} ${readable(row[fields.x])}: ${fields.yLabel} ${readable(row[fields.y])}`;
    return [
      {
        x: px,
        y: py,
        text,
        choice: choiceOf(row),
        series: by === null ? '' : String(row[by] ?? ''),
      },
    ];
  });
};

/**
 * The target a pointer at a plot pixel points at: on a bar chart, the bar of the
 * category under it; otherwise the nearest target within `seriesReach` pixels.
 */
export const pointedAt = (
  drawn: Drawn,
  targets: ReadonlyArray<Target>,
  x: number,
  y: number,
): number | undefined => {
  const facet = drawn.geometry.facets[0];
  if (drawn.fields?.mark === 'bar' && facet !== undefined) {
    const location = invertPlot(drawn.geometry, x, y);
    const axis = facet.x?.type === 'band' ? 'x' : 'y';
    const category = location?.[axis];
    if (category === undefined) return undefined;
    const centre = pixelOf(axis === 'x' ? facet.x : facet.y, category);
    const index = targets.findIndex((target) => (axis === 'x' ? target.x : target.y) === centre);
    return index === -1 ? undefined : index;
  }
  let nearest: { readonly index: number; readonly distance: number } | undefined;
  targets.forEach((target, index) => {
    const distance = Math.hypot(target.x - x, target.y - y);
    if (distance <= seriesReach && (nearest === undefined || distance < nearest.distance)) {
      nearest = { index, distance };
    }
  });
  return nearest?.index;
};

/** How near, in the chart's pixels, a press must be to a point to choose its series. */
export const seriesReach = 24;

/** Where `value` sits on `axis`, in pixels: its band's centre, or along a linear or time scale. */
const pixelOf = (axis: PlotAxis | null, value: Json | undefined): number | undefined => {
  if (axis === null) return undefined;
  if (axis.type === 'band') {
    return axis.ticks.find((tick) => String(tick.value) === String(value))?.position;
  }
  const [d0, d1] = axis.domain.map(Number);
  const [r0, r1] = axis.range;
  const at = isNumber(value) ? value : isText(value) ? Date.parse(value) : Number.NaN;
  if (d0 === undefined || d1 === undefined || d0 === d1 || !Number.isFinite(at)) return undefined;
  if (axis.type !== 'linear' && axis.type !== 'time') return undefined;
  return r0 + ((at - d0) / (d1 - d0)) * (r1 - r0);
};

/**
 * What a press at a plot pixel chooses on a chart that selects: the category under it
 * on the axis of categories, or the series of the nearest point within `seriesReach`
 * pixels. None off every band, or far from every point.
 */
export const choiceAt = (drawn: Drawn, x: number, y: number): Option.Option<string> => {
  const { selects, geometry, rows } = drawn;
  if (selects === null) return Option.none();
  if (selects.by._tag === 'Band') {
    const category = invertPlot(geometry, x, y)?.[selects.by.axis];
    return category === undefined ? Option.none() : Option.some(String(category));
  }
  const facet = geometry.facets[0];
  const xAxis = facet?.x ?? null;
  const yAxis = facet?.y ?? null;
  if (xAxis === null || yAxis === null) return Option.none();
  const { field } = selects.by;
  let nearest: { readonly name: string; readonly distance: number } | undefined;
  for (const row of rows) {
    const px = pixelOf(xAxis, row[selects.by.x]);
    const py = pixelOf(yAxis, row[selects.by.y]);
    if (px === undefined || py === undefined) continue;
    const distance = Math.hypot(px - x, py - y);
    if (distance <= seriesReach && (nearest === undefined || distance < nearest.distance)) {
      nearest = { name: String(row[field] ?? ''), distance };
    }
  }
  return nearest === undefined ? Option.none() : Option.some(nearest.name);
};
