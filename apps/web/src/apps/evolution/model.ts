import { Schema } from 'effect';

import type { AppInitProps } from '../types';

export const NodeType = Schema.Literals([
  'person',
  'system',
  'externalSystem',
  'container',
  'component',
]);
export type NodeType = typeof NodeType.Type;

export const DiagramEvent = Schema.Union([
  Schema.Struct({
    time: Schema.Number,
    kind: Schema.Literal('node'),
    nodeType: NodeType,
    label: Schema.String,
  }),
  Schema.Struct({ time: Schema.Number, kind: Schema.Literal('edge'), label: Schema.String }),
]);
export type DiagramEvent = typeof DiagramEvent.Type;

/** Stepped lines show counts as they are: they change only when an element is added. */
export const Curve = Schema.Literals(['stepAfter', 'monotoneX']);
export type Curve = typeof Curve.Type;

export const Model = Schema.Struct({
  events: Schema.Array(DiagramEvent),
  highlighted: Schema.NullOr(Schema.String),
  curve: Curve,
});
export type Model = typeof Model.Type;

export type SeriesKey = NodeType | 'edges';

/** Series in drawing order, with their names. */
export const SERIES: ReadonlyArray<Readonly<{ key: SeriesKey; singular: string; plural: string }>> =
  [
    { key: 'person', singular: 'Person', plural: 'People' },
    { key: 'system', singular: 'System', plural: 'Systems' },
    { key: 'externalSystem', singular: 'External system', plural: 'External systems' },
    { key: 'container', singular: 'Container', plural: 'Containers' },
    { key: 'component', singular: 'Component', plural: 'Components' },
    { key: 'edges', singular: 'Relationship', plural: 'Relationships' },
  ];

export type EvolutionRow = Readonly<{
  key: string;
  series: SeriesKey;
  time: number;
  count: number;
}>;

const seriesOf = (event: DiagramEvent): SeriesKey =>
  event.kind === 'edge' ? 'edges' : event.nodeType;

/** Cumulative counts of every series, sampled at every event. */
export const evolutionRows = (events: ReadonlyArray<DiagramEvent>): ReadonlyArray<EvolutionRow> => {
  const counts = new Map<SeriesKey, number>(SERIES.map(({ key }) => [key, 0]));
  return events.flatMap((event, index) => {
    const changed = seriesOf(event);
    counts.set(changed, (counts.get(changed) ?? 0) + 1);
    return SERIES.map(({ key }) => ({
      key: `${key}-${index}`,
      series: key,
      time: event.time,
      count: counts.get(key) ?? 0,
    }));
  });
};

const pad = (value: number): string => String(value).padStart(2, '0');

/** Hours and minutes in UTC, so server and browser render the same text. */
export const clock = (time: number): string => {
  const date = new Date(time);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

export const eventLabel = (event: DiagramEvent | undefined): string => {
  if (event === undefined) return 'Awaiting first change';
  const name = SERIES.find(({ key }) => key === seriesOf(event))?.singular ?? 'Element';
  return `+ ${name} · ${event.label} · ${clock(event.time)} UTC`.toUpperCase();
};

const at = (hour: number, minute: number): number => Date.UTC(2026, 10, 13, hour, minute);
const node = (time: number, nodeType: NodeType, label: string): DiagramEvent => ({
  time,
  kind: 'node',
  nodeType,
  label,
});
const edge = (time: number, label: string): DiagramEvent => ({ time, kind: 'edge', label });

/** One modelling session on a C4 board, from first system to a late new person. */
const SESSION: ReadonlyArray<DiagramEvent> = [
  node(at(13, 12), 'system', 'Planetnik'),
  node(at(13, 15), 'person', 'Analyst'),
  node(at(13, 18), 'container', 'CLI'),
  edge(at(13, 20), 'Analyst → CLI'),
  node(at(13, 22), 'container', 'Analyzer'),
  node(at(13, 25), 'container', 'Reports'),
  edge(at(13, 26), 'CLI → Analyzer'),
  edge(at(13, 27), 'Analyzer → Reports'),
  node(at(13, 31), 'externalSystem', 'Git'),
  edge(at(13, 33), 'Analyzer → Git'),
  node(at(13, 38), 'component', 'Duplication finder'),
  node(at(13, 40), 'component', 'History reader'),
  node(at(13, 41), 'component', 'Complexity scorer'),
  edge(at(13, 42), 'History reader → Git'),
  edge(at(13, 44), 'Complexity scorer → Reports'),
  node(at(13, 47), 'component', 'HTML renderer'),
  edge(at(13, 50), 'Reports → HTML renderer'),
  node(at(13, 52), 'externalSystem', 'npm registry'),
  edge(at(13, 55), 'CLI → npm registry'),
  node(at(14, 1), 'person', 'New person'),
];

export const init = (_props: AppInitProps) => ({
  model: { events: SESSION, highlighted: null, curve: 'stepAfter' as const },
});
