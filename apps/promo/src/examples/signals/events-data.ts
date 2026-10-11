import type { EventDataset, SignalEvent } from './events';
const t0 = 1700000000000;
const record = (
  id: string,
  offset: number,
  label: string,
  kind: string,
  description: string | null,
  sourceRef: string | null,
  style: SignalEvent['style'] = {},
): SignalEvent => ({ id, time: t0 + offset, label, kind, description, sourceRef, style });
/** Caller-authored illustrative context. Temporal proximity does not establish causation. */
export const eventDataset: EventDataset = {
  snapshot: {
    revision: 'signal-events-v1',
    updatedAt: t0 + 129000,
    asOf: t0 + 130000,
    staleAfterMs: 10000,
  },
  records: [
    record(
      'event-before',
      -5000,
      'Earlier operator note',
      'note',
      'Recorded before the available observation range.',
      'illustrative log 001',
    ),
    record(
      'event-missing',
      12000,
      'Collector note',
      'note',
      'Context recorded while latency measurements were unavailable.',
      'illustrative log 002',
      { symbol: 'square', stroke: 'var(--signal-event-note)' },
    ),
    record(
      'event-deploy',
      48000,
      'Deployment recorded',
      'deployment',
      'A recorded deployment; no causal relationship to the signal is asserted.',
      'illustrative deployment 003',
      {
        symbol: 'diamond',
        stroke: 'var(--signal-event-deploy)',
        fill: 'var(--signal-event-deploy)',
      },
    ),
    record(
      'event-config',
      48000,
      'Configuration recorded',
      'configuration',
      'A separate record at the same exact instant.',
      'illustrative change 004',
      { symbol: 'triangle', stroke: 'var(--signal-event-config)' },
    ),
    record(
      'event-note',
      48200,
      'Operator follow-up',
      'note',
      'Exact recorded time between observations.',
      null,
      { symbol: 'square', stroke: 'var(--signal-event-note)' },
    ),
    record(
      'event-gap',
      72000,
      'Operator note during gap',
      'note',
      'No observation was recorded at this event timestamp.',
      'illustrative log 006',
    ),
    record('event-boundary', 119000, 'Window review', 'review', null, 'illustrative review 007', {
      symbol: 'diamond',
    }),
    record(
      'event-after',
      125000,
      'Later operator note',
      'note',
      'Recorded after the available observation range.',
      null,
    ),
  ],
};
