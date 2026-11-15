import { bin } from '../math/bin.js';
import { rectBins } from '../math/bin2d.js';
import {
  fail,
  fieldOf,
  highlightFactors,
  isNumber,
  keysOf,
  numeric,
  paintOf,
  read,
  requireScale,
  spanOf,
  titlesOf,
  withTitle,
} from './channels.js';
import type { ChannelName, Context, Graphics, PositionScale } from './channels.js';
import type { BinTransform, Channel, Graphic, RectMark, Row, Value } from './types.js';

/**
 * The rect mark, and the bin transform that feeds it. A rect spans x1 to x2
 * and y1 to y2 on continuous axes. Binning turns raw rows into one row per
 * bin before scales are resolved: a histogram from `x` alone, or a
 * two-dimensional histogram from `x` and `y`.
 */

// Binned rows name their fields plainly, so titles and highlights can use them.
const X1 = 'x1',
  X2 = 'x2',
  Y1 = 'y1',
  Y2 = 'y2';

const REDUCERS = ['count', 'proportion'] as const;
type Reducer = (typeof REDUCERS)[number];
const isReducer = (value: unknown): value is Reducer => REDUCERS.some((r) => r === value);

const isBinned = (mark: RectMark): boolean => mark.transform !== undefined;

export function validateRect(mark: RectMark, path: string): void {
  if (!isBinned(mark)) {
    if (mark.x !== undefined) fail(`${path}.x`, 'a rect mark takes x and y only to bin them');
    if (mark.y !== undefined) fail(`${path}.y`, 'a rect mark takes x and y only to bin them');
    if (mark.x2 === undefined) fail(`${path}.x2`, 'a rect mark needs x2');
    if (mark.y2 === undefined) fail(`${path}.y2`, 'a rect mark needs y2');
  } else {
    if (mark.x === undefined) fail(`${path}.x`, 'a binned rect mark needs x');
    for (const name of ['x1', 'x2', 'y1', 'y2'] as const)
      if (mark[name] !== undefined) fail(`${path}.${name}`, `a binned rect mark computes ${name}`);
  }
  if (mark.inset !== undefined && !(Number.isFinite(mark.inset) && mark.inset >= 0))
    fail(`${path}.inset`, 'must be zero or more');
  const transform = mark.transform;
  if (transform === undefined) return;
  const type: unknown = transform.type;
  if (type !== 'bin')
    fail(`${path}.transform.type`, `a rect mark cannot take a ${String(type)} transform`);
  const reduce: unknown = transform.reduce ?? 'count';
  if (!isReducer(reduce)) fail(`${path}.transform.reduce`, `unknown reducer "${String(reduce)}"`);
  const { thresholds } = transform;
  if (mark.y !== undefined && thresholds !== undefined && !isNumber(thresholds))
    fail(`${path}.transform.thresholds`, 'two-dimensional bins take a count');
  if (isNumber(thresholds) && !(Number.isInteger(thresholds) && thresholds >= 1))
    fail(`${path}.transform.thresholds`, 'must be a whole number of at least 1');
}

export type BinnedRows = Readonly<{
  rows: ReadonlyArray<Row>;
  channels: Readonly<Partial<Record<ChannelName, Channel>>>;
  /** The y axis title a histogram implies: its reducer. */
  label?: string;
}>;

/** The field splitting a rect's rows into series: z, or the colour field. */
const seriesField = (mark: RectMark): string | undefined =>
  mark.z ?? fieldOf(mark.fill) ?? fieldOf(mark.stroke);

/**
 * One row per bin. A histogram bins each series on the same thresholds and
 * writes `count` (and `proportion`, of the series' rows); a two-dimensional
 * histogram keeps the non-empty cells of a grid and writes `count`.
 */
export function binRows(mark: RectMark, rows: ReadonlyArray<Row>, path: string): BinnedRows {
  const transform: BinTransform = mark.transform ?? { type: 'bin' };
  const xs = read(rows, mark.x ?? '', `${path}.x`).map(numeric);
  if (mark.y !== undefined) {
    const ys = read(rows, mark.y, `${path}.y`).map(numeric);
    const xSpan = transform.domain ?? spanOf(xs),
      ySpan = spanOf(ys);
    if (xSpan === undefined || ySpan === undefined) return { rows: [], channels: {} };
    const widen = (span: readonly [number, number]): readonly [number, number] =>
      span[0] < span[1] ? span : [span[0] - 0.5, span[1] + 0.5];
    const count = isNumber(transform.thresholds) ? transform.thresholds : 20;
    const cells = rectBins(
      rows.map((_, i) => i),
      { x: (i) => xs[i] ?? Number.NaN, y: (i) => ys[i] ?? Number.NaN },
      { xDomain: widen(xSpan), yDomain: widen(ySpan), xCount: count, yCount: count },
    );
    return {
      rows: cells
        .filter((cell) => cell.count > 0)
        .map((cell) => ({
          [X1]: cell.x0,
          [X2]: cell.x1,
          [Y1]: cell.y0,
          [Y2]: cell.y1,
          count: cell.count,
        })),
      channels: { x: X1, x1: X1, x2: X2, y: Y1, y1: Y1, y2: Y2 },
    };
  }
  const reduce: Reducer = isReducer(transform.reduce) ? transform.reduce : 'count';
  const domain = transform.domain ?? spanOf(xs);
  if (domain === undefined) return { rows: [], channels: {} };
  const field = seriesField(mark);
  const carried = [mark.z, fieldOf(mark.fill), fieldOf(mark.stroke)].filter(
    (f): f is string => f !== undefined,
  );
  const groups = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = field === undefined ? 'all' : String(row[field] ?? '');
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [i]);
    else group.push(i);
  });
  const out: Row[] = [];
  for (const indices of groups.values()) {
    const first = rows[indices[0] ?? 0];
    const carry: Record<string, Value> = {};
    for (const name of carried) carry[name] = first?.[name] ?? null;
    const bins = bin(indices, {
      value: (i) => xs[i] ?? Number.NaN,
      domain,
      thresholds: transform.thresholds ?? 20,
    });
    for (const b of bins) {
      const proportion = indices.length === 0 ? 0 : b.count / indices.length;
      out.push({ ...carry, [X1]: b.x0, [X2]: b.x1, count: b.count, proportion });
    }
  }
  return { rows: out, channels: { x: X1, x1: X1, x2: X2, y2: reduce }, label: reduce };
}

const edges = (
  scale: PositionScale,
  from: ReadonlyArray<Value> | undefined,
  to: ReadonlyArray<Value>,
  i: number,
): readonly [number, number] | undefined => {
  const end = scale.place(to[i] ?? null);
  const start = from === undefined ? scale.baseline : scale.place(from[i] ?? null);
  return start === undefined || end === undefined
    ? undefined
    : [Math.min(start, end), Math.max(start, end)];
};

export function rectGraphics(
  mark: RectMark,
  rows: ReadonlyArray<Row>,
  path: string,
  index: number,
  context: Context,
  channel: (name: ChannelName) => Channel | undefined,
): Graphics {
  const x = requireScale(context.x, path, 'x'),
    y = requireScale(context.y, path, 'y');
  if (x.axis.type === 'band' || y.axis.type === 'band')
    fail(path, 'a rect mark needs continuous x and y axes; use bar or cell on a band axis');
  const readOf = (name: ChannelName): ReadonlyArray<Value> | undefined => {
    const c = channel(name);
    return c === undefined ? undefined : read(rows, c, `${path}.${name}`);
  };
  const x1 = readOf('x1'),
    x2 = readOf('x2') ?? [],
    y1 = readOf('y1'),
    y2 = readOf('y2') ?? [];
  const keys = keysOf(rows, mark, index);
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  const dims = highlightFactors(rows, mark.highlight, path);
  const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'currentColor');
  const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'none');
  const inset = mark.inset ?? 0;
  const opacity = mark.opacity ?? 1;
  return rows.flatMap((_, i): ReadonlyArray<Graphic> => {
    const across = edges(x, x1, x2, i),
      down = edges(y, y1, y2, i);
    if (across === undefined || down === undefined) return [];
    return [
      {
        kind: 'rect',
        key: keys[i] ?? `${index}:${i}`,
        x: across[0] + inset,
        y: down[0],
        width: Math.max(0, across[1] - across[0] - 2 * inset),
        height: down[1] - down[0],
        fill: fills[i] ?? 'currentColor',
        stroke: strokes[i] ?? 'none',
        opacity: opacity * (dims[i] ?? 1),
        ...withTitle(titles[i]),
      },
    ];
  });
}
