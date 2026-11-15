import type { PlotBounds } from '../chart/layout.js';
import type { SymbolType } from '../shape/symbol.js';
import type {
  Channel,
  Graphic,
  Highlight,
  Legend,
  MarkSpec,
  PlotAxis,
  Row,
  Value,
} from './types.js';

/**
 * Shared channel reading and painting for every plot mark. The spec is the
 * I/O boundary: values are parsed here with guards, not cast.
 */

export const fail = (path: string, message: string): never => {
  throw new RangeError(`${path}: ${message}`);
};

// ── Channels ──────────────────────────────────────────────────────────────────

/** Guards for raw JSON values: the spec is the I/O boundary, parsed here. */
export const isNumber = (value: unknown): value is number => typeof value === 'number';
export const isText = (value: unknown): value is string => typeof value === 'string';
export const isFlag = (value: unknown): value is boolean => typeof value === 'boolean';

export const isConstant = (channel: unknown): channel is Readonly<{ value: Value }> =>
  typeof channel === 'object' && channel !== null && 'value' in channel;

export const fieldOf = (channel: Channel | undefined): string | undefined =>
  isText(channel) ? channel : undefined;

export function read(
  rows: ReadonlyArray<Row>,
  channel: Channel,
  path: string,
): ReadonlyArray<Value> {
  if (isConstant(channel)) return rows.map(() => channel.value);
  if (!isText(channel) || channel === '') return fail(path, 'must be a field name or { value }');
  if (rows.length > 0 && !rows.some((row) => Object.hasOwn(row, channel)))
    fail(path, `field "${channel}" is missing from the data`);
  return rows.map((row) => row[channel] ?? null);
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

/** A value as a number on a continuous axis: numbers as they are, ISO dates as epoch ms. */
export const numeric = (value: Value): number => {
  if (isNumber(value)) return value;
  if (isText(value) && ISO_DATE.test(value)) return Date.parse(value);
  return Number.NaN;
};

export type ChannelName =
  | 'x'
  | 'y'
  | 'x0'
  | 'y0'
  | 'x1'
  | 'y1'
  | 'x2'
  | 'y2'
  | 'r'
  | 'fill'
  | 'stroke'
  | 'text'
  | 'title'
  | 'path'
  | 'value'
  | 'source'
  | 'target'
  | 'symbol';

export const channelOf = (mark: MarkSpec, name: ChannelName): Channel | undefined => {
  switch (name) {
    case 'x':
      return 'x' in mark ? mark.x : undefined;
    case 'y':
      return 'y' in mark ? mark.y : undefined;
    case 'x0':
      return 'x0' in mark ? mark.x0 : undefined;
    case 'y0':
      return 'y0' in mark ? mark.y0 : undefined;
    case 'x1':
      return 'x1' in mark ? mark.x1 : undefined;
    case 'y1':
      return 'y1' in mark ? mark.y1 : undefined;
    case 'x2':
      return 'x2' in mark ? mark.x2 : undefined;
    case 'y2':
      return 'y2' in mark ? mark.y2 : undefined;
    case 'r':
      return 'r' in mark ? mark.r : undefined;
    case 'fill':
      return 'fill' in mark ? mark.fill : undefined;
    case 'stroke':
      return 'stroke' in mark ? mark.stroke : undefined;
    case 'text':
      return 'text' in mark ? mark.text : undefined;
    case 'title':
      return mark.title;
    case 'path':
      return 'path' in mark ? mark.path : undefined;
    case 'value':
      return 'value' in mark ? mark.value : undefined;
    case 'source':
      return 'source' in mark ? mark.source : undefined;
    case 'target':
      return 'target' in mark ? mark.target : undefined;
    case 'symbol':
      return 'symbol' in mark ? mark.symbol : undefined;
  }
};

export type AxisName = 'x' | 'y';

export type PositionScale = Readonly<{
  axis: PlotAxis;
  /** Centre of a band, or the projected value; undefined when it cannot be placed. */
  place: (value: Value) => number | undefined;
  /** Start of a band; equal to place for continuous scales. */
  start: (value: Value) => number | undefined;
  bandwidth: number;
  /** Where a bar or area starts: zero when in range, otherwise the low edge. */
  baseline: number;
}>;

export type ColorScale = Readonly<{
  paint: (value: Value) => string;
  legend: Legend | null;
  /** The fields the colour encodes. */
  fields: ReadonlyArray<string>;
}>;

export type SymbolScale = Readonly<{
  symbolOf: (value: Value) => SymbolType;
  legend: Legend | null;
  fields: ReadonlyArray<string>;
}>;

export type Context = Readonly<{
  x: PositionScale | null;
  y: PositionScale | null;
  color: ColorScale | null;
  symbol: SymbolScale | null;
  size: (value: Value) => number;
  bounds: PlotBounds;
}>;

export const paintOf = (
  rows: ReadonlyArray<Row>,
  channel: Channel | undefined,
  path: string,
  context: Context,
  fallback: string,
): ReadonlyArray<string> => {
  if (channel === undefined) return rows.map(() => fallback);
  if (isConstant(channel)) return rows.map(() => String(channel.value ?? fallback));
  const color = context.color;
  return read(rows, channel, path).map((v) => (color === null ? fallback : color.paint(v)));
};

export const titlesOf = (rows: ReadonlyArray<Row>, channel: Channel | undefined, path: string) =>
  channel === undefined
    ? rows.map(() => undefined)
    : read(rows, channel, path).map((v) => (v === null ? undefined : String(v)));

export const keysOf = (
  rows: ReadonlyArray<Row>,
  mark: MarkSpec,
  index: number,
): ReadonlyArray<string> =>
  rows.map((row, i) =>
    mark.key !== undefined && row[mark.key] !== undefined ? String(row[mark.key]) : `${index}:${i}`,
  );

export const withTitle = (title: string | undefined) => (title === undefined ? {} : { title });

export function requireScale(
  scale: PositionScale | null,
  path: string,
  axis: AxisName,
): PositionScale {
  return scale ?? fail(`${path}.${axis}`, 'no scale could be resolved for this axis');
}

/** Every graphic a mark draws; used by the mark modules. */
export type Graphics = ReadonlyArray<Graphic>;

/** [min, max] of the finite values, by loop so data of any size is safe; undefined when none. */
export function spanOf(values: Iterable<number>): readonly [number, number] | undefined {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }
  return lo <= hi ? [lo, hi] : undefined;
}

/** Appends by loop: spreading a data-sized array into push overflows the call stack. */
export function append<T>(target: T[], source: Iterable<T>): void {
  for (const item of source) target.push(item);
}

/** Opacity factor for rows a highlight leaves out. */
export const DIMMED = 0.15;

/**
 * Each row's opacity factor under a highlight: 1 when it matches, DIMMED when
 * not. Ranges compare numbers, or ISO dates as instants, inclusively.
 */
export function highlightFactors(
  rows: ReadonlyArray<Row>,
  highlight: Highlight | undefined,
  path: string,
): ReadonlyArray<number> {
  if (highlight === undefined) return rows.map(() => 1);
  const values = read(rows, highlight.field, `${path}.highlight.field`);
  const matches = highlightMatcher(highlight);
  return values.map((value) => (matches(value) ? 1 : DIMMED));
}

/**
 * Whether a value is kept by a highlight: within its range (numbers, or ISO
 * dates as instants, inclusively) and among its values, when it gives them.
 */
export function highlightMatcher(highlight: Highlight): (value: Value) => boolean {
  const { range } = highlight;
  const lo = range === undefined ? Number.NaN : Math.min(numeric(range[0]), numeric(range[1]));
  const hi = range === undefined ? Number.NaN : Math.max(numeric(range[0]), numeric(range[1]));
  const allowed = highlight.values === undefined ? undefined : new Set(highlight.values);
  return (value) => {
    const inRange = range === undefined || (numeric(value) >= lo && numeric(value) <= hi);
    return inRange && (allowed === undefined || allowed.has(value));
  };
}
