import { channelOf, fieldOf, isNumber } from './channels.js';
import type { ChannelName } from './channels.js';
import { geoRows } from './geo.js';
import type {
  Legend,
  MarkGeometry,
  MarkSpec,
  PlotAxis,
  PlotGeometry,
  PlotSpec,
  Row,
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
const readable = (value: number | string): string =>
  isNumber(value)
    ? Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : Number(value.toPrecision(4)).toLocaleString('en-US')
    : value;

function axisPhrase(name: string, axis: PlotAxis | null): string | undefined {
  if (axis === null) return undefined;
  const label = axis.label === '' ? name : axis.label;
  if (axis.type === 'band')
    return `${label} in ${plural(axis.domain.length, ['category', 'categories'])}`;
  const [lo = 0, hi = 0] = axis.domain;
  if (axis.type === 'time')
    return `${label} from ${new Date(Number(lo)).toISOString().slice(0, 10)} to ${new Date(Number(hi)).toISOString().slice(0, 10)}`;
  return `${label} from ${readable(lo)} to ${readable(hi)}${axis.type === 'log' ? ' on a log scale' : ''}`;
}

function legendPhrase(legend: Legend): string {
  const label = legend.label === '' ? 'colour' : legend.label;
  if (legend.kind === 'continuous')
    return `colour shows ${label} from ${readable(legend.domain[0])} to ${readable(legend.domain[1])}`;
  const names = legend.entries.map((e) => e.label);
  const listed = names.length <= 6 ? `: ${names.join(', ')}` : '';
  const shown = legend.kind === 'symbol' ? 'symbol' : 'colour';
  return `${shown} shows ${label} (${plural(names.length, ['group', 'groups'])}${listed})`;
}

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
      // Packed points count every point, not their one graphic.
      const drawn = mark.graphics.reduce((sum, g) => sum + (g.kind === 'points' ? g.count : 1), 0);
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
  for (const legend of geometry.legends) sentences.push(`${capitalise(legendPhrase(legend))}.`);
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

const cell = (value: Value | undefined): string =>
  value === null || value === undefined ? '' : isNumber(value) ? readable(value) : String(value);

const rowsOf = (spec: PlotSpec, mark: MarkSpec): ReadonlyArray<Row> =>
  mark.mark === 'geo' ? geoRows(mark) : (mark.data ?? spec.data ?? []);

/**
 * The data a spec plots, as a table: the first mark that reads fields, with a
 * column for each field it reads, in a reading order (title first, then
 * positions, then values and colours). At most `limit` rows (default 200);
 * `total` says how many there are.
 */
export function plotTable(spec: PlotSpec, options: Readonly<{ limit?: number }> = {}): PlotTable {
  const caption = spec.title ?? 'Chart data';
  for (const mark of spec.marks) {
    const fields: string[] = [];
    for (const name of TABLE_CHANNELS) {
      const field = fieldOf(channelOf(mark, name));
      if (field !== undefined && !fields.includes(field)) fields.push(field);
    }
    if (mark.mark === 'parallel')
      for (const d of mark.dimensions) if (!fields.includes(d)) fields.push(d);
    if (fields.length === 0) continue;
    const rows = rowsOf(spec, mark);
    const limit = Math.max(1, Math.floor(options.limit ?? 200));
    return {
      caption,
      headers: fields,
      rows: rows.slice(0, limit).map((row) => fields.map((field) => cell(row[field]))),
      total: rows.length,
    };
  }
  return { caption, headers: [], rows: [], total: 0 };
}
