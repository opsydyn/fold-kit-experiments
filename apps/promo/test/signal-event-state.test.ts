import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Message } from '../src/examples/signals/message';
import { init, type ReadyModel } from '../src/examples/signals/model';
import { qualityProps } from '../src/examples/signals/quality-data';
import { update } from '../src/examples/signals/update';
const t0 = 1700000000000;
const ready = (): ReadyModel => {
  const m = init(structuredClone(qualityProps)).model;
  assert(m._tag === 'Ready');
  return m;
};
const step = (m: ReadyModel, message: Message): ReadyModel => {
  const next = update(m, message).model;
  assert(next._tag === 'Ready');
  return next;
};
const selected = (key = 'event-deploy') => step(ready(), Message.ClickedEvent({ key }));
const narrowed = (): ReadyModel => ({
  ...ready(),
  viewport: [t0 + 20000, t0 + 60000],
  selection: { _tag: 'Interval', axis: 'x', domain: [t0 + 20000, t0 + 60000] },
  inspection: { _tag: 'Following', key: 'signal-010' },
});
const preview = (m: ReadyModel, role: 'overview' | 'latency') =>
  step(
    step(m, Message.StartedChartPointer({ role, pointerId: 7, x: 300, y: 50 })),
    Message.MovedChartPointer({ role, pointerId: 7, x: 450, y: 50 }),
  );
test('select and clear preserve independent observation, interval, source and baseline state', () => {
  const m = step(narrowed(), Message.ClickedCaptureBaseline());
  const next = step(m, Message.ClickedEvent({ key: 'event-config' }));
  assert(next.events._tag === 'Ready');
  expect(next.events.inspection).toEqual({ _tag: 'Selected', key: 'event-config' });
  for (const key of ['baseline', 'inspection', 'viewport', 'selection', 'snapshot'] as const)
    expect(next[key]).toBe(m[key]);
  const clear = step(next, Message.ClickedClearEvent());
  assert(clear.events._tag === 'Ready');
  expect(clear.events.inspection).toEqual({ _tag: 'None' });
  expect(clear.baseline).toBe(m.baseline);
  expect(clear.inspection).toBe(m.inspection);
});
test('unknown event and absent selection are true no-ops during a gesture', () => {
  const m = preview(narrowed(), 'latency');
  expect(step(m, Message.ClickedEvent({ key: 'absent' }))).toBe(m);
  expect(step(m, Message.ClickedClearEvent())).toBe(m);
  expect(step(m, Message.ClickedCentreEvent())).toBe(m);
  for (const events of [
    { _tag: 'NotSupplied' as const },
    { _tag: 'Invalid' as const, error: 'bad feed' },
  ]) {
    const unavailable = { ...m, events };
    expect(step(unavailable, Message.ClickedEvent({ key: 'event-deploy' }))).toBe(unavailable);
    expect(step(unavailable, Message.ClickedClearEvent())).toBe(unavailable);
    expect(step(unavailable, Message.ClickedCentreEvent())).toBe(unavailable);
  }
});
test('centre uses committed viewport and retains baseline and interval while settling Following only', () => {
  const m = step(
    step(narrowed(), Message.ClickedCaptureBaseline()),
    Message.ClickedEvent({ key: 'event-deploy' }),
  );
  for (const inspected of [
    m,
    { ...m, inspection: { _tag: 'Pinned' as const, key: 'signal-010' } },
  ]) {
    const moving = preview(inspected, 'latency');
    expect(moving.viewport).not.toEqual(m.viewport);
    const centred = step(moving, Message.ClickedCentreEvent());
    expect(centred.viewport).toEqual([t0 + 28000, t0 + 68000]);
    expect(centred.gesture._tag).toBe('Idle');
    expect(centred.selection).toEqual(m.selection);
    expect(centred.baseline).toBe(m.baseline);
    expect(centred.inspection).toEqual(
      inspected.inspection._tag === 'Pinned'
        ? { _tag: 'Pinned', key: 'signal-010' }
        : { _tag: 'Following', key: null },
    );
  }
});
test('boundary centre preserves span and outside bounds never expand observation domain', () => {
  const m = step(narrowed(), Message.ClickedEvent({ key: 'event-boundary' }));
  const centred = step(m, Message.ClickedCentreEvent());
  expect(centred.viewport).toEqual([t0 + 79000, t0 + 119000]);
  expect(centred.bounds).toBe(m.bounds);
  for (const key of ['event-before', 'event-after']) {
    const outside = preview(step(narrowed(), Message.ClickedEvent({ key })), 'latency');
    expect(step(outside, Message.ClickedCentreEvent())).toBe(outside);
  }
});
test('event retention matrix preserves selected identity and independent snapshot', () => {
  let m = selected('event-note');
  const events = m.events;
  const actions = [
    Message.ChangedRangeStart({ index: 20 }),
    Message.ChangedRangeEnd({ index: 60 }),
    Message.ClickedZoomIn(),
    Message.ClickedZoomOut(),
    Message.RecordedChartWidth({ role: 'latency', width: 390 }),
    Message.ClickedResetView(),
    Message.ClickedClearSelection(),
    Message.ClickedFreshnessScenario({ scenario: 'Stale' }),
    Message.ClickedFreshnessScenario({ scenario: 'Fresh' }),
    Message.PressedInspectionKey({ role: 'latency', key: 'Home' }),
    Message.ClickedCaptureBaseline(),
    Message.PressedInspectionKey({ role: 'latency', key: 'ArrowRight' }),
    Message.ClickedCaptureBaseline(),
    Message.ClickedClearBaseline(),
  ];
  for (const action of actions) {
    m = step(m, action);
    expect(m.events).toBe(events);
  }
  for (const role of ['overview', 'latency'] as const) {
    m = preview(m, role);
    m = step(m, Message.EndedChartPointer({ role, pointerId: 7, x: 450, y: 50 }));
    expect(m.events).toBe(events);
  }
});
test('same revision replacement resets event selection, baseline and gestures', () => {
  const m = preview(step(selected(), Message.ClickedCaptureBaseline()), 'latency');
  const next = step(m, Message.ChangedSignalDataset({ props: structuredClone(qualityProps) }));
  assert(next.events._tag === 'Ready');
  expect(next.events.inspection).toEqual({ _tag: 'None' });
  expect(next.baseline._tag).toBe('None');
  expect(next.gesture._tag).toBe('Idle');
  const absent = step(
    m,
    Message.ChangedSignalDataset({ props: { ...qualityProps, events: undefined } }),
  );
  expect(absent.events._tag).toBe('NotSupplied');
});
test('event select clear and centre abandon pan and brush before rejecting late commits', () => {
  for (const role of ['overview', 'latency'] as const) {
    for (const action of [
      Message.ClickedEvent({ key: 'event-gap' }),
      Message.ClickedClearEvent(),
      Message.ClickedCentreEvent(),
    ]) {
      const start = step(narrowed(), Message.ClickedEvent({ key: 'event-deploy' }));
      let m = step(preview(start, role), action);
      expect(m.gesture._tag).toBe('Idle');
      expect(m.selection).toEqual(start.selection);
      expect(m.viewport).toEqual(
        action._tag === 'ClickedCentreEvent' ? [t0 + 28000, t0 + 68000] : start.viewport,
      );
      const settled = m;
      m = step(m, Message.EndedChartPointer({ role, pointerId: 7, x: 450, y: 50 }));
      m = step(m, Message.CancelledChartPointer({ role, pointerId: 7 }));
      expect(m).toBe(settled);
    }
  }
});
