import { boxStats, kde, silvermanBandwidth } from '../math/stats.js';
import {
  fail,
  keysOf,
  numeric,
  paintOf,
  read,
  requireScale,
  titlesOf,
  withTitle,
} from './channels.js';
import type { Context, Graphics, PositionScale } from './channels.js';
import type { BoxMark, LinkMark, Row, ViolinMark } from './types.js';

/**
 * Distribution marks (box and violin) and the link mark. Each mark groups its
 * rows by the category on its band axis and summarises the values on the other.
 */

type Orientation = Readonly<{
  vertical: boolean;
  category: PositionScale;
  value: PositionScale;
}>;

function orientation(context: Context, path: string, name: string): Orientation {
  const x = requireScale(context.x, path, 'x'),
    y = requireScale(context.y, path, 'y');
  const vertical = x.axis.type === 'band';
  if (vertical === (y.axis.type === 'band'))
    fail(path, `a ${name} mark needs exactly one band axis`);
  return vertical ? { vertical, category: x, value: y } : { vertical, category: y, value: x };
}

type Group = Readonly<{ key: string; rows: ReadonlyArray<Row>; values: ReadonlyArray<number> }>;

function groupsOf(
  mark: BoxMark | ViolinMark,
  rows: ReadonlyArray<Row>,
  path: string,
  vertical: boolean,
): ReadonlyArray<Group> {
  const categories = read(rows, vertical ? mark.x : mark.y, `${path}.${vertical ? 'x' : 'y'}`);
  const values = read(rows, vertical ? mark.y : mark.x, `${path}.${vertical ? 'y' : 'x'}`).map(
    numeric,
  );
  const groups = new Map<string, { rows: Row[]; values: number[] }>();
  rows.forEach((row, i) => {
    const category = categories[i];
    const value = values[i] ?? Number.NaN;
    if (category === null || category === undefined || !Number.isFinite(value)) return;
    const group = groups.get(String(category)) ?? { rows: [], values: [] };
    group.rows.push(row);
    group.values.push(value);
    groups.set(String(category), group);
  });
  return [...groups].map(([key, group]) => ({
    key,
    rows: group.rows,
    values: [...group.values].sort((a, b) => a - b),
  }));
}

const tidy = (value: number): string => String(Math.round(value * 1e6) / 1e6);

/** A point along the category at `offset` from its centre, and along the values at `value`. */
const at = (o: Orientation, centre: number, offset: number, value: number) => {
  const v = o.value.place(value) ?? Number.NaN;
  return o.vertical ? { x: centre + offset, y: v } : { x: v, y: centre + offset };
};

export function boxGraphics(
  mark: BoxMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  const o = orientation(context, path, 'box');
  const half = o.category.bandwidth * 0.35;
  const opacity = mark.opacity ?? 1;
  return groupsOf(mark, rows, path, o.vertical).flatMap((group) => {
    const centre = o.category.place(group.key);
    if (centre === undefined || group.values.length === 0) return [];
    const stats = boxStats(group.values);
    const fill =
      paintOf(group.rows.slice(0, 1), mark.fill, `${path}.fill`, context, 'currentColor')[0] ??
      'currentColor';
    const stroke =
      paintOf(group.rows.slice(0, 1), mark.stroke, `${path}.stroke`, context, 'currentColor')[0] ??
      'currentColor';
    const low = at(o, centre, 0, stats.fenceLow),
      high = at(o, centre, 0, stats.fenceHigh);
    const q1 = at(o, centre, -half, stats.q1),
      q3 = at(o, centre, half, stats.q3);
    const m0 = at(o, centre, -half, stats.median),
      m1 = at(o, centre, half, stats.median);
    const box = {
      x: Math.min(q1.x, q3.x),
      y: Math.min(q1.y, q3.y),
      width: Math.abs(q3.x - q1.x),
      height: Math.abs(q3.y - q1.y),
    };
    const title = `${group.key}: median ${tidy(stats.median)}, quartiles ${tidy(stats.q1)}–${tidy(stats.q3)}`;
    return [
      {
        kind: 'line' as const,
        key: `${group.key}:whisker`,
        x1: low.x,
        y1: low.y,
        x2: high.x,
        y2: high.y,
        stroke,
        strokeWidth: mark.strokeWidth ?? 1,
        opacity,
      },
      {
        kind: 'rect' as const,
        key: `${group.key}:box`,
        ...box,
        fill,
        stroke,
        opacity: 0.6 * opacity,
        title,
      },
      {
        kind: 'line' as const,
        key: `${group.key}:median`,
        x1: m0.x,
        y1: m0.y,
        x2: m1.x,
        y2: m1.y,
        stroke,
        strokeWidth: 2,
        opacity,
      },
      ...stats.outliers.map((value, i) => {
        const p = at(o, centre, 0, value);
        return {
          kind: 'circle' as const,
          key: `${group.key}:outlier:${i}`,
          cx: p.x,
          cy: p.y,
          r: 2.5,
          fill: 'none',
          stroke,
          strokeWidth: 1,
          opacity,
          title: `${group.key}: ${tidy(value)}`,
        };
      }),
    ];
  });
}

const VIOLIN_STEPS = 40;

export function violinGraphics(
  mark: ViolinMark,
  rows: ReadonlyArray<Row>,
  path: string,
  context: Context,
): Graphics {
  if (mark.bandwidth !== undefined && !(Number.isFinite(mark.bandwidth) && mark.bandwidth > 0))
    fail(`${path}.bandwidth`, 'must be finite and positive');
  const o = orientation(context, path, 'violin');
  const opacity = mark.opacity ?? 0.75;
  const densities = groupsOf(mark, rows, path, o.vertical).map((group) => {
    const lo = group.values[0] ?? 0,
      hi = group.values.at(-1) ?? 0;
    const thresholds = Array.from(
      { length: VIOLIN_STEPS + 1 },
      (_, i) => lo + ((hi - lo) * i) / VIOLIN_STEPS,
    );
    const h = mark.bandwidth ?? (silvermanBandwidth(group.values) || 1);
    return { group, curve: hi > lo ? kde(group.values, thresholds, h) : [] };
  });
  // Every violin shares one width scale, so wider means denser across groups.
  const most = Math.max(
    Number.MIN_VALUE,
    ...densities.flatMap((d) => d.curve.map((p) => p.density)),
  );
  const half = o.category.bandwidth * 0.45;
  return densities.flatMap(({ group, curve }) => {
    const centre = o.category.place(group.key);
    if (centre === undefined || curve.length === 0) return [];
    const fill =
      paintOf(group.rows.slice(0, 1), mark.fill, `${path}.fill`, context, 'currentColor')[0] ??
      'currentColor';
    const stroke =
      paintOf(group.rows.slice(0, 1), mark.stroke, `${path}.stroke`, context, 'none')[0] ?? 'none';
    const right = curve.map((p) => at(o, centre, (p.density / most) * half, p.value));
    const left = curve.map((p) => at(o, centre, -(p.density / most) * half, p.value)).reverse();
    const d = `M${[...right, ...left].map((p) => `${tidy(p.x)},${tidy(p.y)}`).join('L')}Z`;
    const stats = boxStats(group.values);
    const m0 = at(o, centre, -half * 0.3, stats.median),
      m1 = at(o, centre, half * 0.3, stats.median);
    return [
      {
        kind: 'path' as const,
        key: `${group.key}:violin`,
        d,
        fill,
        stroke,
        strokeWidth: mark.strokeWidth ?? 1,
        opacity,
        title: `${group.key}: ${group.values.length} values, median ${tidy(stats.median)}`,
      },
      {
        kind: 'line' as const,
        key: `${group.key}:median`,
        x1: m0.x,
        y1: m0.y,
        x2: m1.x,
        y2: m1.y,
        stroke: 'currentColor',
        strokeWidth: 2,
        opacity: 1,
      },
    ];
  });
}

export function linkGraphics(
  mark: LinkMark,
  rows: ReadonlyArray<Row>,
  path: string,
  index: number,
  context: Context,
): Graphics {
  const x = requireScale(context.x, path, 'x'),
    y = requireScale(context.y, path, 'y');
  const x1 = read(rows, mark.x1, `${path}.x1`),
    y1 = read(rows, mark.y1, `${path}.y1`);
  const x2 = mark.x2 === undefined ? x1 : read(rows, mark.x2, `${path}.x2`);
  const y2 = mark.y2 === undefined ? y1 : read(rows, mark.y2, `${path}.y2`);
  const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'currentColor');
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  const keys = keysOf(rows, mark, index);
  return rows.flatMap((_, i) => {
    const ends = [
      x.place(x1[i] ?? null),
      y.place(y1[i] ?? null),
      x.place(x2[i] ?? null),
      y.place(y2[i] ?? null),
    ];
    const [ax, ay, bx, by] = ends;
    if (ax === undefined || ay === undefined || bx === undefined || by === undefined) return [];
    return [
      {
        kind: 'line' as const,
        key: keys[i] ?? `${index}:${i}`,
        x1: ax,
        y1: ay,
        x2: bx,
        y2: by,
        stroke: strokes[i] ?? 'currentColor',
        strokeWidth: mark.strokeWidth ?? 1,
        opacity: mark.opacity ?? 1,
        ...withTitle(titles[i]),
      },
    ];
  });
}
