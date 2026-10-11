import { expect, test } from 'bun:test';

import { init, type ReadyModel } from '../src/examples/signals/model';
import type { Props } from '../src/examples/signals/quality';
import { qualityProps } from '../src/examples/signals/quality-data';

const event = {
  id: 'event',
  time: 10,
  label: ' Recorded context ',
  kind: 'note',
  description: null,
  sourceRef: null,
  style: { stroke: 'var(--custom-event)', symbol: 'diamond' },
};
const snapshot = { revision: 'events-test', asOf: 100, updatedAt: 90, staleAfterMs: 10 };
const feed = (records: ReadonlyArray<unknown> = [event]) => ({ records, snapshot });
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Exercise malformed payloads at the real init decode boundary.
const ready = (events: unknown): ReadyModel => {
  // SAFETY: init schema-decodes this deliberately malformed test payload before accessing it.
  const m = init({ ...qualityProps, events } as Props).model;
  expect(m._tag).toBe('Ready');
  if (m._tag !== 'Ready') throw new Error('Expected observations');
  expect(m.records).toHaveLength(115);
  return m;
};
test('optional feed isolation preserves observations across omission, empty and invalid payloads', () => {
  expect(ready(undefined).events).toEqual({ _tag: 'NotSupplied' });
  expect(ready(feed([])).events).toEqual({
    _tag: 'Ready',
    records: [],
    snapshot,
    inspection: { _tag: 'None' },
  });
  for (const input of [
    null,
    [],
    {},
    feed([event, event]),
    feed([{ ...event, id: ' ' }]),
    feed([{ ...event, label: '' }]),
    feed([{ ...event, kind: ' ' }]),
    feed([{ ...event, description: '' }]),
    feed([{ ...event, sourceRef: ' ' }]),
    feed([{ ...event, style: { stroke: 12 } }]),
    feed([{ ...event, style: { symbol: 'hexagon' } }]),
  ]) {
    expect(ready(input).events._tag).toBe('Invalid');
  }
});
test('event boundary validation rejects unusable and future instants without repairing them', () => {
  for (const time of [
    0.5,
    NaN,
    Infinity,
    -Infinity,
    8.64e15 + 1,
    -8.64e15 - 1,
    Number.MAX_SAFE_INTEGER + 1,
    101,
  ]) {
    expect(ready(feed([{ ...event, time }])).events._tag).toBe('Invalid');
  }
  for (const time of [-8.64e15, 8.64e15, 100]) {
    const source = { ...snapshot, asOf: time, updatedAt: time, staleAfterMs: 0 };
    expect(ready({ records: [{ ...event, time }], snapshot: source }).events._tag).toBe('Ready');
  }
});
test('event snapshot semantics reject unusable revision, order and cutoff', () => {
  for (const change of [
    { revision: ' ' },
    { asOf: Infinity },
    { updatedAt: 101 },
    { updatedAt: -8.64e15 - 1 },
    { staleAfterMs: -1 },
    { staleAfterMs: Infinity },
  ]) {
    expect(ready({ ...feed(), snapshot: { ...snapshot, ...change } }).events._tag).toBe('Invalid');
  }
});
test('coincident namespace and sort retain supplied strings and distinct identities', () => {
  const records = [
    { ...event, id: 'z', time: 12 },
    { ...event, id: 'signal-000', time: 10 },
    { ...event, id: 'A', time: 12 },
    { ...event, id: 'a', time: 12 },
  ];
  const accepted = ready(feed(records)).events;
  if (accepted._tag !== 'Ready') throw new Error('Expected feed');
  expect(accepted.records.map((d) => d.id)).toEqual(['signal-000', 'A', 'a', 'z']);
  expect(records.map((d) => d.id)).toEqual(['z', 'signal-000', 'A', 'a']);
  expect(accepted.records[0]?.label).toBe(' Recorded context ');
});
test('caller mutation isolation protects records, nested style and source snapshot', () => {
  const input = structuredClone({ records: [event], snapshot });
  const accepted = ready(input).events;
  if (accepted._tag !== 'Ready') throw new Error('Expected feed');
  const original = input.records[0];
  if (!original) throw new Error('Expected input event');
  Object.assign(original, { label: 'changed', time: 99 });
  Object.assign(original.style, { stroke: 'red' });
  Object.assign(input.snapshot, { revision: 'changed' });
  input.records = [];
  expect(accepted.records).toHaveLength(1);
  expect(accepted.records[0]?.time).toBe(10);
  expect(accepted.records[0]?.label).toBe(' Recorded context ');
  expect(accepted.records[0]?.style.stroke).toBe('var(--custom-event)');
  expect(accepted.snapshot.revision).toBe('events-test');
});
test('illustrative source independence preserves eight exact events and all observations', () => {
  const m = init(qualityProps).model;
  if (m._tag !== 'Ready' || m.events._tag !== 'Ready')
    throw new Error('Expected illustrative events');
  expect(m.records).toHaveLength(115);
  expect(m.events.records.map((d) => [d.id, d.time - 1700000000000])).toEqual([
    ['event-before', -5000],
    ['event-missing', 12000],
    ['event-config', 48000],
    ['event-deploy', 48000],
    ['event-note', 48200],
    ['event-gap', 72000],
    ['event-boundary', 119000],
    ['event-after', 125000],
  ]);
  expect(m.events.snapshot).toEqual({
    revision: 'signal-events-v1',
    updatedAt: 1700000129000,
    asOf: 1700000130000,
    staleAfterMs: 10000,
  });
  expect(m.snapshot.revision).toBe('signal-quality-v1');
});
