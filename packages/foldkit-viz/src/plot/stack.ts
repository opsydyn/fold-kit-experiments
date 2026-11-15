import { stack as stackLayout } from '../shape/stack.js';
import type { StackData, StackOffset as LayoutOffset } from '../shape/stack.js';
import { fail, fieldOf, isText, numeric, read } from './channels.js';
import type {
  AreaMark,
  BarMark,
  Channel,
  Row,
  Stack,
  StackOffset,
  StackOrder,
  Value,
} from './types.js';

/**
 * Stacking for bar and area marks. Rows become one per category and series,
 * carrying where each piece starts and ends, before scales are resolved, so
 * the value axis covers every stack.
 */

const START = '\u0000stack-start';
const END = '\u0000stack-end';

const OFFSETS: ReadonlyArray<StackOffset> = ['zero', 'normalize', 'center', 'wiggle'];
const ORDERS: ReadonlyArray<StackOrder> = ['input', 'ascending', 'descending', 'insideOut'];

const isOffset = (value: unknown): value is StackOffset =>
  OFFSETS.some((offset) => offset === value);
const isOrder = (value: unknown): value is StackOrder => ORDERS.some((order) => order === value);

type Settings = Readonly<{ offset: StackOffset; order: StackOrder }>;

function settingsOf(stack: Stack, path: string): Settings {
  if (isText(stack)) {
    if (!isOffset(stack)) return fail(`${path}.stack`, `unknown offset "${stack}"`);
    return { offset: stack, order: 'input' };
  }
  const offset: unknown = stack.offset ?? 'zero';
  const order: unknown = stack.order ?? 'input';
  if (!isOffset(offset)) return fail(`${path}.stack.offset`, `unknown offset "${String(offset)}"`);
  if (!isOrder(order)) return fail(`${path}.stack.order`, `unknown order "${String(order)}"`);
  return { offset, order };
}

/** The field that splits a bar or area mark's rows into series: z, or the fill field. */
export const seriesFieldOf = (mark: BarMark | AreaMark): string | undefined =>
  mark.z ?? fieldOf(mark.fill);

export function validateStacking(mark: BarMark | AreaMark, path: string): void {
  const settings = mark.stack === undefined ? undefined : settingsOf(mark.stack, path);
  if (mark.mark === 'area') return;
  if (mark.stack !== undefined && mark.group === true)
    fail(`${path}.group`, 'a bar mark cannot both stack and group');
  if (mark.group === true && seriesFieldOf(mark) === undefined)
    fail(`${path}.group`, 'needs a z or fill field to group by');
  if (settings !== undefined && (settings.offset === 'center' || settings.offset === 'wiggle'))
    fail(`${path}.stack`, 'center and wiggle offsets stack areas only');
  if (settings !== undefined && (mark.x0 !== undefined || mark.y0 !== undefined))
    fail(`${path}.stack`, 'a stacked bar takes no x0 or y0');
}

const LAYOUT_OFFSET = {
  zero: 'none',
  normalize: 'expand',
  center: 'silhouette',
  wiggle: 'wiggle',
} satisfies Readonly<Record<StackOffset, LayoutOffset>>;
const LAYOUT_ORDER = {
  input: 'none',
  ascending: 'ascending',
  descending: 'descending',
  insideOut: 'insideOut',
} as const satisfies Readonly<Record<StackOrder, string>>;

export type StackedRows = Readonly<{
  rows: ReadonlyArray<Row>;
  /** Fields holding each piece's start and end on the value axis. */
  start: Channel;
  end: Channel;
}>;

type Piece = Readonly<{ category: string; series: string; row: Row; value: number }>;

/**
 * Stacks rows along the value channel within each category of the category
 * channel. Bars keep one row per category and series present; areas get every
 * series at every x, a missing one counting as zero, in x order.
 */
export function stackRows(
  mark: BarMark | AreaMark,
  rows: ReadonlyArray<Row>,
  path: string,
  category: Channel,
  value: Channel,
  categoryName: string,
  valueName: string,
): StackedRows {
  const settings = settingsOf(mark.stack ?? 'zero', path);
  const seriesField = seriesFieldOf(mark);
  const categories = read(rows, category, `${path}.${categoryName}`);
  const values = read(rows, value, `${path}.${valueName}`);
  const seriesValues: ReadonlyArray<Value> =
    seriesField === undefined ? rows.map(() => 'all') : read(rows, seriesField, `${path}.fill`);

  // Sum duplicates of a category and series, keeping the first row as the piece's row.
  const pieces = new Map<string, Piece>();
  const categoryOrder: string[] = [];
  const categoryValue = new Map<string, Value>();
  const seriesOrder: string[] = [];
  const seriesRow = new Map<string, Row>();
  rows.forEach((row, i) => {
    const c = String(categories[i] ?? ''),
      s = String(seriesValues[i] ?? '');
    const amount = numeric(values[i] ?? null);
    if (!categoryValue.has(c)) {
      categoryValue.set(c, categories[i] ?? null);
      categoryOrder.push(c);
    }
    if (!seriesRow.has(s)) {
      seriesRow.set(s, row);
      seriesOrder.push(s);
    }
    const key = JSON.stringify([c, s]);
    const existing = pieces.get(key);
    const add = Number.isFinite(amount) ? amount : 0;
    pieces.set(
      key,
      existing === undefined
        ? { category: c, series: s, row, value: add }
        : { ...existing, value: existing.value + add },
    );
  });
  if (mark.mark === 'area')
    categoryOrder.sort(
      (a, b) => numeric(categoryValue.get(a) ?? null) - numeric(categoryValue.get(b) ?? null),
    );

  const amountOf = (c: string, s: string): number => pieces.get(JSON.stringify([c, s]))?.value ?? 0;
  const table: ReadonlyArray<StackData> = categoryOrder.map((c) =>
    Object.fromEntries(seriesOrder.map((s) => [s, amountOf(c, s)])),
  );
  const layout = stackLayout(table, {
    keys: seriesOrder,
    order: LAYOUT_ORDER[settings.order],
    offset: LAYOUT_OFFSET[settings.offset],
  });
  const order = [...layout].sort((a, b) => a.index - b.index).map((s) => s.key);

  // Each piece's [start, end], by category then series.
  const extents = new Map<string, readonly [number, number]>();
  if (settings.offset === 'zero')
    for (const c of categoryOrder) {
      let up = 0,
        down = 0;
      for (const s of order) {
        const amount = amountOf(c, s);
        if (amount >= 0) {
          extents.set(JSON.stringify([c, s]), [up, up + amount]);
          up += amount;
        } else {
          extents.set(JSON.stringify([c, s]), [down, down + amount]);
          down += amount;
        }
      }
    }
  else
    for (const series of layout)
      series.bands.forEach((band, i) =>
        extents.set(JSON.stringify([categoryOrder[i] ?? '', series.key]), [band.y0, band.y1]),
      );

  const categoryField = fieldOf(category);
  const out: Row[] = [];
  const place = (c: string, s: string, row: Row) => {
    const [start, end] = extents.get(JSON.stringify([c, s])) ?? [0, 0];
    const placed = { ...row, [START]: start, [END]: end };
    out.push(
      categoryField === undefined
        ? placed
        : { ...placed, [categoryField]: categoryValue.get(c) ?? null },
    );
  };
  if (mark.mark === 'area')
    for (const s of seriesOrder)
      for (const c of categoryOrder)
        place(c, s, pieces.get(JSON.stringify([c, s]))?.row ?? seriesRow.get(s) ?? {});
  else for (const piece of pieces.values()) place(piece.category, piece.series, piece.row);
  return { rows: out, start: START, end: END };
}
