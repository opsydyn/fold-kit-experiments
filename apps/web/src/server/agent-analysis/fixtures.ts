import { EventType, type BaseEvent, type Event } from '@ag-ui/core';

import type { Scenario, Wire } from '../../apps/agent-analysis/contract';

export interface FixtureInput {
  readonly runId: string;
  readonly threadId: string;
  readonly scenario: Scenario;
}

export interface TimedEvent {
  readonly delayMs: number;
  readonly event: BaseEvent;
}

export const initialWire: Wire = {
  services: [
    { id: 'api', name: 'API', series: 'Core', volume: 1200, latency: 60 },
    { id: 'search', name: 'Search', series: 'Core', volume: 800, latency: 110 },
    { id: 'queue', name: 'Queue', series: 'Platform', volume: 1700, latency: 90 },
  ],
};

export function fixtureEvents(input: FixtureInput): ReadonlyArray<TimedEvent> {
  const baseline = structuredClone(initialWire);
  const delta: Event = {
    type: EventType.STATE_DELTA,
    delta: [{ op: 'replace', path: '/services/0/latency', value: 145 }],
  };
  const events: ReadonlyArray<Event> = [
    { type: EventType.RUN_STARTED, runId: input.runId, threadId: input.threadId },
    { type: EventType.STATE_SNAPSHOT, snapshot: baseline },
    ...(input.scenario === 'invalid'
      ? [
          {
            type: EventType.STATE_DELTA,
            delta: [
              { op: 'replace', path: '/services/0/latency', value: 999 },
              { op: 'remove', path: '/services/99' },
            ],
          } satisfies Event,
          delta,
        ]
      : [
          delta,
          {
            type: EventType.STATE_SNAPSHOT,
            snapshot: { services: [...baseline.services].reverse() },
          } satisfies Event,
          {
            type: EventType.STATE_DELTA,
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
          } satisfies Event,
        ]),
    { type: EventType.RUN_FINISHED, runId: input.runId, threadId: input.threadId },
  ];
  return events.map((event, index) => ({
    delayMs: index === 0 ? 0 : input.scenario === 'slow' && index > 1 ? 4000 : 650,
    event,
  }));
}
