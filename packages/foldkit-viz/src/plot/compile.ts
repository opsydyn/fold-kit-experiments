import { axisTicks, chartLayout, resolveDomain } from '../chart/layout.js';
import type { AxisScale, ChartFrame, PlotBounds } from '../chart/layout.js';
import { colorScale, divergingScale, interpolateRgbBasis } from '../math/color.js';
import { lttb, m4 } from '../math/downsample.js';
import { loess, polynomialRegression } from '../math/regression.js';
import { band, sqrt } from '../math/scale.js';
import * as schemes from '../math/schemes.js';
import { movingWindow } from '../math/stats.js';
import { area } from '../shape/area.js';
import { line } from '../shape/line.js';
import type {
  Channel,
  ColorScaleSpec,
  FacetGeometry,
  Legend,
  LineTransform,
  MarkGeometry,
  MarkSpec,
  MarkType,
  PlotAxis,
  PlotGeometry,
  PlotSpec,
  PlotTick,
  PositionScaleSpec,
  Row,
  Graphic,
  Value,
} from './types.js';

/**
 * Compiles a plot spec (ADR 0037) into positioned geometry. Pure and
 * framework-free: render the result with `foldkit/plot`, or any renderer.
 *
 * Every rejection is a RangeError whose message starts with the spec path.
 */

const fail = (path: string, message: string): never => {
  throw new RangeError(`${path}: ${message}`);
};

// ── Channels ──────────────────────────────────────────────────────────────────

/** Guards for raw JSON values: the spec is the I/O boundary, parsed here. */
const isNumber = (value: unknown): value is number => typeof value === 'number';
const isText = (value: unknown): value is string => typeof value === 'string';
const isFlag = (value: unknown): value is boolean => typeof value === 'boolean';

const isConstant = (channel: unknown): channel is Readonly<{ value: Value }> =>
  typeof channel === 'object' && channel !== null && 'value' in channel;

const fieldOf = (channel: Channel | undefined): string | undefined =>
  isText(channel) ? channel : undefined;

function read(rows: ReadonlyArray<Row>, channel: Channel, path: string): ReadonlyArray<Value> {
  if (isConstant(channel)) return rows.map(() => channel.value);
  if (!isText(channel) || channel === '') return fail(path, 'must be a field name or { value }');
  if (rows.length > 0 && !rows.some((row) => Object.hasOwn(row, channel)))
    fail(path, `field "${channel}" is missing from the data`);
  return rows.map((row) => row[channel] ?? null);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

/** A value as a number on a continuous axis: numbers as they are, ISO dates as epoch ms. */
const numeric = (value: Value): number => {
  if (isNumber(value)) return value;
  if (isText(value) && ISO_DATE.test(value)) return Date.parse(value);
  return Number.NaN;
};

// ── Marks: what each takes ────────────────────────────────────────────────────

type ChannelName = 'x' | 'y' | 'y0' | 'r' | 'fill' | 'stroke' | 'text' | 'title';

type MarkRule = Readonly<{
  required: ReadonlyArray<ChannelName>;
  channels: ReadonlyArray<ChannelName>;
}>;
const MARKS = {
  dot: { required: ['x', 'y'], channels: ['x', 'y', 'r', 'fill', 'stroke', 'title'] },
  line: { required: ['x', 'y'], channels: ['x', 'y', 'stroke', 'title'] },
  area: { required: ['x', 'y'], channels: ['x', 'y', 'y0', 'fill', 'title'] },
  bar: { required: ['x', 'y'], channels: ['x', 'y', 'fill', 'stroke', 'title'] },
  rule: { required: [], channels: ['x', 'y', 'stroke', 'title'] },
  text: { required: ['x', 'y', 'text'], channels: ['x', 'y', 'text', 'fill', 'title'] },
  cell: { required: ['x', 'y'], channels: ['x', 'y', 'fill', 'stroke', 'title'] },
} satisfies Readonly<Record<MarkType, MarkRule>>;
const OPTIONS = new Set([
  'mark',
  'data',
  'key',
  'opacity',
  'strokeWidth',
  'curve',
  'transform',
  'z',
  'anchor',
  'dx',
  'dy',
]);
const TRANSFORMABLE = {
  line: ['regression', 'loess', 'window', 'downsample'],
  area: ['window'],
} satisfies Readonly<Partial<Record<MarkType, ReadonlyArray<string>>>>;
const transformsFor = (mark: MarkType): ReadonlyArray<string> =>
  mark === 'line' ? TRANSFORMABLE.line : mark === 'area' ? TRANSFORMABLE.area : [];

const isMarkType = (value: unknown): value is MarkType =>
  isText(value) && Object.hasOwn(MARKS, value);

function validateMark(mark: MarkSpec, path: string): void {
  if (!isMarkType(mark.mark))
    fail(
      `${path}.mark`,
      `unknown mark "${String(mark.mark)}"; expected one of ${Object.keys(MARKS).join(', ')}`,
    );
  const rule: MarkRule = MARKS[mark.mark];
  for (const key of Object.keys(mark))
    if (!OPTIONS.has(key) && !rule.channels.some((channel) => channel === key))
      fail(`${path}.${key}`, `a ${mark.mark} mark does not take ${key}`);
  for (const channel of rule.required)
    if (!(channel in mark)) fail(`${path}.${channel}`, `a ${mark.mark} mark needs ${channel}`);
  if (mark.mark === 'rule' && 'x' in mark === 'y' in mark)
    fail(path, 'a rule mark takes exactly one of x and y');
  if ('transform' in mark && mark.transform !== undefined) {
    const type: unknown = mark.transform.type;
    if (!transformsFor(mark.mark).includes(String(type)))
      fail(`${path}.transform.type`, `a ${mark.mark} mark cannot take a ${String(type)} transform`);
  }
}

const channelOf = (mark: MarkSpec, name: ChannelName): Channel | undefined => {
  switch (name) {
    case 'x':
      return 'x' in mark ? mark.x : undefined;
    case 'y':
      return 'y' in mark ? mark.y : undefined;
    case 'y0':
      return 'y0' in mark ? mark.y0 : undefined;
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
  }
};

// ── Facets ────────────────────────────────────────────────────────────────────

type FacetCell = Readonly<{
  key: string;
  label: string;
  fx?: string;
  fy?: string;
  bounds: PlotBounds;
}>;

const DEFAULT_MARGINS = { top: 20, right: 16, bottom: 40, left: 52 };
const FACET_GAP_X = 24;
const FACET_GAP_Y = 44;
const FACET_HEADER = 18;

function uniqueValues(
  rowSets: ReadonlyArray<ReadonlyArray<Row>>,
  field: string,
): ReadonlyArray<string> {
  const values: string[] = [];
  for (const rows of rowSets)
    for (const row of rows)
      if (Object.hasOwn(row, field)) {
        const value = String(row[field]);
        if (!values.includes(value)) values.push(value);
      }
  return values;
}

function facetCells(
  spec: PlotSpec,
  rowSets: ReadonlyArray<ReadonlyArray<Row>>,
): ReadonlyArray<FacetCell> {
  const margins = { ...DEFAULT_MARGINS, ...spec.margins };
  const inner = {
    left: margins.left,
    top: margins.top,
    width: spec.width - margins.left - margins.right,
    height: spec.height - margins.top - margins.bottom,
  };
  if (!(inner.width > 0 && inner.height > 0)) fail('margins', 'leave no room to plot');
  const fx = spec.facet?.x,
    fy = spec.facet?.y;
  const columns = fx === undefined ? [undefined] : uniqueValues(rowSets, fx);
  const rows = fy === undefined ? [undefined] : uniqueValues(rowSets, fy);
  if (columns.length === 0) fail('facet.x', `field "${fx}" is missing from the data`);
  if (rows.length === 0) fail('facet.y', `field "${fy}" is missing from the data`);
  const faceted = fx !== undefined || fy !== undefined;
  const header = faceted ? FACET_HEADER : 0;
  const width = (inner.width - FACET_GAP_X * (columns.length - 1)) / columns.length;
  const height = (inner.height - FACET_GAP_Y * (rows.length - 1)) / rows.length - header;
  if (!(width > 0 && height > 0)) fail('facet', 'the plot is too small for this many facets');
  return rows.flatMap((ry, j) =>
    columns.map((cx, i) => {
      const left = inner.left + i * (width + FACET_GAP_X);
      const top = inner.top + j * (height + header + FACET_GAP_Y) + header;
      const label = [cx, ry].filter((v) => v !== undefined).join(' · ');
      const cell: FacetCell = {
        key: faceted ? JSON.stringify([cx ?? null, ry ?? null]) : 'plot',
        label,
        bounds: { left, top, right: left + width, bottom: top + height, width, height },
      };
      if (cx !== undefined && ry !== undefined) return { ...cell, fx: cx, fy: ry };
      if (cx !== undefined) return { ...cell, fx: cx };
      if (ry !== undefined) return { ...cell, fy: ry };
      return cell;
    }),
  );
}

const inFacet = (rows: ReadonlyArray<Row>, field: string | undefined, value: string | undefined) =>
  field === undefined || value === undefined || !rows.some((row) => Object.hasOwn(row, field))
    ? rows
    : rows.filter((row) => String(row[field]) === value);

// ── Transforms ────────────────────────────────────────────────────────────────

const X = '\u0000x',
  Y = '\u0000y',
  LO = '\u0000lo',
  HI = '\u0000hi';

type Prepared = Readonly<{
  mark: MarkSpec;
  index: number;
  path: string;
  /** Rows as given, for type inference. */
  source: ReadonlyArray<Row>;
  /** Rows after the transform; channels below name their fields. */
  rows: ReadonlyArray<Row>;
  x?: Channel;
  y?: Channel;
  /** A regression's confidence band: rows with X, LO and HI. */
  band?: ReadonlyArray<Row>;
}>;

type TransformResult = Pick<Prepared, 'rows' | 'x' | 'y' | 'band'>;

function seriesOf(
  rows: ReadonlyArray<Row>,
  field: string | undefined,
): ReadonlyArray<readonly [string, ReadonlyArray<Row>]> {
  if (field === undefined) return [['all', rows]];
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = String(row[field] ?? '');
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups];
}

function applyTransform(
  mark: MarkSpec,
  transform: LineTransform,
  rows: ReadonlyArray<Row>,
  path: string,
  plotWidth: number,
): TransformResult {
  const x = channelOf(mark, 'x'),
    y = channelOf(mark, 'y');
  const xs = read(rows, x ?? '', `${path}.x`).map(numeric);
  const ys = read(rows, y ?? '', `${path}.y`).map(numeric);
  const z =
    mark.mark === 'line' || mark.mark === 'area'
      ? (mark.z ?? (mark.mark === 'line' ? fieldOf(mark.stroke) : fieldOf(mark.fill)))
      : undefined;
  const indexed = rows.map((row, i) => ({
    ...row,
    [X]: xs[i] ?? Number.NaN,
    [Y]: ys[i] ?? Number.NaN,
  }));
  const xy = { x: (r: Row) => numeric(r[X] ?? null), y: (r: Row) => numeric(r[Y] ?? null) };
  const out: Row[] = [];
  const bandRows: Row[] = [];
  for (const [, series] of seriesOf(indexed, z)) {
    const carry = z === undefined || series[0] === undefined ? {} : { [z]: series[0][z] ?? null };
    switch (transform.type) {
      case 'regression': {
        const fit = polynomialRegression(series, xy, { degree: transform.degree ?? 1 });
        const finite = series.map(xy.x).filter(Number.isFinite);
        const lo = Math.min(...finite),
          hi = Math.max(...finite);
        for (let i = 0; i <= 60; i += 1) {
          const at = lo + ((hi - lo) * i) / 60;
          const interval = fit.interval(at, transform.level ?? 0.95);
          out.push({ ...carry, [X]: at, [Y]: interval.fit });
          if (transform.band ?? true)
            bandRows.push({ ...carry, [X]: at, [LO]: interval.lower, [HI]: interval.upper });
        }
        break;
      }
      case 'loess':
        for (const p of loess(series, xy, { bandwidth: transform.bandwidth ?? 0.3 }))
          out.push({ ...carry, [X]: p.x, [Y]: p.y });
        break;
      case 'window': {
        const smoothed = movingWindow(series.map(xy.y), {
          size: transform.size,
          reduce: transform.reduce,
          anchor: transform.anchor ?? 'trailing',
        });
        series.forEach((row, i) => out.push({ ...row, [Y]: smoothed[i] ?? Number.NaN }));
        break;
      }
      case 'downsample': {
        const sorted = series.filter((r) => Number.isFinite(xy.x(r)) && Number.isFinite(xy.y(r)));
        const width = Math.max(1, Math.round(plotWidth));
        out.push(
          ...(transform.method === 'm4'
            ? m4(sorted, xy, { width })
            : lttb(sorted, xy, Math.max(3, width))),
        );
        break;
      }
    }
  }
  return bandRows.length > 0
    ? { rows: out, x: X, y: Y, band: bandRows }
    : { rows: out, x: X, y: Y };
}

// ── Scales ────────────────────────────────────────────────────────────────────

type AxisName = 'x' | 'y';
type ScaleType = NonNullable<PositionScaleSpec['type']>;

type PositionScale = Readonly<{
  axis: PlotAxis;
  /** Centre of a band, or the projected value; undefined when it cannot be placed. */
  place: (value: Value) => number | undefined;
  /** Start of a band; equal to place for continuous scales. */
  start: (value: Value) => number | undefined;
  bandwidth: number;
  /** Where a bar or area starts: zero when in range, otherwise the low edge. */
  baseline: number;
}>;

type ScaleInfo = Readonly<{
  type: ScaleType;
  domain: readonly [number, number] | ReadonlyArray<string>;
  label: string;
  spec: PositionScaleSpec;
}>;

const axisScaleOf = (type: ScaleType, spec: PositionScaleSpec): AxisScale => {
  switch (type) {
    case 'log':
      return spec.base === undefined ? { type: 'log' } : { type: 'log', base: spec.base };
    case 'symlog':
      return spec.constant === undefined
        ? { type: 'symlog' }
        : { type: 'symlog', constant: spec.constant };
    case 'pow':
      return { type: 'pow', exponent: spec.exponent ?? 0.5 };
    case 'time':
      return spec.zone === undefined ? { type: 'time' } : { type: 'time', zone: spec.zone };
    default:
      return { type: 'linear' };
  }
};

/** Which channels feed each position axis, and whether a mark wants that axis to include zero. */
function axisValues(prepared: ReadonlyArray<Prepared>, axis: AxisName) {
  const source: Value[] = [];
  const values: Value[] = [];
  const fields = new Set<string>();
  let zero = false;
  for (const p of prepared) {
    const original = channelOf(p.mark, axis);
    if (original === undefined) continue;
    const field = fieldOf(original);
    if (field !== undefined) fields.add(field);
    source.push(...read(p.source, original, `${p.path}.${axis}`));
    const channel = axis === 'x' ? (p.x ?? original) : (p.y ?? original);
    values.push(...read(p.rows, channel, `${p.path}.${axis}`));
    if (axis === 'y' && p.band !== undefined)
      values.push(...p.band.flatMap((r) => [r[LO] ?? null, r[HI] ?? null]));
    if (axis === 'y' && p.mark.mark === 'area') {
      if (p.mark.y0 === undefined) zero = true;
      else values.push(...read(p.rows, p.mark.y0, `${p.path}.y0`));
    }
    if (p.mark.mark === 'bar') zero = true;
  }
  return { source, values, fields: [...fields], zero };
}

function inferType(values: ReadonlyArray<Value>, axis: AxisName): ScaleType {
  const present = values.filter((v) => v !== null);
  if (present.length === 0) return 'linear';
  if (present.every((v) => isNumber(v))) return 'linear';
  if (present.every((v) => isText(v) && ISO_DATE.test(v))) return 'time';
  if (present.every((v) => isText(v) || isFlag(v))) return 'band';
  return fail(axis, 'mixes numbers with strings; give the axis a type');
}

function resolveScale(
  prepared: ReadonlyArray<Prepared>,
  axis: AxisName,
  spec: PositionScaleSpec = {},
): ScaleInfo | null {
  const { source, values, fields, zero } = axisValues(prepared, axis);
  const usedByBar = prepared.some((p) => p.mark.mark === 'bar' || p.mark.mark === 'cell');
  if (source.length === 0 && spec.domain === undefined && !usedByBar) return null;
  const type = spec.type ?? inferType(source, axis);
  const label = spec.label ?? (fields.length === 1 ? (fields[0] ?? '') : '');
  if (type === 'band') {
    if (source.some((v) => isNumber(v)))
      fail(axis, 'a band axis takes strings or booleans, not numbers');
    const explicit = spec.domain;
    if (explicit !== undefined && !explicit.every((v) => isText(v)))
      fail(`${axis}.domain`, 'a band domain lists strings');
    const seen: string[] = [];
    for (const v of values) if (v !== null && !seen.includes(String(v))) seen.push(String(v));
    // SAFETY: the explicit band domain was checked to hold strings just above.
    return { type, domain: (explicit as ReadonlyArray<string> | undefined) ?? seen, label, spec };
  }
  const explicit = spec.domain;
  if (explicit !== undefined && !(explicit.length === 2 && explicit.every((v) => isNumber(v))))
    fail(`${axis}.domain`, 'a continuous domain is [min, max]');
  const scale = axisScaleOf(type, spec);
  const numbers = values.map(numeric);
  // SAFETY: the explicit domain was checked to be two numbers just above.
  const range = explicit as readonly [number, number] | undefined;
  if (type === 'log' && range !== undefined && !(range[0] > 0 && range[1] > 0))
    fail(`${axis}.domain`, 'a log domain must be positive');
  if (type === 'log' && spec.zero === true) fail(`${axis}.zero`, 'a log axis cannot include zero');
  if (type === 'log' && spec.base !== undefined && !(spec.base > 0 && spec.base !== 1))
    fail(`${axis}.base`, 'must be positive and not one');
  if (
    type === 'pow' &&
    spec.exponent !== undefined &&
    !(Number.isFinite(spec.exponent) && spec.exponent !== 0)
  )
    fail(`${axis}.exponent`, 'must be finite and non-zero');
  if (type === 'symlog' && spec.constant !== undefined && !(spec.constant > 0))
    fail(`${axis}.constant`, 'must be positive');
  const domain = resolveDomain(numbers, range, (spec.zero ?? zero) && type !== 'log', scale);
  return { type, domain, label, spec };
}

function frameFor(width: number, height: number, bounds: PlotBounds): ChartFrame {
  return {
    width,
    height,
    margins: {
      left: bounds.left,
      top: bounds.top,
      right: width - bounds.right,
      bottom: height - bounds.bottom,
    },
  };
}

function buildScale(
  info: ScaleInfo,
  axis: AxisName,
  bounds: PlotBounds,
  spec: PlotSpec,
): PositionScale {
  const range: readonly [number, number] =
    axis === 'x' ? [bounds.left, bounds.right] : [bounds.bottom, bounds.top];
  const orientation = axis === 'x' ? 'bottom' : 'left';
  const grid = info.spec.grid ?? info.type !== 'band';
  if (info.type === 'band') {
    // SAFETY: resolveScale gives band scales a string domain.
    const domain = info.domain as ReadonlyArray<string>;
    const padding = info.spec.padding ?? 0.1;
    if (!(padding >= 0 && padding < 1)) fail(`${axis}.padding`, 'must be in [0, 1)');
    const scale = band({
      domain: [...domain],
      range: axis === 'x' ? range : [bounds.top, bounds.bottom],
      paddingInner: padding,
      paddingOuter: padding / 2,
    });
    const known = new Set(domain);
    const start = (v: Value) =>
      v !== null && known.has(String(v)) ? scale.position(String(v)) : undefined;
    const place = (v: Value) => {
      const s = start(v);
      return s === undefined ? undefined : s + scale.bandwidth / 2;
    };
    const ticks: ReadonlyArray<PlotTick> = domain.map((value) => ({
      value,
      position: place(value) ?? 0,
      label: value,
    }));
    return {
      axis: { type: 'band', orientation, domain, label: info.label, ticks, grid },
      place,
      start,
      bandwidth: scale.bandwidth,
      baseline: axis === 'x' ? bounds.left : bounds.bottom,
    };
  }
  // SAFETY: resolveScale gives continuous scales a two-number domain.
  const domain = info.domain as readonly [number, number];
  const scale = axisScaleOf(info.type, info.spec);
  const layout =
    axis === 'x'
      ? chartLayout(frameFor(spec.width, spec.height, bounds), domain, [0, 1], { x: scale })
      : chartLayout(frameFor(spec.width, spec.height, bounds), [0, 1], domain, { y: scale });
  const project = axis === 'x' ? layout.x : layout.y;
  const place = (v: Value) => {
    const n = numeric(v);
    if (!Number.isFinite(n) || (info.type === 'log' && n <= 0)) return undefined;
    const p = project(n);
    return Number.isFinite(p) ? p : undefined;
  };
  const ticks = axisTicks(domain, project, info.spec.ticks ?? 5, scale).map((t) => ({
    value: t.value,
    position: t.position,
    label: t.label ?? String(t.value),
  }));
  const lo = Math.min(...domain),
    hi = Math.max(...domain);
  const baseline = lo <= 0 && hi >= 0 && info.type !== 'log' ? project(0) : project(lo);
  return {
    axis: { type: info.type, orientation, domain, label: info.label, ticks, grid },
    place,
    start: place,
    bandwidth: 0,
    baseline,
  };
}

// ── Colour and size ───────────────────────────────────────────────────────────

const SCHEMES: Readonly<Record<string, ReadonlyArray<string>>> = Object.fromEntries(
  Object.entries(schemes).filter((entry): entry is [string, ReadonlyArray<string>] =>
    Array.isArray(entry[1]),
  ),
);

type ColorScale = Readonly<{ paint: (value: Value) => string; legend: Legend | null }>;

const COLOR_CHANNELS = ['fill', 'stroke'] as const;

function resolveColor(
  prepared: ReadonlyArray<Prepared>,
  spec: ColorScaleSpec = {},
): ColorScale | null {
  const values: Value[] = [];
  const fields = new Set<string>();
  for (const p of prepared)
    for (const name of COLOR_CHANNELS) {
      const field = fieldOf(channelOf(p.mark, name));
      if (field === undefined) continue;
      fields.add(field);
      values.push(...read(p.source, field, `${p.path}.${name}`));
    }
  if (fields.size === 0) return null;
  const present = values.filter((v) => v !== null);
  const type = spec.type ?? (present.every((v) => isNumber(v)) ? 'sequential' : 'categorical');
  const label = spec.label ?? (fields.size === 1 ? ([...fields][0] ?? '') : '');
  const showLegend = spec.legend ?? true;
  const schemeName =
    spec.scheme ??
    (type === 'categorical' ? 'tableau10' : type === 'sequential' ? 'viridis' : 'rdBu');
  const scheme = SCHEMES[schemeName];
  if (scheme === undefined) return fail('color.scheme', `unknown scheme "${schemeName}"`);
  if (type === 'categorical') {
    const domain =
      spec.domain === undefined ? [...new Set(present.map(String))] : spec.domain.map(String);
    const paint = (v: Value) =>
      scheme[Math.max(0, domain.indexOf(String(v))) % scheme.length] ?? 'currentColor';
    return {
      paint,
      legend: showLegend
        ? {
            kind: 'categorical',
            label,
            entries: domain.map((key) => ({ key, label: key, color: paint(key) })),
          }
        : null,
    };
  }
  const numbers = present.map(numeric).filter(Number.isFinite);
  if (
    spec.domain !== undefined &&
    !(spec.domain.length === 2 && spec.domain.every((v) => isNumber(v)))
  )
    fail('color.domain', 'a continuous colour domain is [min, max]');
  // SAFETY: checked just above to be two numbers when given.
  const explicit = spec.domain as readonly [number, number] | undefined;
  const lo = explicit?.[0] ?? (numbers.length === 0 ? 0 : Math.min(...numbers));
  const hi = explicit?.[1] ?? (numbers.length === 0 ? 1 : Math.max(...numbers));
  const interpolator = interpolateRgbBasis(scheme);
  const toColor =
    type === 'diverging'
      ? divergingScale({ domain: [lo, lo < 0 && hi > 0 ? 0 : (lo + hi) / 2, hi], interpolator })
      : colorScale({ domain: [lo, hi], interpolator });
  const paint = (v: Value) => {
    const n = numeric(v);
    return Number.isFinite(n) ? toColor(n) : 'currentColor';
  };
  const stops = Array.from({ length: 9 }, (_, i) => toColor(lo + ((hi - lo) * i) / 8));
  return {
    paint,
    legend: showLegend ? { kind: 'continuous', label, domain: [lo, hi], stops } : null,
  };
}

function resolveSize(prepared: ReadonlyArray<Prepared>, spec: PlotSpec): (value: Value) => number {
  const range = spec.r?.range ?? [2, 10];
  if (!(range[0] >= 0 && range[1] >= range[0]))
    fail('r.range', 'must be [min, max] with 0 <= min <= max');
  const values = prepared.flatMap((p) => {
    const field = p.mark.mark === 'dot' ? fieldOf(p.mark.r) : undefined;
    return field === undefined
      ? []
      : read(p.source, field, `${p.path}.r`).map(numeric).filter(Number.isFinite);
  });
  const max = Math.max(0, ...values);
  const scale = sqrt({ domain: [0, max || 1], range: [range[0], range[1]] });
  return (v) => {
    const n = numeric(v);
    return Number.isFinite(n) && n >= 0 ? scale(n) : range[0];
  };
}

// ── Mark geometry ─────────────────────────────────────────────────────────────

type Context = Readonly<{
  x: PositionScale | null;
  y: PositionScale | null;
  color: ColorScale | null;
  size: (value: Value) => number;
  bounds: PlotBounds;
}>;

const paintOf = (
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

const titlesOf = (rows: ReadonlyArray<Row>, channel: Channel | undefined, path: string) =>
  channel === undefined
    ? rows.map(() => undefined)
    : read(rows, channel, path).map((v) => (v === null ? undefined : String(v)));

const keysOf = (rows: ReadonlyArray<Row>, mark: MarkSpec, index: number): ReadonlyArray<string> =>
  rows.map((row, i) =>
    mark.key !== undefined && row[mark.key] !== undefined ? String(row[mark.key]) : `${index}:${i}`,
  );

const withTitle = (title: string | undefined) => (title === undefined ? {} : { title });

function requireScale(scale: PositionScale | null, path: string, axis: AxisName): PositionScale {
  return scale ?? fail(`${path}.${axis}`, 'no scale could be resolved for this axis');
}

function markGraphics(p: Prepared, context: Context): ReadonlyArray<Graphic> {
  const { mark, rows, path, index } = p;
  const opacity = mark.opacity ?? 1;
  const keys = keysOf(rows, mark, index);
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  switch (mark.mark) {
    case 'dot': {
      const x = requireScale(context.x, path, 'x'),
        y = requireScale(context.y, path, 'y');
      const xs = read(rows, p.x ?? mark.x, `${path}.x`),
        ys = read(rows, p.y ?? mark.y, `${path}.y`);
      const fills = paintOf(
        rows,
        mark.fill,
        `${path}.fill`,
        context,
        mark.stroke === undefined ? 'currentColor' : 'none',
      );
      const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'none');
      const radii =
        mark.r === undefined
          ? rows.map(() => 3)
          : read(rows, mark.r, `${path}.r`).map((v) =>
              isConstant(mark.r) ? numeric(v) : context.size(v),
            );
      return rows.flatMap((_, i) => {
        const cx = x.place(xs[i] ?? null),
          cy = y.place(ys[i] ?? null);
        if (cx === undefined || cy === undefined) return [];
        return [
          {
            kind: 'circle' as const,
            key: keys[i] ?? `${index}:${i}`,
            cx,
            cy,
            r: radii[i] ?? 3,
            fill: fills[i] ?? 'currentColor',
            stroke: strokes[i] ?? 'none',
            strokeWidth: mark.strokeWidth ?? 1,
            opacity,
            ...withTitle(titles[i]),
          },
        ];
      });
    }
    case 'line':
    case 'area': {
      const x = requireScale(context.x, path, 'x'),
        y = requireScale(context.y, path, 'y');
      const z = mark.z ?? (mark.mark === 'line' ? fieldOf(mark.stroke) : fieldOf(mark.fill));
      const graphics: Graphic[] = [];
      const paintChannel = mark.mark === 'line' ? mark.stroke : mark.fill;
      if (p.band !== undefined)
        for (const [key, series] of seriesOf(p.band, z)) {
          const upper = series.map(
            (r) =>
              [x.place(r[X] ?? null) ?? Number.NaN, y.place(r[HI] ?? null) ?? Number.NaN] as const,
          );
          const lower = series.map(
            (r) =>
              [x.place(r[X] ?? null) ?? Number.NaN, y.place(r[LO] ?? null) ?? Number.NaN] as const,
          );
          const d = area(
            upper.filter((pt) => pt.every(Number.isFinite)),
            lower.filter((pt) => pt.every(Number.isFinite)),
          );
          const color =
            paintOf(
              series.slice(0, 1),
              paintChannel,
              `${path}.stroke`,
              context,
              'currentColor',
            )[0] ?? 'currentColor';
          if (d !== null)
            graphics.push({
              kind: 'path',
              key: `${key}:band`,
              d,
              fill: color,
              stroke: 'none',
              strokeWidth: 0,
              opacity: 0.2 * opacity,
            });
        }
      for (const [key, series] of seriesOf(rows, z)) {
        const xs = read(series, p.x ?? mark.x, `${path}.x`),
          ys = read(series, p.y ?? mark.y, `${path}.y`);
        const points = series.map(
          (_, i) =>
            [x.place(xs[i] ?? null) ?? Number.NaN, y.place(ys[i] ?? null) ?? Number.NaN] as const,
        );
        const color =
          paintOf(
            series.slice(0, 1),
            paintChannel,
            `${path}.${mark.mark === 'line' ? 'stroke' : 'fill'}`,
            context,
            'currentColor',
          )[0] ?? 'currentColor';
        const title = titlesOf(series.slice(0, 1), mark.title, `${path}.title`)[0];
        const curve = mark.curve === undefined ? {} : { curve: mark.curve };
        if (mark.mark === 'line') {
          const d = line(points, { ...curve, defined: (pt) => pt.every(Number.isFinite) }) ?? '';
          if (d !== '')
            graphics.push({
              kind: 'path',
              key,
              d,
              fill: 'none',
              stroke: color,
              strokeWidth: mark.strokeWidth ?? 1.5,
              opacity,
              ...withTitle(title),
            });
        } else {
          const finite = points.filter((pt) => pt.every(Number.isFinite));
          const baseline =
            mark.y0 === undefined
              ? y.baseline
              : read(series, mark.y0, `${path}.y0`)
                  .map((v, i) => [points[i]?.[0] ?? Number.NaN, y.place(v) ?? Number.NaN] as const)
                  .filter((pt) => pt.every(Number.isFinite));
          const d = area(finite, baseline, curve);
          if (d !== null)
            graphics.push({
              kind: 'path',
              key,
              d,
              fill: color,
              stroke: 'none',
              strokeWidth: 0,
              opacity: mark.opacity ?? 0.8,
              ...withTitle(title),
            });
        }
      }
      return graphics;
    }
    case 'bar': {
      const x = requireScale(context.x, path, 'x'),
        y = requireScale(context.y, path, 'y');
      const vertical = x.axis.type === 'band';
      if (vertical === (y.axis.type === 'band'))
        fail(path, 'a bar mark needs exactly one band axis');
      const xs = read(rows, mark.x, `${path}.x`),
        ys = read(rows, mark.y, `${path}.y`);
      const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'currentColor');
      const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'none');
      return rows.flatMap((_, i) => {
        const category = vertical ? x : y,
          value = vertical ? y : x;
        const start = category.start(vertical ? (xs[i] ?? null) : (ys[i] ?? null));
        const end = value.place(vertical ? (ys[i] ?? null) : (xs[i] ?? null));
        if (start === undefined || end === undefined) return [];
        const lo = Math.min(end, value.baseline),
          extent = Math.abs(end - value.baseline);
        const rect = vertical
          ? { x: start, y: lo, width: category.bandwidth, height: extent }
          : { x: lo, y: start, width: extent, height: category.bandwidth };
        return [
          {
            kind: 'rect' as const,
            key: keys[i] ?? `${index}:${i}`,
            ...rect,
            fill: fills[i] ?? 'currentColor',
            stroke: strokes[i] ?? 'none',
            opacity,
            ...withTitle(titles[i]),
          },
        ];
      });
    }
    case 'rule': {
      const vertical = mark.x !== undefined;
      const scale = requireScale(vertical ? context.x : context.y, path, vertical ? 'x' : 'y');
      const values = read(
        rows,
        (vertical ? mark.x : mark.y) ?? '',
        `${path}.${vertical ? 'x' : 'y'}`,
      );
      const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'currentColor');
      const { bounds } = context;
      return rows.flatMap((_, i) => {
        const at = scale.place(values[i] ?? null);
        if (at === undefined) return [];
        const ends = vertical
          ? { x1: at, x2: at, y1: bounds.top, y2: bounds.bottom }
          : { x1: bounds.left, x2: bounds.right, y1: at, y2: at };
        return [
          {
            kind: 'line' as const,
            key: keys[i] ?? `${index}:${i}`,
            ...ends,
            stroke: strokes[i] ?? 'currentColor',
            strokeWidth: mark.strokeWidth ?? 1,
            opacity,
            ...withTitle(titles[i]),
          },
        ];
      });
    }
    case 'text': {
      const x = requireScale(context.x, path, 'x'),
        y = requireScale(context.y, path, 'y');
      const xs = read(rows, mark.x, `${path}.x`),
        ys = read(rows, mark.y, `${path}.y`),
        texts = read(rows, mark.text, `${path}.text`);
      const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'currentColor');
      return rows.flatMap((_, i) => {
        const tx = x.place(xs[i] ?? null),
          ty = y.place(ys[i] ?? null);
        const text = texts[i];
        if (tx === undefined || ty === undefined || text === null || text === undefined) return [];
        return [
          {
            kind: 'text' as const,
            key: keys[i] ?? `${index}:${i}`,
            x: tx + (mark.dx ?? 0),
            y: ty + (mark.dy ?? 0),
            text: String(text),
            fill: fills[i] ?? 'currentColor',
            anchor: mark.anchor ?? 'middle',
            opacity,
          },
        ];
      });
    }
    case 'cell': {
      const x = requireScale(context.x, path, 'x'),
        y = requireScale(context.y, path, 'y');
      if (x.axis.type !== 'band' || y.axis.type !== 'band')
        fail(path, 'a cell mark needs band x and y axes');
      const xs = read(rows, mark.x, `${path}.x`),
        ys = read(rows, mark.y, `${path}.y`);
      const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'currentColor');
      const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'none');
      const values =
        mark.fill === undefined || isConstant(mark.fill)
          ? rows.map(() => 0)
          : read(rows, mark.fill, `${path}.fill`);
      return rows.flatMap((_, i) => {
        const cx = x.start(xs[i] ?? null),
          cy = y.start(ys[i] ?? null);
        if (cx === undefined || cy === undefined || values[i] === null) return [];
        return [
          {
            kind: 'rect' as const,
            key: keys[i] ?? `${index}:${i}`,
            x: cx,
            y: cy,
            width: x.bandwidth,
            height: y.bandwidth,
            fill: fills[i] ?? 'currentColor',
            stroke: strokes[i] ?? 'none',
            opacity,
            ...withTitle(titles[i]),
          },
        ];
      });
    }
  }
}

// ── Compile ───────────────────────────────────────────────────────────────────

function validateSpec(spec: PlotSpec): void {
  if (!(Number.isFinite(spec.width) && spec.width > 0))
    fail('width', 'must be finite and positive');
  if (!(Number.isFinite(spec.height) && spec.height > 0))
    fail('height', 'must be finite and positive');
  if (!Array.isArray(spec.marks) || spec.marks.length === 0)
    fail('marks', 'a plot needs at least one mark');
  spec.marks.forEach((mark, i) => validateMark(mark, `marks[${i}]`));
}

function markRows(spec: PlotSpec, mark: MarkSpec, path: string): ReadonlyArray<Row> {
  const rows = mark.data ?? spec.data;
  if (rows !== undefined) {
    if (!Array.isArray(rows)) fail(`${path}.data`, 'must be an array of rows');
    return rows;
  }
  // A mark of constants alone, such as a reference rule, draws once.
  const usesFields = MARKS[mark.mark].channels.some(
    (name) => fieldOf(channelOf(mark, name)) !== undefined,
  );
  return usesFields ? fail(`${path}.data`, 'no data: give the mark or the plot rows') : [{}];
}

export function compilePlot(spec: PlotSpec): PlotGeometry {
  validateSpec(spec);
  const base = spec.marks.map((mark, index) => {
    const path = `marks[${index}]`;
    return { mark, index, path, rows: markRows(spec, mark, path) };
  });
  const cells = facetCells(
    spec,
    base.map((m) => m.rows),
  );

  // Transforms run per facet, so a regression or downsample sees only its facet's rows.
  const perFacet = cells.map((cell) =>
    base.map(({ mark, index, path, rows }): Prepared => {
      const facetRows = inFacet(inFacet(rows, spec.facet?.x, cell.fx), spec.facet?.y, cell.fy);
      const transform = 'transform' in mark ? mark.transform : undefined;
      return transform === undefined
        ? { mark, index, path, source: facetRows, rows: facetRows }
        : {
            mark,
            index,
            path,
            source: facetRows,
            ...applyTransform(mark, transform, facetRows, `${path}.transform`, cell.bounds.width),
          };
    }),
  );
  const all = perFacet.flat();
  const xInfo = resolveScale(all, 'x', spec.x);
  const yInfo = resolveScale(all, 'y', spec.y);
  const color = resolveColor(all, spec.color);
  const size = resolveSize(all, spec);

  const facets: ReadonlyArray<FacetGeometry> = cells.map((cell, f) => {
    const x = xInfo === null ? null : buildScale(xInfo, 'x', cell.bounds, spec);
    const y = yInfo === null ? null : buildScale(yInfo, 'y', cell.bounds, spec);
    const context: Context = { x, y, color, size, bounds: cell.bounds };
    const marks: ReadonlyArray<MarkGeometry> = (perFacet[f] ?? []).map((p) => ({
      mark: p.mark.mark,
      index: p.index,
      graphics: markGraphics(p, context),
    }));
    return {
      key: cell.key,
      label: cell.label,
      plot: cell.bounds,
      x: x?.axis ?? null,
      y: y?.axis ?? null,
      marks,
    };
  });

  return {
    width: spec.width,
    height: spec.height,
    title: spec.title ?? '',
    description: spec.description ?? '',
    facets,
    legends: color?.legend === null || color === null ? [] : [color.legend],
  };
}
