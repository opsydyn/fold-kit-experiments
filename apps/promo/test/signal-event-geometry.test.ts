import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { lineGeometry, type CartesianLayout } from '@opsydyn/foldkit-viz/chart/cartesian';

import { currentSignalSource } from '../src/examples/signals/derive';
import {
  selectedEvent,
  eventPosition,
  visibleEventGroups,
  selectedEventGuide,
} from '../src/examples/signals/event-derive';
import { normaliseEventFeed, type SignalEvent } from '../src/examples/signals/events';
import { Message } from '../src/examples/signals/message';
import { init, type ReadyModel } from '../src/examples/signals/model';
import { qualityProps } from '../src/examples/signals/quality-data';
import { update } from '../src/examples/signals/update';
const t0 = 1700000000000;
const ready = (): ReadyModel => {
  const m = init(qualityProps).model;
  assert(m._tag === 'Ready');
  return m;
};
const event = (id: string, time: number): SignalEvent => ({
  id,
  time,
  label: id,
  kind: 'note',
  description: null,
  sourceRef: null,
  style: {},
});
const model = (records: ReadonlyArray<SignalEvent>): ReadyModel => ({
  ...ready(),
  bounds: [0, 100],
  viewport: [0, 100],
  events: normaliseEventFeed({
    records,
    snapshot: { revision: 'geometry', asOf: 200, updatedAt: 190, staleAfterMs: 10 },
  }),
});
const layout = (width = 100, domain: readonly [number, number] = [0, 100]): CartesianLayout =>
  lineGeometry(
    [],
    { datumKey: (d: number) => String(d), seriesKey: () => 'event', x: (d) => d, y: () => 0 },
    {
      frame: { width, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } },
      xDomain: domain,
      yDomain: [0, 1],
    },
  ).layout;
test('inclusive visibility and actual anchors retain model members without invented time', () => {
  const m = model([
    event('left', 0),
    event('near', 11),
    event('b', 12),
    event('a', 12),
    event('next', 23),
    event('solo', 24),
    event('right', 100),
    event('before', -1),
    event('after', 101),
  ]);
  const groups = visibleEventGroups(m, layout());
  expect(groups.map((g) => g.members.length)).toEqual([2, 3, 1, 1]);
  expect(groups.map((g) => g.x)).toEqual([0, 12, 24, 100]);
  expect(groups.flatMap((g) => g.members.map((d) => d.id))).toEqual([
    'left',
    'near',
    'a',
    'b',
    'next',
    'solo',
    'right',
  ]);
  assert(m.events._tag === 'Ready');
  for (const group of groups)
    for (const member of group.members) {
      const accepted = m.events.records.find((d) => d.id === member.id);
      assert(accepted);
      expect(member).toBe(accepted);
    }
});
test('cell boundary and identifier identity use unambiguous ordered group membership', () => {
  const a = visibleEventGroups(model([event('a', 0), event('b|c', 1)]), layout());
  const b = visibleEventGroups(model([event('a|b', 0), event('c', 1)]), layout());
  expect(a[0]?.key).toBe('["a","b|c"]');
  expect(b[0]?.key).toBe('["a|b","c"]');
  expect(a[0]?.key).not.toBe(b[0]?.key);
  const offset = {
    ...layout(),
    plot: { ...layout().plot, left: 56, right: 156 },
    x: (time: number) => time + 56,
  };
  expect(
    visibleEventGroups(model([event('near', 11), event('boundary', 12)]), offset).map((g) => g.x),
  ).toEqual([67, 68]);
});
test('resize preserves membership and selected exact identity while regrouping', () => {
  const base = model([event('zero', 0), event('five', 5), event('ten', 10)]);
  const m = update(base, Message.ClickedEvent({ key: 'five' })).model;
  assert(m._tag === 'Ready');
  const accepted = m.events;
  expect(visibleEventGroups(m, layout()).map((g) => g.members.length)).toEqual([3]);
  expect(visibleEventGroups(m, layout(240)).map((g) => [g.x, g.members.length])).toEqual([
    [0, 1],
    [12, 1],
    [24, 1],
  ]);
  expect(selectedEvent(m)?.id).toBe('five');
  expect(selectedEvent(m)?.time).toBe(5);
  expect(m.events).toBe(accepted);
});
test('empty visible ranges and unavailable feeds emit no decorative evidence', () => {
  for (const events of [
    { _tag: 'NotSupplied' as const },
    { _tag: 'Invalid' as const, error: 'bad' },
    normaliseEventFeed({
      records: [],
      snapshot: { revision: 'empty', asOf: 0, updatedAt: 0, staleAfterMs: 0 },
    }),
  ]) {
    const m = { ...ready(), events };
    expect(visibleEventGroups(m, layout())).toEqual([]);
    expect(selectedEvent(m)).toBeNull();
    expect(selectedEventGuide(m, 'latency', layout())).toBeNull();
  }
  expect(visibleEventGroups(model([event('before', -1), event('after', 101)]), layout())).toEqual(
    [],
  );
});
test('signed UTC projection and nonfinite coordinates are explicit', () => {
  const m = {
    ...model([event('negative', -5), event('zero', 0)]),
    viewport: [-100, 0] as const,
    bounds: [-100, 100] as const,
  };
  expect(visibleEventGroups(m, layout(100, [-100, 0])).map((g) => g.x)).toEqual([95, 100]);
  expect(() => visibleEventGroups(m, { ...layout(), x: () => Infinity })).toThrow(RangeError);
});
test('offscreen guide is not clamped and out-of-bounds overview has no marker', () => {
  const result = update(ready(), Message.ClickedEvent({ key: 'event-gap' })).model;
  assert(result._tag === 'Ready');
  const m = { ...result, viewport: [t0 + 50000, t0 + 60000] as const };
  const detail = selectedEventGuide(m, 'latency', layout(100, m.viewport));
  expect(detail).toEqual({ x: 220, top: 0, bottom: 100 });
  const record = selectedEvent(m);
  assert(record);
  expect(eventPosition(m, record)).toBe('OutsideView');
  expect(selectedEventGuide(m, 'overview', layout(100, m.bounds))?.x).toBeCloseTo(
    60.50420168067227,
  );
  const outside = update(m, Message.ClickedEvent({ key: 'event-after' })).model;
  assert(outside._tag === 'Ready');
  const later = selectedEvent(outside);
  assert(later);
  expect(eventPosition(outside, later)).toBe('OutsideBounds');
  expect(selectedEventGuide(outside, 'overview', layout(100, outside.bounds))).toBeNull();
  expect(() => selectedEventGuide(outside, 'errors', { ...layout(), x: () => NaN })).toThrow(
    RangeError,
  );
});
test('independent event source evidence retains accepted feed, width and policy', () => {
  const next = update(ready(), Message.ClickedEvent({ key: 'event-note' })).model;
  assert(next._tag === 'Ready');
  const source = currentSignalSource(next);
  expect(source).toContain('const selectedEventKey = "event-note";');
  expect(source).toContain('signal-events-v1');
  expect(source).toContain('const eventLaneWidth = 700;');
  expect(source).toContain('const eventCellSize = 12;');
  const stale = update(next, Message.ClickedFreshnessScenario({ scenario: 'Stale' })).model;
  assert(stale._tag === 'Ready');
  expect(stale.events).toBe(next.events);
});
