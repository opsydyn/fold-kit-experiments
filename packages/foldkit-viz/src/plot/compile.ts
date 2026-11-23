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
import { SYMBOLS_FILL, symbolPath } from '../shape/symbol.js';
import type { SymbolType } from '../shape/symbol.js';
import {
  channelOf,
  fail,
  fieldOf,
  isConstant,
  spanOf,
  append,
  highlightFactors,
  isFlag,
  isNumber,
  isText,
  ISO_DATE,
  keysOf,
  numeric,
  paintOf,
  read,
  requireScale,
  titlesOf,
  withTitle,
} from './channels.js';
import type {
  AxisName,
  ChannelName,
  ColorScale,
  Context,
  PositionScale,
  SymbolScale,
} from './channels.js';
import { fillRows, isColumnTable, rowsOf } from './columns.js';
import type { Rows } from './columns.js';
import {
  fitProjection,
  geoGraphics,
  geoRows,
  graticuleGraphics,
  projectedGraphics,
  validateProjection,
} from './geo.js';
import { arcGraphics, validateArc } from './marks-arc.js';
import {
  densityGraphics,
  densityRows,
  isOneDimensional,
  validateDensity,
} from './marks-density.js';
import {
  arcDiagramGraphics,
  chordGraphics,
  forceGraphics,
  packGraphics,
  treeGraphics,
  voronoiGraphics,
} from './marks-network.js';
import {
  parallelGraphics,
  sankeyGraphics,
  sunburstGraphics,
  treemapGraphics,
} from './marks-panel.js';
import { binRows, rectGraphics, validateRect } from './marks-rect.js';
import { boxGraphics, linkGraphics, violinGraphics } from './marks-statistical.js';
import { polarFrame, polarGraphics, polarScales } from './polar.js';
import { seriesFieldOf, stackRows, validateStacking } from './stack.js';
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
  DotMark,
  PlotData,
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

// ── Marks: what each takes ────────────────────────────────────────────────────

type MarkRule = Readonly<{
  required: ReadonlyArray<ChannelName>;
  channels: ReadonlyArray<ChannelName>;
}>;
const MARKS = {
  dot: { required: ['x', 'y'], channels: ['x', 'y', 'r', 'fill', 'stroke', 'symbol', 'title'] },
  line: { required: ['x', 'y'], channels: ['x', 'y', 'stroke', 'title'] },
  area: { required: ['x', 'y'], channels: ['x', 'y', 'y0', 'fill', 'title'] },
  bar: { required: ['x', 'y'], channels: ['x', 'y', 'x0', 'y0', 'fill', 'stroke', 'title'] },
  box: { required: ['x', 'y'], channels: ['x', 'y', 'fill', 'stroke', 'title'] },
  violin: { required: ['x', 'y'], channels: ['x', 'y', 'fill', 'stroke', 'title'] },
  density: { required: ['x'], channels: ['x', 'y', 'fill', 'stroke', 'title'] },
  link: { required: ['x1', 'y1'], channels: ['x1', 'y1', 'x2', 'y2', 'stroke', 'title'] },
  arc: { required: ['value'], channels: ['value', 'fill', 'stroke', 'text', 'title'] },
  geo: { required: [], channels: ['fill', 'stroke', 'title'] },
  graticule: { required: [], channels: ['stroke'] },
  tree: { required: ['path'], channels: ['path', 'fill', 'stroke', 'title'] },
  pack: { required: ['path', 'value'], channels: ['path', 'value', 'fill', 'title'] },
  chord: {
    required: ['source', 'target', 'value'],
    channels: ['source', 'target', 'value', 'title'],
  },
  'arc-diagram': {
    required: ['source', 'target'],
    channels: ['source', 'target', 'value', 'fill', 'stroke', 'title'],
  },
  voronoi: { required: ['x', 'y'], channels: ['x', 'y', 'fill', 'stroke', 'title'] },
  force: {
    required: ['source', 'target'],
    channels: ['source', 'target', 'fill', 'stroke', 'title'],
  },
  treemap: { required: ['path', 'value'], channels: ['path', 'value', 'fill', 'title'] },
  sunburst: { required: ['path', 'value'], channels: ['path', 'value', 'fill', 'title'] },
  sankey: {
    required: ['source', 'target', 'value'],
    channels: ['source', 'target', 'value', 'title'],
  },
  parallel: { required: [], channels: ['stroke', 'title'] },
  rule: { required: [], channels: ['x', 'y', 'stroke', 'title'] },
  text: { required: ['x', 'y', 'text'], channels: ['x', 'y', 'text', 'fill', 'title'] },
  cell: { required: ['x', 'y'], channels: ['x', 'y', 'fill', 'stroke', 'title'] },
  rect: {
    required: [],
    channels: ['x', 'y', 'x1', 'x2', 'y1', 'y2', 'fill', 'stroke', 'title'],
  },
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
  'dense',
  'highlight',
  'bandwidth',
  'separator',
  'labels',
  'padding',
  'nodeWidth',
  'nodePadding',
  'dimensions',
  'thresholds',
  'stack',
  'group',
  'inset',
  'inner',
  'start',
  'end',
  'padAngle',
  'features',
  'step',
  'layout',
  'radial',
  'iterations',
  'distance',
  'strength',
]);
const TRANSFORMABLE = {
  line: ['regression', 'loess', 'window', 'downsample'],
  area: ['window'],
} satisfies Readonly<Partial<Record<MarkType, ReadonlyArray<string>>>>;
const transformsFor = (mark: MarkType): ReadonlyArray<string> =>
  mark === 'line' ? TRANSFORMABLE.line : mark === 'area' ? TRANSFORMABLE.area : [];

/** A mark's transforms as a list, in the order they apply. */
const isTransformList = (
  transform: LineTransform | ReadonlyArray<LineTransform>,
): transform is ReadonlyArray<LineTransform> => Array.isArray(transform);

const transformsOf = (mark: MarkSpec): ReadonlyArray<LineTransform> => {
  // A rect's bin transform derives its rows separately; see derive.
  if (mark.mark === 'rect' || !('transform' in mark) || mark.transform === undefined) return [];
  const transform: LineTransform | ReadonlyArray<LineTransform> = mark.transform;
  return isTransformList(transform) ? transform : [transform];
};

/** "a dot mark", "an area mark". */
const aMark = (mark: MarkType): string => `${/^[aeiou]/.test(mark) ? 'an' : 'a'} ${mark} mark`;

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
      fail(`${path}.${key}`, `${aMark(mark.mark)} does not take ${key}`);
  for (const channel of rule.required)
    if (!(channel in mark)) fail(`${path}.${channel}`, `${aMark(mark.mark)} needs ${channel}`);
  if (mark.mark === 'dot' && mark.dense === true && mark.symbol !== undefined)
    fail(`${path}.symbol`, 'a dense dot mark draws circles only');
  if (mark.mark === 'dot' && isConstant(mark.symbol) && !isSymbol(mark.symbol.value))
    fail(`${path}.symbol`, `unknown symbol "${String(mark.symbol.value)}"`);
  if (mark.mark === 'density') validateDensity(mark, path);
  if (mark.mark === 'rect') validateRect(mark, path);
  if (mark.mark === 'arc') validateArc(mark, path);
  if (mark.mark === 'bar' || mark.mark === 'area') validateStacking(mark, path);
  if (mark.mark === 'rule' && 'x' in mark === 'y' in mark)
    fail(path, 'a rule mark takes exactly one of x and y');
  if ('transform' in mark && mark.transform !== undefined) {
    const many = Array.isArray(mark.transform);
    transformsOf(mark).forEach((step, i) => {
      const type: unknown = step.type;
      if (!transformsFor(mark.mark).includes(String(type)))
        fail(
          `${path}.transform${many ? `[${i}]` : ''}.type`,
          `${aMark(mark.mark)} cannot take a ${String(type)} transform`,
        );
    });
  }
}

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
const FACET_HEADER = 30;

function uniqueValues(rowSets: ReadonlyArray<Rows>, field: string): ReadonlyArray<string> {
  const values: string[] = [];
  for (const rows of rowSets)
    for (const row of rowsOf(rows))
      if (Object.hasOwn(row, field)) {
        const value = String(row[field]);
        if (!values.includes(value)) values.push(value);
      }
  return values;
}

function facetCells(spec: PlotSpec, rowSets: ReadonlyArray<Rows>): ReadonlyArray<FacetCell> {
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

/** Each facet row's index in the full rows; facet rows keep their order. */
function originOf(data: Rows, facet: Rows): ReadonlyArray<number> {
  const rows = rowsOf(data),
    facetRows = rowsOf(facet);
  const origin: number[] = [];
  let next = 0;
  for (let i = 0; i < rows.length && next < facetRows.length; i += 1)
    if (rows[i] === facetRows[next]) {
      origin.push(i);
      next += 1;
    }
  return origin;
}

/** A facet's rows; without a facet field, the data as given, so columns stay columns. */
function inFacet(data: Rows, field: string | undefined, value: string | undefined): Rows {
  if (field === undefined || value === undefined) return data;
  const rows = rowsOf(data);
  return rows.some((row) => Object.hasOwn(row, field))
    ? rows.filter((row) => String(row[field]) === value)
    : data;
}

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
  source: Rows;
  /** Rows after any transform; `channels` name the fields a transform wrote. */
  rows: Rows;
  /** Channels a transform rewrote, read in place of the mark's own. */
  channels: Overrides;
  /** True when a transform replaced the rows, so colour reads them, not the source. */
  replaced: boolean;
  /** Axis titles a transform implies, such as "count" for a histogram. */
  labels: Readonly<Partial<Record<AxisName, string>>>;
  /** A regression's confidence band: rows with X, LO and HI. */
  band?: ReadonlyArray<Row>;
  /** Faceted dense marks: each row's index in the mark's full data. */
  origin?: ReadonlyArray<number>;
}>;

type Overrides = Readonly<Partial<Record<ChannelName, Channel>>>;

/** A channel as the mark draws it: a transform's override, or the mark's own. */
const channel = (p: Prepared, name: ChannelName): Channel | undefined =>
  p.channels[name] ?? channelOf(p.mark, name);

type TransformResult = Readonly<{
  rows: ReadonlyArray<Row>;
  x: Channel;
  y: Channel;
  band?: ReadonlyArray<Row>;
}>;

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
  x: Channel | undefined,
  y: Channel | undefined,
): TransformResult {
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
        const [lo, hi] = spanOf(finite) ?? [0, 0];
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

/**
 * Marks whose rows are derived rather than drawn as given: a one-dimensional
 * density becomes its curve. Runs per facet, before scales are resolved, so
 * the axes cover what is drawn.
 */
function derive(p: Prepared, spec: PlotSpec): Prepared {
  const { mark } = p;
  if (mark.mark === 'rect' && mark.transform !== undefined) {
    const binned = binRows(mark, rowsOf(p.rows), p.path);
    return {
      ...p,
      rows: binned.rows,
      channels: { ...p.channels, ...binned.channels },
      replaced: true,
      labels: binned.label === undefined ? p.labels : { ...p.labels, y: binned.label },
    };
  }
  if ((mark.mark === 'bar' || mark.mark === 'area') && mark.stack !== undefined) {
    const vertical = mark.mark === 'area' || barIsVertical(p, spec);
    const category = channel(p, vertical ? 'x' : 'y'),
      value = channel(p, vertical ? 'y' : 'x');
    if (category === undefined || value === undefined) return p;
    const stacked = stackRows(
      mark,
      rowsOf(p.rows),
      p.path,
      category,
      value,
      vertical ? 'x' : 'y',
      vertical ? 'y' : 'x',
    );
    return {
      ...p,
      rows: stacked.rows,
      channels: vertical
        ? { ...p.channels, y: stacked.end, y0: stacked.start }
        : { ...p.channels, x: stacked.end, x0: stacked.start },
      replaced: true,
    };
  }
  if (mark.mark === 'density' && isOneDimensional(mark)) {
    const curve = densityRows(mark, rowsOf(p.rows), p.path);
    return {
      ...p,
      rows: curve.rows,
      channels: { ...p.channels, x: curve.x, y: curve.y },
      replaced: true,
      labels: { ...p.labels, y: 'density' },
    };
  }
  return p;
}

/**
 * Whether a bar stands on the x axis, before scales are resolved: the band axis
 * is the one the spec says, or else the one whose channel holds strings.
 */
function barIsVertical(p: Prepared, spec: PlotSpec): boolean {
  if (spec.x?.type === 'band') return true;
  if (spec.y?.type === 'band') return false;
  const textual = (name: AxisName) => {
    const own = channel(p, name);
    const values = own === undefined ? [] : read(p.rows, own, `${p.path}.${name}`);
    return values.length > 0 && values.every((v) => v === null || isText(v) || isFlag(v));
  };
  if (textual('x')) return true;
  if (textual('y')) return false;
  return fail(p.path, 'a stacked bar needs one band axis; give x or y the type band');
}

// ── Scales ────────────────────────────────────────────────────────────────────

type ScaleType = NonNullable<PositionScaleSpec['type']>;

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
/** The channels that place a mark along each axis. */
const AXIS_CHANNELS = {
  x: ['x', 'x0', 'x1', 'x2'],
  y: ['y', 'y0', 'y1', 'y2'],
} satisfies Readonly<Record<AxisName, ReadonlyArray<ChannelName>>>;

function axisValues(prepared: ReadonlyArray<Prepared>, axis: AxisName) {
  const source: Value[] = [];
  const values: Value[] = [];
  const fields = new Set<string>();
  let zero = false;
  for (const p of prepared) {
    const label = p.labels[axis];
    if (label !== undefined) fields.add(label);
    for (const name of AXIS_CHANNELS[axis]) {
      const own = channelOf(p.mark, name);
      const drawn = channel(p, name);
      if (drawn === undefined) continue;
      const field = fieldOf(own);
      if (field !== undefined && name === axis && label === undefined) fields.add(field);
      // The mark's own channel reads the source rows for type inference; a transform's
      // output reads the rows it wrote.
      if (own !== undefined && !p.replaced)
        append(source, read(p.source, own, `${p.path}.${name}`));
      append(values, read(p.rows, drawn, `${p.path}.${name}`));
    }
    if (axis === 'y' && p.band !== undefined)
      append(
        values,
        p.band.flatMap((r) => [r[LO] ?? null, r[HI] ?? null]),
      );
    // Areas and bars grow from zero unless they name where they start.
    if (axis === 'y' && p.mark.mark === 'area' && channel(p, 'y0') === undefined) zero = true;
    if (axis === 'y' && p.mark.mark === 'density' && isOneDimensional(p.mark)) zero = true;
    // A rect without a start edge grows from the baseline, as bars do.
    if (
      p.mark.mark === 'rect' &&
      channel(p, axis === 'x' ? 'x1' : 'y1') === undefined &&
      channel(p, axis === 'x' ? 'x2' : 'y2') !== undefined
    )
      zero = true;
    if (p.mark.mark === 'bar' && channel(p, 'y0') === undefined && channel(p, 'x0') === undefined)
      zero = true;
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
  const usedByBar = prepared.some((p) => ['bar', 'cell', 'box', 'violin'].includes(p.mark.mark));
  if (values.length === 0 && spec.domain === undefined && !usedByBar) return null;
  const type = spec.type ?? inferType(source.length > 0 ? source : values, axis);
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

/** The parameters an inverse needs beyond the domain and range. */
const scaleParameters = (scale: AxisScale) =>
  scale.type === 'pow'
    ? { exponent: scale.exponent }
    : scale.type === 'symlog'
      ? { constant: scale.constant ?? 1 }
      : {};

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
  const shown = info.spec.axis ?? true;
  const grid = shown && (info.spec.grid ?? info.type !== 'band');
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
    // Label every k-th band when labels would collide, estimating ~6.5px a character.
    const widest = domain.reduce((most, value) => Math.max(most, value.length), 1);
    const every =
      axis === 'x'
        ? Math.max(1, Math.ceil((widest * 6.5 + 8) / scale.step))
        : Math.max(1, Math.ceil(16 / scale.step));
    const ticks: ReadonlyArray<PlotTick> = domain.map((value, i) => ({
      value,
      position: place(value) ?? 0,
      label: shown && i % every === 0 ? value : '',
    }));
    return {
      axis: { type: 'band', orientation, domain, label: info.label, ticks, grid, range },
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
  // Unless the spec says, aim for a tick every ~90px across and ~50px down.
  const span = axis === 'x' ? bounds.width / 90 : bounds.height / 50;
  const count = info.spec.ticks ?? Math.max(2, Math.min(10, Math.round(span)));
  if (!(Number.isInteger(count) && count >= 2))
    fail(`${axis}.ticks`, 'must be an integer of at least two');
  const ticks = axisTicks(domain, project, count, scale).map((t) => ({
    value: t.value,
    position: t.position,
    label: shown ? (t.label ?? String(t.value)) : '',
  }));
  const lo = Math.min(...domain),
    hi = Math.max(...domain);
  const baseline = lo <= 0 && hi >= 0 && info.type !== 'log' ? project(0) : project(lo);
  return {
    axis: {
      type: info.type,
      orientation,
      domain,
      label: info.label,
      ticks,
      grid,
      range,
      ...scaleParameters(scale),
    },
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

const COLOR_CHANNELS = ['fill', 'stroke'] as const;

function resolveColor(
  prepared: ReadonlyArray<Prepared>,
  spec: ColorScaleSpec = {},
): ColorScale | null {
  const values: Value[] = [];
  const fields = new Set<string>();
  for (const p of prepared) {
    // Sankey nodes and chord groups take categorical colours by name.
    if (p.mark.mark === 'sankey' || p.mark.mark === 'chord') {
      fields.add('node');
      values.push(
        ...read(p.source, p.mark.source, `${p.path}.source`).map((v) =>
          v === null ? null : String(v),
        ),
        ...read(p.source, p.mark.target, `${p.path}.target`).map((v) =>
          v === null ? null : String(v),
        ),
      );
    }
    for (const name of COLOR_CHANNELS) {
      const field = fieldOf(channelOf(p.mark, name));
      if (field === undefined) continue;
      fields.add(field);
      append(values, read(p.replaced ? p.rows : p.source, field, `${p.path}.${name}`));
    }
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
  if (spec.range !== undefined && spec.range.length === 0)
    fail('color.range', 'needs at least one colour');
  if (type === 'categorical') {
    const palette = spec.range ?? scheme;
    const domain =
      spec.domain === undefined ? [...new Set(present.map(String))] : spec.domain.map(String);
    const paint = (v: Value) =>
      palette[Math.max(0, domain.indexOf(String(v))) % palette.length] ?? 'currentColor';
    return {
      paint,
      fields: [...fields],
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
  const span = spanOf(numbers);
  const lo = explicit?.[0] ?? span?.[0] ?? 0;
  const hi = explicit?.[1] ?? span?.[1] ?? 1;
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
    fields: [...fields],
    legend: showLegend ? { kind: 'continuous', label, domain: [lo, hi], stops } : null,
  };
}

const isSymbol = (value: unknown): value is SymbolType =>
  SYMBOLS_FILL.some((symbol) => symbol === value);

/** Symbols for dot marks' symbol fields, in order of appearance unless the spec says. */
function resolveSymbol(prepared: ReadonlyArray<Prepared>, spec: PlotSpec): SymbolScale | null {
  const values: Value[] = [];
  const fields = new Set<string>();
  for (const p of prepared) {
    const field = p.mark.mark === 'dot' ? fieldOf(p.mark.symbol) : undefined;
    if (field === undefined) continue;
    fields.add(field);
    append(values, read(p.source, field, `${p.path}.symbol`));
  }
  if (fields.size === 0) return null;
  const options = spec.symbol ?? {};
  const range = options.range ?? SYMBOLS_FILL;
  if (range.length === 0) fail('symbol.range', 'needs at least one symbol');
  range.forEach((symbol, i) => {
    if (!isSymbol(symbol)) fail(`symbol.range[${i}]`, `unknown symbol "${String(symbol)}"`);
  });
  const domain = options.domain ?? [...new Set(values.filter((v) => v !== null).map(String))];
  const symbolOf = (v: Value): SymbolType =>
    range[Math.max(0, domain.indexOf(String(v))) % range.length] ?? 'circle';
  const label = options.label ?? (fields.size === 1 ? ([...fields][0] ?? '') : '');
  return {
    symbolOf,
    fields: [...fields],
    legend:
      (options.legend ?? true)
        ? {
            kind: 'symbol',
            label,
            entries: domain.map((key) => ({
              key,
              label: key,
              symbol: symbolOf(key),
              path: symbolPath(symbolOf(key), 64),
            })),
          }
        : null,
  };
}

/**
 * The plot's legends. A categorical colour and a symbol that encode the same
 * single field share one legend: each symbol entry carries its colour.
 */
function legendsOf(color: ColorScale | null, symbol: SymbolScale | null): ReadonlyArray<Legend> {
  const colour = color?.legend ?? null;
  const glyphs = symbol?.legend ?? null;
  const sameField =
    color !== null &&
    symbol !== null &&
    color.fields.length === 1 &&
    symbol.fields.length === 1 &&
    color.fields[0] === symbol.fields[0];
  if (sameField && colour?.kind === 'categorical' && glyphs?.kind === 'symbol')
    return [
      {
        ...glyphs,
        entries: glyphs.entries.map((entry) => ({ ...entry, color: color.paint(entry.key) })),
      },
    ];
  return [colour, glyphs].filter((legend): legend is Legend => legend !== null);
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
  const max = Math.max(0, spanOf(values)?.[1] ?? 0);
  const scale = sqrt({ domain: [0, max || 1], range: [range[0], range[1]] });
  return (v) => {
    const n = numeric(v);
    return Number.isFinite(n) && n >= 0 ? scale(n) : range[0];
  };
}

// ── Mark geometry ─────────────────────────────────────────────────────────────

/** Many dots as one packed graphic: typed positions, palette indices and row indices. */
function packPoints(
  key: string,
  xs: ReadonlyArray<Value>,
  ys: ReadonlyArray<Value>,
  x: PositionScale,
  y: PositionScale,
  fills: ReadonlyArray<string>,
  radii: ReadonlyArray<number>,
  uniformRadius: boolean,
  opacity: number,
  dims: ReadonlyArray<number> | undefined,
  origin: ReadonlyArray<number> | undefined,
): Graphic {
  const n = xs.length;
  const px = new Float64Array(n),
    py = new Float64Array(n),
    rows = new Uint32Array(n),
    paint = new Uint16Array(n),
    dimmed = dims === undefined ? undefined : new Uint8Array(n);
  const radius = uniformRadius ? (radii[0] ?? 3) : new Float64Array(n);
  const palette: string[] = [];
  const paletteIndex = new Map<string, number>();
  let count = 0;
  for (let i = 0; i < n; i += 1) {
    const cx = x.place(xs[i] ?? null),
      cy = y.place(ys[i] ?? null);
    if (cx === undefined || cy === undefined) continue;
    const fill = fills[i] ?? 'currentColor';
    let colour = paletteIndex.get(fill);
    if (colour === undefined) {
      colour = palette.length;
      palette.push(fill);
      paletteIndex.set(fill, colour);
    }
    px[count] = cx;
    py[count] = cy;
    rows[count] = origin?.[i] ?? i;
    paint[count] = colour;
    if (dimmed !== undefined) dimmed[count] = (dims?.[i] ?? 1) < 1 ? 1 : 0;
    if (radius instanceof Float64Array) radius[count] = radii[i] ?? 3;
    count += 1;
  }
  const packed: Graphic = {
    kind: 'points',
    key,
    count,
    xs: px.subarray(0, count),
    ys: py.subarray(0, count),
    radius: radius instanceof Float64Array ? radius.subarray(0, count) : radius,
    palette,
    paint: paint.subarray(0, count),
    rows: rows.subarray(0, count),
    opacity,
  };
  return dimmed === undefined ? packed : { ...packed, dimmed: dimmed.subarray(0, count) };
}

/**
 * A dense dot mark packed into typed arrays. It reads its channels through the
 * column-aware readers and never builds rows, so a column table stays columns.
 * Dense marks carry no per-row keys or titles.
 */
function denseDots(p: Prepared, mark: DotMark, context: Context): Graphic {
  const { rows, path, index } = p;
  const x = requireScale(context.x, path, 'x'),
    y = requireScale(context.y, path, 'y');
  const xs = read(rows, channel(p, 'x') ?? mark.x, `${path}.x`),
    ys = read(rows, channel(p, 'y') ?? mark.y, `${path}.y`);
  const fills = paintOf(
    rows,
    mark.fill,
    `${path}.fill`,
    context,
    mark.stroke === undefined ? 'currentColor' : 'none',
  );
  // Packed points draw no stroke; a stroke field is still checked against the data.
  if (mark.stroke !== undefined) paintOf(rows, mark.stroke, `${path}.stroke`, context, 'none');
  const radii =
    mark.r === undefined
      ? fillRows(rows, 3)
      : read(rows, mark.r, `${path}.r`).map((v) =>
          isConstant(mark.r) ? numeric(v) : context.size(v),
        );
  return packPoints(
    `${index}:points`,
    xs,
    ys,
    x,
    y,
    fills,
    radii,
    mark.r === undefined || isConstant(mark.r),
    mark.opacity ?? 1,
    mark.highlight === undefined ? undefined : highlightFactors(rows, mark.highlight, path),
    p.origin,
  );
}

function markGraphics(p: Prepared, context: Context): ReadonlyArray<Graphic> {
  const { mark, path, index } = p;
  if (mark.mark === 'dot' && mark.dense === true) return [denseDots(p, mark, context)];
  // Every other mark works on row objects; a column table builds them once.
  const rows = rowsOf(p.rows);
  const opacity = mark.opacity ?? 1;
  const keys = keysOf(rows, mark, index);
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  const dims = highlightFactors(rows, mark.highlight, path);
  switch (mark.mark) {
    case 'dot': {
      const x = requireScale(context.x, path, 'x'),
        y = requireScale(context.y, path, 'y');
      const xs = read(rows, channel(p, 'x') ?? mark.x, `${path}.x`),
        ys = read(rows, channel(p, 'y') ?? mark.y, `${path}.y`);
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
      // validateMark has checked that a constant symbol names a known symbol.
      const glyphs =
        mark.symbol === undefined
          ? undefined
          : read(rows, mark.symbol, `${path}.symbol`).map(
              (v): SymbolType =>
                isConstant(mark.symbol)
                  ? isSymbol(v)
                    ? v
                    : 'circle'
                  : (context.symbol?.symbolOf(v) ?? 'circle'),
            );
      return rows.flatMap((_, i): ReadonlyArray<Graphic> => {
        const cx = x.place(xs[i] ?? null),
          cy = y.place(ys[i] ?? null);
        if (cx === undefined || cy === undefined) return [];
        const glyph = glyphs?.[i] ?? 'circle';
        const r = radii[i] ?? 3;
        if (glyph !== 'circle')
          return [
            {
              kind: 'path',
              key: keys[i] ?? `${index}:${i}`,
              d: symbolPath(glyph, Math.PI * r * r),
              translate: [cx, cy],
              fill: fills[i] ?? 'currentColor',
              stroke: strokes[i] ?? 'none',
              strokeWidth: mark.strokeWidth ?? 1,
              opacity: opacity * (dims[i] ?? 1),
              ...withTitle(titles[i]),
            },
          ];
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
            opacity: opacity * (dims[i] ?? 1),
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
        const xs = read(series, channel(p, 'x') ?? mark.x, `${path}.x`),
          ys = read(series, channel(p, 'y') ?? mark.y, `${path}.y`);
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
        // A highlight dims a line or area as a whole: lit when any of its rows matches.
        const lit =
          mark.highlight === undefined
            ? 1
            : Math.max(...highlightFactors(series, mark.highlight, path));
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
              opacity: opacity * lit,
              ...withTitle(title),
            });
        } else {
          const finite = points.filter((pt) => pt.every(Number.isFinite));
          const start = channel(p, 'y0');
          const baseline =
            start === undefined
              ? y.baseline
              : read(series, start, `${path}.y0`)
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
              opacity: (mark.opacity ?? 0.8) * lit,
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
      const xs = read(rows, channel(p, 'x') ?? mark.x, `${path}.x`),
        ys = read(rows, channel(p, 'y') ?? mark.y, `${path}.y`);
      // Interval and stacked bars start where y0 (or x0) says; others start at zero.
      const from = channel(p, vertical ? 'y0' : 'x0');
      const starts =
        from === undefined ? undefined : read(rows, from, `${path}.${vertical ? 'y0' : 'x0'}`);
      const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'currentColor');
      const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'none');
      const category = vertical ? x : y,
        value = vertical ? y : x;
      // Grouped bars split each band between the series, in the order they first appear.
      const groupField = mark.group === true ? seriesFieldOf(mark) : undefined;
      const groups =
        groupField === undefined ? [] : read(rows, groupField, `${path}.z`).map(String);
      const series = [...new Set(groups)];
      const thickness = category.bandwidth / Math.max(1, series.length);
      return rows.flatMap((_, i) => {
        const offset = groupField === undefined ? 0 : series.indexOf(groups[i] ?? '') * thickness;
        const band = category.start(vertical ? (xs[i] ?? null) : (ys[i] ?? null));
        const start = band === undefined ? undefined : band + offset;
        const end = value.place(vertical ? (ys[i] ?? null) : (xs[i] ?? null));
        const base = starts === undefined ? value.baseline : value.place(starts[i] ?? null);
        if (start === undefined || end === undefined || base === undefined) return [];
        const lo = Math.min(end, base),
          extent = Math.abs(end - base);
        const rect = vertical
          ? { x: start, y: lo, width: thickness, height: extent }
          : { x: lo, y: start, width: extent, height: thickness };
        return [
          {
            kind: 'rect' as const,
            key: keys[i] ?? `${index}:${i}`,
            ...rect,
            fill: fills[i] ?? 'currentColor',
            stroke: strokes[i] ?? 'none',
            opacity: opacity * (dims[i] ?? 1),
            ...withTitle(titles[i]),
          },
        ];
      });
    }
    case 'box':
      return boxGraphics(mark, rows, path, context);
    case 'violin':
      return violinGraphics(mark, rows, path, context);
    case 'link':
      return linkGraphics(mark, rows, path, index, context);
    case 'density':
      return densityGraphics(mark, rows, path, context);
    case 'rect':
      return rectGraphics(mark, rows, path, index, context, (name) => channel(p, name));
    case 'arc':
      return arcGraphics(mark, rows, path, index, context);
    case 'geo':
    case 'graticule':
      return fail(path, `a ${mark.mark} mark needs the plot to have a projection`);
    case 'tree':
      return treeGraphics(mark, rows, path, context);
    case 'pack':
      return packGraphics(mark, rows, path, context);
    case 'chord':
      return chordGraphics(mark, rows, path, context);
    case 'arc-diagram':
      return arcDiagramGraphics(mark, rows, path, context);
    case 'force':
      return forceGraphics(mark, rows, path, context);
    case 'voronoi':
      return voronoiGraphics(mark, rows, path, index, context);
    case 'treemap':
      return treemapGraphics(mark, rows, path, context);
    case 'sunburst':
      return sunburstGraphics(mark, rows, path, context);
    case 'sankey':
      return sankeyGraphics(mark, rows, path, context);
    case 'parallel':
      return parallelGraphics(mark, rows, path, index, context);
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
            opacity: opacity * (dims[i] ?? 1),
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
            opacity: opacity * (dims[i] ?? 1),
            ...withTitle(titles[i]),
          },
        ];
      });
    }
  }
}

// ── Compile ───────────────────────────────────────────────────────────────────

/** Marks that fill their panel, whatever the plot's coordinates. */
const PANEL_MARKS: ReadonlySet<MarkType> = new Set([
  'arc',
  'tree',
  'pack',
  'chord',
  'arc-diagram',
  'force',
  'treemap',
  'sunburst',
  'sankey',
  'parallel',
]);

function validateSpec(spec: PlotSpec): void {
  const coordinates: unknown = spec.coordinates ?? 'cartesian';
  if (coordinates !== 'cartesian' && coordinates !== 'polar')
    fail(
      'coordinates',
      `unknown coordinates "${String(coordinates)}"; expected cartesian or polar`,
    );
  validateProjection(spec);
  if (!(Number.isFinite(spec.width) && spec.width > 0))
    fail('width', 'must be finite and positive');
  if (!(Number.isFinite(spec.height) && spec.height > 0))
    fail('height', 'must be finite and positive');
  if (!Array.isArray(spec.marks) || spec.marks.length === 0)
    fail('marks', 'a plot needs at least one mark');
  spec.marks.forEach((mark, i) => {
    if ((mark.mark === 'geo' || mark.mark === 'graticule') && spec.projection === undefined)
      fail(`marks[${i}]`, `a ${mark.mark} mark needs the plot to have a projection`);
  });
  spec.marks.forEach((mark, i) => validateMark(mark, `marks[${i}]`));
}

function markRows(spec: PlotSpec, mark: MarkSpec, path: string): Rows {
  if (mark.mark === 'geo') return geoRows(mark);
  if (mark.data !== undefined) return dataOf(mark.data, `${path}.data`);
  // A mark of constants alone, such as a reference rule, draws once even when
  // the plot has data for its other marks.
  const usesFields =
    mark.mark === 'parallel' ||
    MARKS[mark.mark].channels.some((name) => fieldOf(channelOf(mark, name)) !== undefined) ||
    mark.highlight !== undefined;
  if (!usesFields) return [{}];
  if (spec.data === undefined)
    return fail(`${path}.data`, 'no data: give the mark or the plot rows');
  return dataOf(spec.data, 'data');
}

/** Data as given: an array of rows, or a column table. */
function dataOf(data: PlotData, path: string): Rows {
  if (Array.isArray(data) || isColumnTable(data)) return data;
  return fail(path, 'must be an array of rows or a column table');
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
      // A dense mark's packed points name rows in the mark's full data, so
      // highlightPoints can restyle them from that data alone.
      const initial: Prepared = {
        mark,
        index,
        path,
        source: facetRows,
        rows: facetRows,
        channels: {},
        replaced: false,
        labels: {},
      };
      const start =
        mark.mark === 'dot' && mark.dense === true && facetRows !== rows
          ? { ...initial, origin: originOf(rows, facetRows) }
          : initial;
      const steps = transformsOf(mark);
      const many = Array.isArray('transform' in mark ? mark.transform : undefined);
      const transformed = steps.reduce<Prepared>((state, step, i) => {
        const result = applyTransform(
          mark,
          step,
          rowsOf(state.rows),
          `${path}.transform${many ? `[${i}]` : ''}`,
          cell.bounds.width,
          channel(state, 'x'),
          channel(state, 'y'),
        );
        const band = result.band ?? state.band;
        const next: Prepared = {
          ...state,
          rows: result.rows,
          channels: { ...state.channels, x: result.x, y: result.y },
        };
        return band === undefined ? next : { ...next, band };
      }, start);
      return derive(transformed, spec);
    }),
  );
  const all = perFacet.flat();
  // A projected plot places marks by longitude and latitude, without x and y scales.
  const projected = spec.projection !== undefined;
  const xInfo = projected ? null : resolveScale(all, 'x', spec.x);
  const yInfo = projected ? null : resolveScale(all, 'y', spec.y);
  const color = resolveColor(all, spec.color);
  const symbol = resolveSymbol(all, spec);
  const size = resolveSize(all, spec);

  const facets: ReadonlyArray<FacetGeometry> = cells.map((cell, f) => {
    const frame = spec.coordinates === 'polar' ? polarFrame(cell.bounds, spec) : null;
    const polar = frame === null ? null : polarScales(xInfo, yInfo, frame);
    const x =
      polar !== null ? polar.x : xInfo === null ? null : buildScale(xInfo, 'x', cell.bounds, spec);
    const y =
      polar !== null ? polar.y : yInfo === null ? null : buildScale(yInfo, 'y', cell.bounds, spec);
    const context: Context = { x, y, color, symbol, size, bounds: cell.bounds };
    const project = fitProjection(spec, cell.bounds);
    const drawn = (p: Prepared): ReadonlyArray<Graphic> => {
      const { mark } = p;
      const reader = (name: ChannelName) => channel(p, name);
      if (PANEL_MARKS.has(mark.mark)) return markGraphics(p, context);
      if (project !== null) {
        if (mark.mark === 'geo')
          return geoGraphics(mark, rowsOf(p.rows), p.path, p.index, context, project);
        if (mark.mark === 'graticule')
          return graticuleGraphics(mark, p.path, p.index, context, project);
        return projectedGraphics(mark, rowsOf(p.rows), p.path, p.index, context, project, reader);
      }
      if (frame !== null)
        return polarGraphics(mark, rowsOf(p.rows), p.path, p.index, context, frame, reader);
      return markGraphics(p, context);
    };
    const marks: ReadonlyArray<MarkGeometry> = (perFacet[f] ?? []).map((p) => ({
      mark: p.mark.mark,
      index: p.index,
      graphics: drawn(p),
    }));
    return {
      key: cell.key,
      label: cell.label,
      plot: cell.bounds,
      x: polar === null ? (x?.axis ?? null) : null,
      y: polar === null ? (y?.axis ?? null) : null,
      polar: polar?.geometry ?? null,
      marks,
    };
  });

  return {
    width: spec.width,
    height: spec.height,
    title: spec.title ?? '',
    description: spec.description ?? '',
    facets,
    legends: legendsOf(color, symbol),
    clip: spec.clip ?? false,
  };
}
