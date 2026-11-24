import type { ZlozGraph, ZlozNode, ZlozOperationDocument } from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';

export const windowSize = 40;
const Counts = Schema.Struct({
  events: Schema.Number,
  openHotspots: Schema.Number,
  person: Schema.Number,
  'software-system': Schema.Number,
  'external-system': Schema.Number,
  container: Schema.Number,
  component: Schema.Number,
  other: Schema.Number,
  relationships: Schema.Number,
});
export type SeriesKey = keyof typeof Counts.Type;
const Sample = Schema.Struct({ version: Schema.Number, counts: Counts, graph: Schema.Unknown });
export type Sample = typeof Sample.Type;

export const History = Schema.Struct({
  samples: Schema.Array(Sample),
  inspected: Schema.NullOr(Schema.Number),
  restartedAfterGap: Schema.Boolean,
});
export type History = typeof History.Type;
export const empty: History = { samples: [], inspected: null, restartedAfterGap: false };

function category({
  architecture,
}: ZlozNode): Exclude<SeriesKey, 'relationships' | 'openHotspots' | 'events'> {
  if (architecture?.family !== 'c4') return 'other';
  return architecture.role === 'software-system' && architecture.scope === 'external'
    ? 'external-system'
    : architecture.role;
}

/** Keep immutable graph references from installed, confirmed versions only. */
export function observe(
  history: History,
  document: Pick<ZlozOperationDocument, 'version' | 'graph'>,
): History {
  const { version, graph } = document;
  const last = history.samples.at(-1);
  if (last && version <= last.version) return history;

  const counts = {
    events: 0,
    openHotspots: 0,
    person: 0,
    'software-system': 0,
    'external-system': 0,
    container: 0,
    component: 0,
    other: 0,
    relationships: graph.edges.length,
  };
  for (const node of graph.nodes) {
    counts[category(node)] += 1;
    const note = node.architecture;
    if (note?.family !== 'event-storming') continue;
    if (note.role === 'domain-event') counts.events += 1;
    if (note.role === 'hotspot' && note.status === 'open') counts.openHotspots += 1;
  }
  const sample = { version, counts, graph };
  if (last && version !== last.version + 1)
    return { samples: [sample], inspected: null, restartedAfterGap: true };

  const retained = history.samples.slice(-(windowSize - 1));
  const first = retained[0]?.version ?? version;
  const inspected =
    history.inspected !== null && history.inspected >= first ? history.inspected : null;
  return { ...history, samples: [...retained, sample], inspected };
}

export function inspect(history: History, value: string): History {
  if (value === 'latest') return { ...history, inspected: null };
  const match = history.samples.find(({ version }) => String(version) === value);
  return match ? { ...history, inspected: match.version } : history;
}

export function graphAt(history: History, version: number): ZlozGraph | undefined {
  // SAFETY: Only observe supplies graphs, from the validated confirmed document.
  return history.samples.find((sample) => sample.version === version)?.graph as
    | ZlozGraph
    | undefined;
}
