import type { PlotBounds } from '../chart/layout.js';
import { band, linearTicks } from '../math/scale.js';
import { arc } from '../shape/arc.js';
import { line } from '../shape/line.js';
import type { CurveType } from '../shape/line.js';
import {
  fail,
  fieldOf,
  highlightFactors,
  isConstant,
  isText,
  keysOf,
  numeric,
  paintOf,
  read,
  titlesOf,
  withTitle,
} from './channels.js';
import type { ChannelName, Context, Graphics, PositionScale } from './channels.js';
import type {
  Channel,
  Graphic,
  MarkSpec,
  PlotSpec,
  PolarGeometry,
  PositionScaleSpec,
  Row,
  Value,
} from './types.js';

/**
 * Polar coordinates: x is the angle, clockwise from twelve o'clock, and y the
 * radius. Scales here return angles in radians and radii in pixels; marks
 * convert them to plot pixels about the facet's centre.
 */

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
/** Room around the outer ring for angular labels. */
const LABEL_ROOM = 22;

export type PolarFrame = Readonly<{
  cx: number;
  cy: number;
  inner: number;
  outer: number;
  /** Where the angle starts, in radians clockwise from twelve o'clock. */
  start: number;
}>;

export function polarFrame(bounds: PlotBounds, spec: PlotSpec): PolarFrame {
  const options = spec.polar ?? {};
  const share = options.inner ?? 0;
  if (!(share >= 0 && share < 1)) fail('polar.inner', 'must be in [0, 1)');
  const outer = Math.max(1, Math.min(bounds.width, bounds.height) / 2 - LABEL_ROOM);
  return {
    cx: bounds.left + bounds.width / 2,
    cy: bounds.top + bounds.height / 2,
    inner: outer * share,
    outer,
    start: (options.start ?? 0) * DEG,
  };
}

/** A point at an angle and radius, in plot pixels. */
const toXY = (frame: PolarFrame, angle: number, radius: number): readonly [number, number] => [
  frame.cx + radius * Math.sin(angle),
  frame.cy - radius * Math.cos(angle),
];

const round = (n: number): number => Math.round(n * 100) / 100;

/** What polar scales need from a resolved axis. */
export type AxisInfo = Readonly<{
  type: string;
  domain: readonly [number, number] | ReadonlyArray<string>;
  label: string;
  spec: PositionScaleSpec;
}>;

const isBandDomain = (
  domain: readonly [number, number] | ReadonlyArray<string>,
): domain is ReadonlyArray<string> => domain.every((v) => isText(v));

const continuous = (info: AxisInfo): readonly [number, number] => {
  const [a = 0, b = 1] = info.domain.map((v: number | string) => numeric(v));
  return [a, b];
};

export type PolarScales = Readonly<{
  x: PositionScale | null;
  y: PositionScale | null;
  geometry: PolarGeometry;
}>;

/** Angle and radius scales for a facet, and the rings and spokes renderers draw. */
export function polarScales(
  xInfo: AxisInfo | null,
  yInfo: AxisInfo | null,
  frame: PolarFrame,
): PolarScales {
  const { start, inner, outer } = frame;
  let x: PositionScale | null = null;
  const angles: Array<PolarGeometry['angles'][number]> = [];
  if (xInfo !== null && isBandDomain(xInfo.domain)) {
    const domain = xInfo.domain;
    const padding = xInfo.spec.padding ?? 0.02;
    if (!(padding >= 0 && padding < 1)) fail('x.padding', 'must be in [0, 1)');
    // Each sector is centred on its category, so the first points straight up.
    const half = TAU / Math.max(1, domain.length) / 2;
    const scale = band({
      domain: [...domain],
      range: [start - half, start - half + TAU],
      paddingInner: padding,
      paddingOuter: padding / 2,
    });
    const known = new Set(domain);
    const first = (v: Value) =>
      v !== null && known.has(String(v)) ? scale.position(String(v)) : undefined;
    const middle = (v: Value) => {
      const s = first(v);
      return s === undefined ? undefined : s + scale.bandwidth / 2;
    };
    for (const value of domain) angles.push({ value, angle: middle(value) ?? start, label: value });
    x = {
      axis: axisOf(xInfo, [start, start + TAU]),
      place: middle,
      start: first,
      bandwidth: scale.bandwidth,
      baseline: start,
    };
  } else if (xInfo !== null) {
    const [d0, d1] = continuous(xInfo);
    const angle = (v: Value) => {
      const n = numeric(v);
      return Number.isFinite(n) && d1 !== d0 ? start + ((n - d0) / (d1 - d0)) * TAU : undefined;
    };
    // The last tick would sit on the first, a full turn round.
    for (const t of linearTicks([d0, d1], 8))
      if (t < d1) angles.push({ value: t, angle: angle(t) ?? start, label: String(t) });
    x = {
      axis: axisOf(xInfo, [start, start + TAU]),
      place: angle,
      start: angle,
      bandwidth: 0,
      baseline: start,
    };
  }
  let y: PositionScale | null = null;
  const radii: Array<PolarGeometry['radii'][number]> = [];
  if (yInfo !== null) {
    if (isBandDomain(yInfo.domain)) fail('y', 'polar coordinates need a continuous y');
    const [d0, d1] = continuous(yInfo);
    // Radii grow from zero unless the spec says otherwise, so shapes compare by area.
    const lo = yInfo.spec.zero === false ? d0 : Math.min(0, d0);
    const hi = Math.max(d1, lo + 1e-9);
    const radius = (v: Value) => {
      const n = numeric(v);
      return Number.isFinite(n) ? inner + ((n - lo) / (hi - lo)) * (outer - inner) : undefined;
    };
    for (const t of linearTicks([lo, hi], yInfo.spec.ticks ?? 4))
      if (t > lo) radii.push({ value: t, radius: radius(t) ?? inner, label: String(t) });
    y = {
      axis: axisOf({ ...yInfo, domain: [lo, hi] }, [inner, outer]),
      place: radius,
      start: radius,
      bandwidth: 0,
      baseline: radius(Math.max(lo, Math.min(0, hi))) ?? inner,
    };
  }
  const shown = (info: AxisInfo | null) => (info?.spec.axis ?? true) && info !== null;
  return {
    x,
    y,
    geometry: {
      cx: frame.cx,
      cy: frame.cy,
      inner,
      outer,
      angles: shown(xInfo) ? angles : [],
      radii: shown(yInfo) ? radii : [],
      label: yInfo?.label ?? '',
    },
  };
}

const axisOf = (info: AxisInfo, range: readonly [number, number]) => ({
  type: 'linear' as const,
  orientation: 'bottom' as const,
  domain: info.domain,
  label: info.label,
  ticks: [],
  grid: false,
  range,
});

// ── Marks ─────────────────────────────────────────────────────────────────────

/** Curves that close on themselves, for shapes over a full circle of categories. */
const CLOSED = {
  catmullRom: 'catmullRomClosed',
  basis: 'basisClosed',
  cardinal: 'cardinalClosed',
} as const satisfies Readonly<Partial<Record<CurveType, CurveType>>>;

const closedCurve = (curve: CurveType): CurveType | undefined =>
  curve === 'catmullRom' || curve === 'basis' || curve === 'cardinal' ? CLOSED[curve] : undefined;

function closedPath(
  points: ReadonlyArray<readonly [number, number]>,
  curve: CurveType | undefined,
): string {
  const closed = curve === undefined ? undefined : closedCurve(curve);
  if (closed !== undefined) return line(points, { curve: closed }) ?? '';
  const open = line(points) ?? '';
  return open === '' ? '' : `${open}Z`;
}

type Reader = (name: ChannelName) => Channel | undefined;

/**
 * A mark's graphics in polar coordinates. Bars become wedges; lines and areas
 * over a band x close into rings, as radar charts do.
 */
export function polarGraphics(
  mark: MarkSpec,
  rows: ReadonlyArray<Row>,
  path: string,
  index: number,
  context: Context,
  frame: PolarFrame,
  channel: Reader,
): Graphics {
  const x = context.x,
    y = context.y;
  const keys = keysOf(rows, mark, index);
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  const dims = highlightFactors(rows, mark.highlight, path);
  const opacity = mark.opacity ?? 1;
  const values = (name: ChannelName): ReadonlyArray<Value> | undefined => {
    const c = channel(name);
    return c === undefined ? undefined : read(rows, c, `${path}.${name}`);
  };
  const need = (scale: PositionScale | null, axis: 'x' | 'y'): PositionScale =>
    scale ?? fail(`${path}.${axis}`, 'no scale could be resolved for this axis');
  switch (mark.mark) {
    case 'bar': {
      const angle = need(x, 'x'),
        radius = need(y, 'y');
      if (angle.bandwidth === 0) fail(path, 'a bar in polar coordinates needs a band x');
      const xs = values('x') ?? [],
        ys = values('y') ?? [],
        starts = values('y0');
      const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'currentColor');
      const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'none');
      return rows.flatMap((_, i): ReadonlyArray<Graphic> => {
        const a0 = angle.start(xs[i] ?? null),
          r1 = radius.place(ys[i] ?? null);
        const r0 = starts === undefined ? radius.baseline : radius.place(starts[i] ?? null);
        if (a0 === undefined || r1 === undefined || r0 === undefined) return [];
        return [
          {
            kind: 'path',
            key: keys[i] ?? `${index}:${i}`,
            d: arc({
              innerRadius: Math.min(r0, r1),
              outerRadius: Math.max(r0, r1),
              startAngle: a0,
              endAngle: a0 + angle.bandwidth,
            }),
            translate: [round(frame.cx), round(frame.cy)],
            fill: fills[i] ?? 'currentColor',
            stroke: strokes[i] ?? 'none',
            strokeWidth: mark.strokeWidth ?? 1,
            opacity: opacity * (dims[i] ?? 1),
            ...withTitle(titles[i]),
          },
        ];
      });
    }
    case 'line':
    case 'area': {
      const angle = need(x, 'x'),
        radius = need(y, 'y');
      const closed = angle.bandwidth > 0;
      const paintChannel = mark.mark === 'line' ? mark.stroke : mark.fill;
      const z = mark.z ?? fieldOf(paintChannel);
      const xs = values('x') ?? [],
        ys = values('y') ?? [];
      const groups = new Map<string, number[]>();
      rows.forEach((row, i) => {
        const key = z === undefined ? 'all' : String(row[z] ?? '');
        const group = groups.get(key);
        if (group === undefined) groups.set(key, [i]);
        else group.push(i);
      });
      const graphics: Graphic[] = [];
      for (const [key, members] of groups) {
        const points = members.flatMap((i) => {
          const a = angle.place(xs[i] ?? null),
            r = radius.place(ys[i] ?? null);
          return a === undefined || r === undefined ? [] : [toXY(frame, a, r)];
        });
        if (points.length === 0) continue;
        const head = members.slice(0, 1).map((i) => rows[i] ?? {});
        const colour =
          paintOf(
            head,
            paintChannel,
            `${path}.${mark.mark === 'line' ? 'stroke' : 'fill'}`,
            context,
            'currentColor',
          )[0] ?? 'currentColor';
        const title = titlesOf(head, mark.title, `${path}.title`)[0];
        if (mark.mark === 'line') {
          const d = closed
            ? closedPath(points, mark.curve)
            : (line(points, mark.curve === undefined ? {} : { curve: mark.curve }) ?? '');
          if (d !== '')
            graphics.push({
              kind: 'path',
              key,
              d,
              fill: 'none',
              stroke: colour,
              strokeWidth: mark.strokeWidth ?? 1.5,
              opacity,
              ...withTitle(title),
            });
          continue;
        }
        // An area runs out along its points and back along the baseline ring.
        const base = members.flatMap((i) => {
          const a = angle.place(xs[i] ?? null);
          return a === undefined ? [] : [toXY(frame, a, radius.baseline)];
        });
        const ring = closed && radius.baseline <= 0.5;
        const d = ring
          ? closedPath(points, mark.curve)
          : `${line([...points, ...base.reverse()]) ?? ''}Z`;
        graphics.push({
          kind: 'path',
          key,
          d,
          fill: colour,
          stroke: 'none',
          strokeWidth: 0,
          opacity: mark.opacity ?? 0.3,
          ...withTitle(title),
        });
      }
      return graphics;
    }
    case 'dot':
    case 'text': {
      const angle = need(x, 'x'),
        radius = need(y, 'y');
      const xs = values('x') ?? [],
        ys = values('y') ?? [];
      const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'currentColor');
      const strokes = paintOf(
        rows,
        mark.mark === 'dot' ? mark.stroke : undefined,
        `${path}.stroke`,
        context,
        'none',
      );
      const texts = mark.mark === 'text' ? (values('text') ?? []) : [];
      const sizes = values('r');
      const constantSize = mark.mark === 'dot' && isConstant(mark.r);
      return rows.flatMap((_, i): ReadonlyArray<Graphic> => {
        const a = angle.place(xs[i] ?? null),
          r = radius.place(ys[i] ?? null);
        if (a === undefined || r === undefined) return [];
        const [px, py] = toXY(frame, a, r);
        if (mark.mark === 'text') {
          const text = texts[i];
          if (text === null || text === undefined) return [];
          return [
            {
              kind: 'text',
              key: keys[i] ?? `${index}:${i}`,
              x: round(px + (mark.dx ?? 0)),
              y: round(py + (mark.dy ?? 0)),
              text: String(text),
              fill: fills[i] ?? 'currentColor',
              anchor: mark.anchor ?? 'middle',
              opacity: opacity * (dims[i] ?? 1),
            },
          ];
        }
        const size = sizes?.[i] ?? null;
        return [
          {
            kind: 'circle',
            key: keys[i] ?? `${index}:${i}`,
            cx: round(px),
            cy: round(py),
            r: sizes === undefined ? 3 : constantSize ? numeric(size) : context.size(size),
            fill: fills[i] ?? 'currentColor',
            stroke: strokes[i] ?? 'none',
            strokeWidth: mark.strokeWidth ?? 1,
            opacity: opacity * (dims[i] ?? 1),
            ...withTitle(titles[i]),
          },
        ];
      });
    }
    case 'rule': {
      const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'currentColor');
      const spoke = mark.x !== undefined;
      const scale = need(spoke ? x : y, spoke ? 'x' : 'y');
      const at = values(spoke ? 'x' : 'y') ?? [];
      return rows.flatMap((_, i): ReadonlyArray<Graphic> => {
        const v = scale.place(at[i] ?? null);
        if (v === undefined) return [];
        const common = {
          key: keys[i] ?? `${index}:${i}`,
          stroke: strokes[i] ?? 'currentColor',
          strokeWidth: mark.strokeWidth ?? 1,
          opacity,
          ...withTitle(titles[i]),
        };
        if (spoke) {
          const [x1, y1] = toXY(frame, v, frame.inner),
            [x2, y2] = toXY(frame, v, frame.outer);
          return [
            { kind: 'line', ...common, x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2) },
          ];
        }
        return [{ kind: 'path', ...common, d: circlePath(frame.cx, frame.cy, v), fill: 'none' }];
      });
    }
    default:
      return fail(path, `the ${mark.mark} mark cannot be drawn in polar coordinates`);
  }
}

/** Where an angular label sits, just outside the outer ring, and how it anchors. */
export interface AngularLabel {
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
}

export function angularLabel(geometry: PolarGeometry, angle: number): AngularLabel {
  const r = geometry.outer + 10;
  const sin = Math.sin(angle);
  return {
    x: round(geometry.cx + r * sin),
    y: round(geometry.cy - r * Math.cos(angle)),
    anchor: sin > 0.25 ? 'start' : sin < -0.25 ? 'end' : 'middle',
  };
}

/** A spoke from the inner to the outer ring, at an angle. */
export function spokeOf(
  geometry: PolarGeometry,
  angle: number,
): readonly [number, number, number, number] {
  const sin = Math.sin(angle),
    cos = Math.cos(angle);
  return [
    round(geometry.cx + geometry.inner * sin),
    round(geometry.cy - geometry.inner * cos),
    round(geometry.cx + geometry.outer * sin),
    round(geometry.cy - geometry.outer * cos),
  ];
}

/** A full circle as SVG path data, in two arcs. */
export const circlePath = (cx: number, cy: number, r: number): string =>
  `M${round(cx + r)},${round(cy)}A${round(r)},${round(r)} 0 1 1 ${round(cx - r)},${round(cy)}A${round(r)},${round(r)} 0 1 1 ${round(cx + r)},${round(cy)}Z`;
