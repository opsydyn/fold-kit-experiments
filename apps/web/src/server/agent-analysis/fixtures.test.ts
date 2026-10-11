import { EventSchema } from '@ag-ui/core/schemas';
import { describe, expect, it } from 'vitest';

import { fixtureEvents, initialWire } from './fixtures';

const baseline = {
  services: [
    { id: 'api', name: 'API', series: 'Core', volume: 1200, latency: 60 },
    { id: 'search', name: 'Search', series: 'Core', volume: 800, latency: 110 },
    { id: 'queue', name: 'Queue', series: 'Platform', volume: 1700, latency: 90 },
  ],
};
const input = { runId: 'run-1', threadId: 'agent-analysis', scenario: 'normal' } as const;
const start = { type: 'RUN_STARTED', runId: 'run-1', threadId: 'agent-analysis' };
const snapshot = { type: 'STATE_SNAPSHOT', snapshot: baseline };
const delta = {
  type: 'STATE_DELTA',
  delta: [{ op: 'replace', path: '/services/0/latency', value: 145 }],
};
const finish = { type: 'RUN_FINISHED', runId: 'run-1', threadId: 'agent-analysis' };

describe('deterministic fixture events', () => {
  it('emits exact normal data, retaining the spike through reorder before adding Events', () => {
    expect(initialWire).toEqual(baseline);
    expect(fixtureEvents(input)).toEqual([
      { delayMs: 0, event: start },
      { delayMs: 650, event: snapshot },
      { delayMs: 650, event: delta },
      {
        delayMs: 650,
        event: {
          type: 'STATE_SNAPSHOT',
          snapshot: {
            services: baseline.services
              .map((service) => (service.id === 'api' ? { ...service, latency: 145 } : service))
              .reverse(),
          },
        },
      },
      {
        delayMs: 650,
        event: {
          type: 'STATE_DELTA',
          delta: [
            {
              op: 'add',
              path: '/services/-',
              value: {
                id: 'events',
                name: 'Events',
                series: 'Platform',
                volume: 2100,
                latency: 170,
              },
            },
          ],
        },
      },
      { delayMs: 650, event: finish },
    ]);
    fixtureEvents(input).forEach(({ event }) =>
      expect(EventSchema.safeParse(event).success).toBe(true),
    );
  });

  it('accepts the spike before an atomic invalid patch, late delta and finish', () => {
    expect(fixtureEvents({ ...input, scenario: 'invalid' })).toEqual([
      { delayMs: 0, event: start },
      { delayMs: 650, event: snapshot },
      { delayMs: 650, event: delta },
      {
        delayMs: 650,
        event: {
          type: 'STATE_DELTA',
          delta: [
            { op: 'replace', path: '/services/0/latency', value: 999 },
            { op: 'remove', path: '/services/99' },
          ],
        },
      },
      { delayMs: 650, event: delta },
      { delayMs: 650, event: finish },
    ]);
  });

  it('delays every slow event after its first snapshot by 4000ms', () => {
    const events = fixtureEvents({ ...input, scenario: 'slow' });
    expect(events.map(({ delayMs }) => delayMs)).toEqual([0, 650, 4000, 4000, 4000, 4000]);
    expect(events.map(({ event }) => event)).toEqual(
      fixtureEvents(input).map(({ event }) => event),
    );
  });

  it('keeps request IDs independent and does not share mutable fixture payloads', () => {
    const first = fixtureEvents(input);
    const other = fixtureEvents({ ...input, runId: 'run-2' });
    expect(other[0]?.event).toEqual({ ...start, runId: 'run-2' });
    expect(other.at(-1)?.event).toEqual({ ...finish, runId: 'run-2' });
    expect(first[1]?.event).not.toBe(other[1]?.event);
  });
});
