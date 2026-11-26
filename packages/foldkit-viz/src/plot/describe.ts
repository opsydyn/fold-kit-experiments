import { channelOf, fieldOf, isConstant, isNumber } from './channels.js';
import type { AxisName, ChannelName } from './channels.js';
import { isColumnTable } from './columns.js';
import { plotValueFormatter } from './format.js';
import { geoRows } from './geo.js';
import { binDescriptor } from './marks-rect.js';
import type {
  Legend,
  MarkGeometry,
  MarkSpec,
  PlotAxis,
  PlotGeometry,
  PlotSpec,
  PrebinnedRect,
  RectMark,
  Value,
} from './types.js';

/**
 * Accessible projections of a plot, framework-free: a plain-language summary
 * of compiled geometry for screen readers, and the data a spec plots as a
 * table, so every value a chart draws can be read without seeing it.
 */

// ── Summary ───────────────────────────────────────────────────────────────────

/** What each mark draws, singular and plural, for the summary. */
const NOUNS = new Map<MarkGeometry['mark'], readonly [string, string]>([
  ['dot', ['point', 'points']],
  ['line', ['line', 'lines']],
  ['area', ['area', 'areas']],
  ['bar', ['bar', 'bars']],
  ['rect', ['bar', 'bars']],
  ['cell', ['cell', 'cells']],
  ['rule', ['rule', 'rules']],
  ['text', ['label', 'labels']],
  ['arc', ['slice', 'slices']],
  ['geo', ['shape', 'shapes']],
  ['voronoi', ['cell', 'cells']],
  ['box', ['box', 'boxes']],
  ['violin', ['violin', 'violins']],
  ['density', ['curve', 'curves']],
]);

const plural = (count: number, [one, many]: readonly [string, string]): string =>
  `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;

/** A readable number: whole numbers grouped, others to four significant figures. */
export const readable = (value: number | string): string =>
  isNumber(value)
    ? Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : Number(value.toPrecision(4)).toLocaleString('en-US')
    : value;

function axisPhrase(name: string, axis: PlotAxis | null): string | undefined {
  if (axis === null) return undefined;
  const label = axis.label === '' ? name : axis.label;
  const format = axis.format === undefined ? undefined : plotValueFormatter(axis.format);
  // A few categories are named in axis order, as a legend's groups are, so the order
  // can be checked without seeing the chart.
  if (axis.type === 'band') {
    const named =
      axis.domain.length <= 6 ? `: ${axis.domain.map(format ?? readable).join(', ')}` : '';
    return `${label} in ${plural(axis.domain.length, ['category', 'categories'])}${named}`;
  }
  const [lo = 0, hi = 0] = axis.domain;
  if (format !== undefined)
    return `${label} from ${format(lo)} to ${format(hi)}${axis.type === 'log' ? ' on a log scale' : ''}`;
  if (axis.type === 'time')
    return `${label} from ${new Date(Number(lo)).toISOString().slice(0, 10)} to ${new Date(Number(hi)).toISOString().slice(0, 10)}`;
  return `${label} from ${readable(lo)} to ${readable(hi)}${axis.type === 'log' ? ' on a log scale' : ''}`;
}

/**
 * Every colour the plot paints, or undefined when it cannot say (packed points paint
 * from a palette per point, so every colour counts as drawn).
 */
function paintedColours(geometry: PlotGeometry): ReadonlySet<string> | undefined {
  const colours = new Set<string>();
  for (const facet of geometry.facets)
    for (const mark of facet.marks)
      for (const g of mark.graphics) {
        if (g.kind === 'points') return undefined;
        if (g.kind !== 'line') colours.add(g.fill);
        if (g.kind !== 'text') colours.add(g.stroke);
      }
  return colours;
}

function legendPhrase(legend: Legend, painted: ReadonlySet<string> | undefined): string {
  const label = legend.label === '' ? 'colour' : legend.label;
  if (legend.kind === 'continuous')
    return `colour shows ${label} from ${readable(legend.domain[0])} to ${readable(legend.domain[1])}`;
  const shown = legend.kind === 'symbol' ? 'symbol' : 'colour';
  const names = legend.entries.map((e) => e.label);
  // A legend with a fixed domain names groups a filter left out: say which are drawn, so
  // a reader is not told of five lines when one is shown.
  const drawn =
    legend.kind === 'categorical' && painted !== undefined
      ? legend.entries.filter((e) => painted.has(e.color)).map((e) => e.label)
      : names;
  if (drawn.length > 0 && drawn.length < names.length) {
    const listed = drawn.length <= 6 ? `: ${drawn.join(', ')}` : '';
    return `${shown} shows ${label} (${drawn.length} of ${plural(names.length, ['group', 'groups'])} drawn${listed})`;
  }
  const listed = names.length <= 6 ? `: ${names.join(', ')}` : '';
  return `${shown} shows ${label} (${plural(names.length, ['group', 'groups'])}${listed})`;
}

/** Whether a graphic of `kind` is one of what `mark` draws, rather than a part of one. */
const countsAsOne = (mark: MarkGeometry['mark'], kind: string): boolean =>
  mark === 'box' ? kind === 'rect' : mark === 'violin' ? kind === 'path' : true;

/**
 * A plain-language summary of a compiled plot: what it draws and how many,
 * what each axis covers, and what colour shows. Meant for an SVG's desc or an
 * aria-describedby target.
 */
export function describePlot(geometry: PlotGeometry): string {
  const [facet] = geometry.facets;
  if (facet === undefined) return 'An empty chart.';
  const counts = new Map<string, number>();
  for (const f of geometry.facets)
    for (const mark of f.marks) {
      const noun = NOUNS.get(mark.mark);
      const key = noun === undefined ? `${mark.mark} mark` : noun[1];
      // Packed points count every point, not their one graphic; a box or violin is
      // several graphics (whisker, box and median; shape and median) but one of each.
      const drawn = mark.graphics.reduce(
        (sum, g) => sum + (g.kind === 'points' ? g.count : countsAsOne(mark.mark, g.kind) ? 1 : 0),
        0,
      );
      counts.set(key, (counts.get(key) ?? 0) + drawn);
    }
  const drawn = [...counts]
    .filter(([, count]) => count > 0)
    .map(([noun, count]) => {
      const pair = [...NOUNS.values()].find((n) => n[1] === noun) ?? [noun, noun];
      return plural(count, pair);
    });
  const sentences: string[] = [];
  if (drawn.length > 0)
    sentences.push(
      `Shows ${drawn.join(', ')}${geometry.facets.length > 1 ? ` across ${geometry.facets.length} panels` : ''}.`,
    );
  const axes = [axisPhrase('x', facet.x), axisPhrase('y', facet.y)].filter(
    (phrase): phrase is string => phrase !== undefined,
  );
  if (facet.polar !== null) {
    const angles = facet.polar.angles.length;
    if (angles > 0) axes.push(`${plural(angles, ['direction', 'directions'])} round the circle`);
    if (facet.polar.label !== '') axes.push(`radius shows ${facet.polar.label}`);
  }
  if (axes.length > 0) sentences.push(`${capitalise(axes.join('; '))}.`);
  const painted = paintedColours(geometry);
  for (const legend of geometry.legends)
    sentences.push(`${capitalise(legendPhrase(legend, painted))}.`);
  return sentences.join(' ');
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

// ── Table ─────────────────────────────────────────────────────────────────────

export type PlotTable = Readonly<{
  caption: string;
  headers: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<string>>;
  /** How many rows the data has; more than `rows.length` when the table is cut short. */
  total: number;
}>;

/** The channels a table reads, in the order readers expect them. */
const TABLE_CHANNELS: ReadonlyArray<ChannelName> = [
  'title',
  'path',
  'source',
  'target',
  'x',
  'x1',
  'x0',
  'x2',
  'y',
  'y1',
  'y0',
  'y2',
  'value',
  'text',
  'fill',
  'stroke',
  'symbol',
  'r',
];

/**
 * A column's heading: the label of the scale its field is plotted on (`x` or `y` for
 * positions, `color` for fill and stroke), when the spec gives one; else the field.
 */
function headingOf(spec: PlotSpec, field: string, channel: ChannelName): string {
  const scale = channel.startsWith('x')
    ? spec.x
    : channel.startsWith('y')
      ? spec.y
      : channel === 'fill' || channel === 'stroke'
        ? spec.color
        : undefined;
  const label = scale?.label ?? '';
  return label === '' ? field : label;
}

const cell = (value: Value | undefined): string =>
  value === null || value === undefined ? '' : isNumber(value) ? readable(value) : String(value);

type TableColumn = Readonly<{ heading: string; field: string; axis?: AxisName }>;
type TableOptions = Readonly<{ limit?: number }>;

function sourceColumns(spec: PlotSpec, mark: MarkSpec): ReadonlyArray<TableColumn> {
  const fields = new Map<string, TableColumn>();
  for (const name of TABLE_CHANNELS) {
    const field = fieldOf(channelOf(mark, name));
    if (field === undefined) continue;
    const axis = name.startsWith('x') ? 'x' : name.startsWith('y') ? 'y' : undefined;
    const existing = fields.get(field);
    if (existing === undefined)
      fields.set(field, { heading: headingOf(spec, field, name), field, axis });
    else if (existing.axis === undefined && axis !== undefined)
      fields.set(field, { ...existing, axis });
  }
  if (mark.mark === 'parallel')
    for (const field of mark.dimensions)
      if (!fields.has(field)) fields.set(field, { heading: field, field });
  return [...fields.values()];
}

const rowLimit = (options: TableOptions): number => Math.max(1, Math.floor(options.limit ?? 200));

function axisCell(spec: PlotSpec, axis: AxisName) {
  const format = spec[axis]?.format;
  return format === undefined ? cell : plotValueFormatter(format, `${axis}.format`);
}

function sourceTable(
  spec: PlotSpec,
  mark: MarkSpec,
  columns: ReadonlyArray<TableColumn>,
  caption: string,
  limit: number,
): PlotTable {
  const data = mark.mark === 'geo' ? geoRows(mark) : (mark.data ?? spec.data ?? []);
  const total = data.length;
  const valueAt = (field: string, row: number) =>
    isColumnTable(data) ? data.columns[field]?.[row] : data[row]?.[field];
  const format = { x: axisCell(spec, 'x'), y: axisCell(spec, 'y') };
  return {
    caption,
    headers: columns.map(({ heading }) => heading),
    rows: Array.from({ length: Math.min(limit, total) }, (_, row) =>
      columns.map(({ axis, field }) =>
        (axis === undefined ? cell : format[axis])(valueAt(field, row)),
      ),
    ),
    total,
  };
}

/**
 * The data a spec plots, as a table: the first mark that reads fields, with a
 * column for each field it reads (headed by its axis or colour label when the
 * spec gives one), in a reading order (title first, then
 * positions, then values and colours). At most `limit` rows (default 200);
 * `total` says how many there are.
 */
export function plotTable(spec: PlotSpec, options: TableOptions = {}): PlotTable {
  const caption = spec.title ?? 'Chart data';
  for (const mark of spec.marks) {
    const columns = sourceColumns(spec, mark);
    if (columns.length > 0) return sourceTable(spec, mark, columns, caption, rowLimit(options));
  }
  return { caption, headers: [], rows: [], total: 0 };
}

function binTable(
  spec: PlotSpec,
  geometry: PlotGeometry,
  mark: RectMark,
  descriptor: PrebinnedRect,
  index: number,
  caption: string,
  limit: number,
): PlotTable {
  const x = spec.x?.label || descriptor.xField || 'X';
  const y = spec.y?.label || descriptor.yField || 'Y';
  const twoDimensions = mark.y !== undefined || mark.y1 !== undefined;
  const { series } = descriptor;
  const valueLabel = !twoDimensions ? spec.y?.label : undefined;
  const faceted = spec.facet !== undefined;
  const formatX = axisCell(spec, 'x');
  const formatY = axisCell(spec, 'y');
  const headers = [
    ...(faceted ? ['Panel'] : []),
    ...(series === undefined ? [] : [series]),
    `${x} start`,
    `${x} end`,
    ...(twoDimensions ? [`${y} start`, `${y} end`] : []),
    valueLabel && valueLabel !== descriptor.value ? valueLabel : capitalise(descriptor.value),
  ];
  const rows: string[][] = [];
  let total = 0;
  for (const facet of geometry.facets) {
    const layer = facet.marks.find((candidate) => candidate.index === index);
    for (const graphic of layer?.graphics ?? []) {
      if (graphic.kind !== 'rect' || graphic.bin === undefined) continue;
      const bin = graphic.bin;
      if (total < limit)
        rows.push([
          ...(faceted ? [facet.label] : []),
          ...(series === undefined ? [] : [cell(bin.series)]),
          ...bin.x.map(formatX),
          ...(bin.y?.map(formatY) ?? []),
          (bin.y === undefined ? formatY : cell)(bin.value),
        ]);
      total += 1;
    }
  }
  return { caption, headers, rows, total };
}

/** Accessible tables in layer order, using the geometry compiled from this spec for bins. */
export function plotTables(
  spec: PlotSpec,
  geometry: PlotGeometry,
  options: TableOptions = {},
): ReadonlyArray<PlotTable> {
  const limit = rowLimit(options);
  const title = spec.title ?? 'Chart data';
  return spec.marks.flatMap((mark, index): ReadonlyArray<PlotTable> => {
    const caption = `${title} (layer ${index + 1})`;
    const descriptor = mark.mark === 'rect' ? binDescriptor(mark) : undefined;
    if (mark.mark === 'rect' && descriptor !== undefined) {
      const binCaption =
        spec.marks.length === 1 ? (spec.title ?? 'Histogram bins') : `${caption} · Bins`;
      return [binTable(spec, geometry, mark, descriptor, index, binCaption, limit)];
    }
    const columns = sourceColumns(spec, mark);
    if (mark.mark === 'rule') {
      const axis = mark.x === undefined ? 'y' : 'x';
      const channel = mark[axis];
      if (isConstant(channel))
        return [
          {
            caption: `${caption} · Reference rule`,
            headers: [spec[axis]?.label || axis],
            rows: [[axisCell(spec, axis)(channel.value)]],
            total: 1,
          },
        ];
    }
    if (columns.length === 0) return [];
    const counts = new Map<string, number>();
    for (const { heading } of columns) counts.set(heading, (counts.get(heading) ?? 0) + 1);
    const headings = columns.map((column) => ({
      ...column,
      heading:
        counts.get(column.heading) === 1 ? column.heading : `${column.heading} (${column.field})`,
    }));
    const sourceCaption =
      spec.marks.length === 1 && !('transform' in mark)
        ? title
        : `${caption} · ${capitalise(mark.mark)} source data`;
    return [sourceTable(spec, mark, headings, sourceCaption, limit)];
  });
}
