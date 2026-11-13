import { contourLines } from '../math/contour.js';
import { kde, silvermanBandwidth } from '../math/stats.js';
import { area } from '../shape/area.js';
import { line } from '../shape/line.js';
import {
  fail,
  fieldOf,
  numeric,
  paintOf,
  read,
  requireScale,
  spanOf,
  titlesOf,
  withTitle,
} from './channels.js';
import type { Context, Graphics } from './channels.js';
import type { Channel, DensityMark, Graphic, Row, Value } from './types.js';

/**
 * The density mark. With `x` alone it is a kernel density curve, derived as
 * rows before scales are resolved so the y axis is density. With `x` and `y`
 * it is contour lines of point density, computed in plot pixels after scales
 * are resolved, so any axis scale works and the bandwidth means the same on
 * both axes.
 */

const AT = '\u0000density-x';
const DENSITY = '\u0000density';
const SAMPLES = 128;
/** Pixels per grid cell for two-dimensional density. */
const CELL = 4;

export const isOneDimensional = (mark: DensityMark): boolean => mark.y === undefined;

/** The field that splits a density's rows into series: z, or the colour field. */
const seriesField = (mark: DensityMark): string | undefined =>
  mark.z ?? fieldOf(mark.fill) ?? fieldOf(mark.stroke);

function seriesOf(
  rows: ReadonlyArray<Row>,
  field: string | undefined,
): ReadonlyArray<readonly [string, ReadonlyArray<Row>]> {
  if (field === undefined) return [['all', rows]];
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = String(row[field] ?? '');
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [row]);
    else group.push(row);
  }
  return [...groups];
}

export function validateDensity(mark: DensityMark, path: string): void {
  if (mark.bandwidth !== undefined && !(Number.isFinite(mark.bandwidth) && mark.bandwidth > 0))
    fail(`${path}.bandwidth`, 'must be positive');
  if (mark.thresholds === undefined) return;
  if (isOneDimensional(mark))
    fail(`${path}.thresholds`, 'a one-dimensional density takes no thresholds');
  if (!(Number.isInteger(mark.thresholds) && mark.thresholds >= 1))
    fail(`${path}.thresholds`, 'must be a whole number of at least 1');
}

export type DensityRows = Readonly<{
  rows: ReadonlyArray<Row>;
  x: Channel;
  y: Channel;
}>;

/**
 * A one-dimensional density as rows of x and density, 128 per series, across
 * the series' extent padded by three bandwidths. Each row carries its
 * series' z and colour fields, so colour and series still resolve.
 */
export function densityRows(
  mark: DensityMark,
  rows: ReadonlyArray<Row>,
  path: string,
): DensityRows {
  const field = seriesField(mark);
  const carried = [mark.z, fieldOf(mark.fill), fieldOf(mark.stroke)].filter(
    (f): f is string => f !== undefined,
  );
  const xs = read(rows, mark.x, `${path}.x`);
  const indexOf = new Map(rows.map((row, i) => [row, i]));
  const out: Row[] = [];
  for (const [, series] of seriesOf(rows, field)) {
    const values = series
      .map((row) => numeric(xs[indexOf.get(row) ?? -1] ?? null))
      .filter(Number.isFinite);
    const span = spanOf(values);
    if (span === undefined) continue;
    const estimated = silvermanBandwidth(values);
    const fallback = (span[1] - span[0]) / 10 || 1;
    const bandwidth = mark.bandwidth ?? (estimated > 0 ? estimated : fallback);
    const lo = span[0] - 3 * bandwidth,
      hi = span[1] + 3 * bandwidth;
    const at = Array.from({ length: SAMPLES }, (_, i) => lo + ((hi - lo) * i) / (SAMPLES - 1));
    const first = series[0];
    const carry: Record<string, Value> = {};
    for (const name of carried) carry[name] = first?.[name] ?? null;
    for (const point of kde(values, at, bandwidth))
      out.push({ ...carry, [AT]: point.value, [DENSITY]: point.density });
  }
  return { rows: out, x: AT, y: DENSITY };
}

const round = (n: number): number => Math.round(n * 100) / 100;

function curveGraphics(
  mark: DensityMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const x = requireScale(context.x, path, 'x'),
    y = requireScale(context.y, path, 'y');
  const graphics: Graphic[] = [];
  for (const [key, series] of seriesOf(rows, seriesField(mark))) {
    const points = series.flatMap((row) => {
      const px = x.place(row[AT] ?? null),
        py = y.place(row[DENSITY] ?? null);
      return px === undefined || py === undefined ? [] : [[px, py] as const];
    });
    const head = series.slice(0, 1);
    const fill =
      paintOf(head, mark.fill, `${path}.fill`, context, 'currentColor')[0] ?? 'currentColor';
    const stroke =
      mark.stroke === undefined
        ? fill
        : (paintOf(head, mark.stroke, `${path}.stroke`, context, fill)[0] ?? fill);
    const title = titlesOf(head, mark.title, `${path}.title`)[0];
    const filled = area(points, y.baseline);
    if (filled !== null)
      graphics.push({
        kind: 'path',
        key: `${key}:area`,
        d: filled,
        fill,
        stroke: 'none',
        strokeWidth: 0,
        opacity: mark.opacity ?? 0.3,
        ...withTitle(title),
      });
    const outline = line(points) ?? '';
    if (outline !== '')
      graphics.push({
        kind: 'path',
        key,
        d: outline,
        fill: 'none',
        stroke,
        strokeWidth: mark.strokeWidth ?? 1.5,
        opacity: 1,
        ...withTitle(title),
      });
  }
  return graphics;
}

function contourGraphics(
  mark: DensityMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const x = requireScale(context.x, path, 'x'),
    y = requireScale(context.y, path, 'y');
  if (x.axis.type === 'band' || y.axis.type === 'band')
    fail(path, 'a two-dimensional density needs continuous x and y axes');
  const { bounds } = context;
  const columns = Math.ceil(bounds.width / CELL) + 1,
    lines = Math.ceil(bounds.height / CELL) + 1;
  const bandwidth = mark.bandwidth ?? 20;
  const reach = Math.ceil(bandwidth / CELL);
  const levels = mark.thresholds ?? 8;
  const xs = read(rows, mark.x, `${path}.x`),
    ys = read(rows, mark.y ?? '', `${path}.y`);
  const indexOf = new Map(rows.map((row, i) => [row, i]));
  const graphics: Graphic[] = [];
  for (const [key, series] of seriesOf(rows, seriesField(mark))) {
    // Splat each point onto nearby grid cells with an Epanechnikov kernel, so
    // the cost is points times the kernel's area, not points times the grid.
    const grid = new Float64Array(columns * lines);
    for (const row of series) {
      const i = indexOf.get(row) ?? -1;
      const px = x.place(xs[i] ?? null),
        py = y.place(ys[i] ?? null);
      if (px === undefined || py === undefined) continue;
      const gx = (px - bounds.left) / CELL,
        gy = (py - bounds.top) / CELL;
      const c0 = Math.max(0, Math.floor(gx - reach)),
        c1 = Math.min(columns - 1, Math.ceil(gx + reach));
      const l0 = Math.max(0, Math.floor(gy - reach)),
        l1 = Math.min(lines - 1, Math.ceil(gy + reach));
      for (let l = l0; l <= l1; l += 1)
        for (let c = c0; c <= c1; c += 1) {
          const dx = ((c - gx) * CELL) / bandwidth,
            dy = ((l - gy) * CELL) / bandwidth;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1) grid[l * columns + c] = (grid[l * columns + c] ?? 0) + (1 - d2) * (1 - d2);
        }
    }
    let peak = 0;
    for (const value of grid) if (value > peak) peak = value;
    if (!(peak > 0)) continue;
    const head = series.slice(0, 1);
    const stroke =
      paintOf(head, mark.stroke ?? mark.fill, `${path}.stroke`, context, 'currentColor')[0] ??
      'currentColor';
    const title = titlesOf(head, mark.title, `${path}.title`)[0];
    for (let k = 1; k <= levels; k += 1) {
      const segments = contourLines(grid, columns, lines, (peak * k) / (levels + 1));
      const d = segments
        .map(
          ([a, b]) =>
            `M${round(bounds.left + a[0] * CELL)},${round(bounds.top + a[1] * CELL)}` +
            `L${round(bounds.left + b[0] * CELL)},${round(bounds.top + b[1] * CELL)}`,
        )
        .join('');
      if (d === '') continue;
      graphics.push({
        kind: 'path',
        key: `${key}:${k}`,
        d,
        fill: 'none',
        stroke,
        strokeWidth: mark.strokeWidth ?? 1,
        opacity: round((mark.opacity ?? 1) * (0.35 + (0.65 * k) / levels)),
        ...withTitle(title),
      });
    }
  }
  return graphics;
}

export const densityGraphics = (
  mark: DensityMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics =>
  isOneDimensional(mark)
    ? curveGraphics(mark, rows, path, context)
    : contourGraphics(mark, rows, path, context);
