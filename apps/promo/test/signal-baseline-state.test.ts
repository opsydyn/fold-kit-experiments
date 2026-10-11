import { expect, test } from 'bun:test';

import { Message } from '../src/examples/signals/message';
import { init, type ReadyModel } from '../src/examples/signals/model';
import { qualityProps } from '../src/examples/signals/quality-data';
import { update } from '../src/examples/signals/update';
const ready = (): ReadyModel => {
  const m = init(structuredClone(qualityProps)).model;
  if (m._tag !== 'Ready') throw new Error('Expected Ready');
  return m;
};
const step = (m: ReadyModel, msg: Message): ReadyModel => {
  const next = update(m, msg).model;
  if (next._tag !== 'Ready') throw new Error('Expected Ready');
  return next;
};
const inspected = (key: string): ReadyModel => ({
  ...ready(),
  inspection: { _tag: 'Following', key },
});
const captured = (key = 'signal-035') => step(inspected(key), Message.ClickedCaptureBaseline());
test('initial and absent inspection cannot invent a baseline', () => {
  const m = ready();
  expect(m.baseline).toEqual({ _tag: 'None' });
  expect(step(m, Message.ClickedCaptureBaseline())).toBe(m);
  expect(
    step(
      { ...m, inspection: { _tag: 'Following', key: 'unknown' } },
      Message.ClickedCaptureBaseline(),
    ).baseline,
  ).toEqual({ _tag: 'None' });
});
test('capture isolates nested evidence without pinning inspection', () => {
  const model = inspected('signal-035');
  const next = step(model, Message.ClickedCaptureBaseline());
  if (next.baseline._tag !== 'Captured') throw new Error('Expected capture');
  const original = model.records.find((d) => d.id === 'signal-035');
  if (!original) throw new Error('Record');
  expect(next.inspection).toEqual(model.inspection);
  expect(next.viewport).toEqual(model.viewport);
  expect(next.selection).toEqual(model.selection);
  expect(next.baseline.record.id).toBe('signal-035');
  expect(next.baseline.record).not.toBe(original);
  expect(next.baseline.snapshot).not.toBe(model.snapshot);
  for (const metric of ['latency', 'errors'] as const) {
    const a = original[metric],
      b = next.baseline.record[metric];
    expect(b).toEqual(a);
    expect(b).not.toBe(a);
    if (a._tag !== 'Estimated' || b._tag !== 'Estimated' || !a.bounds || !b.bounds)
      throw new Error('Expected bounds');
    expect(b.bounds).not.toBe(a.bounds);
    Object.assign(a.bounds, { lower: 999 });
    expect(b.bounds.lower).not.toBe(999);
  }
  const latency = next.baseline.record.latency;
  if (latency._tag !== 'Estimated') throw new Error('Estimate');
  expect(latency.value).toBe(100);
  expect(latency.bounds).toEqual({
    lower: 92,
    upper: 108,
    label: 'Illustrative supplied range',
    support: 0,
  });
  Object.assign(model.snapshot, { asOf: 0 });
  expect(next.baseline.snapshot.asOf).toBe(1700000124000);
});
test('baseline captures missing and invalid records without replacing their diagnostics', () => {
  for (const [key, metric, tag] of [
    ['signal-010', 'latency', 'Missing'],
    ['signal-022', 'errors', 'Invalid'],
  ] as const) {
    const m = captured(key);
    if (m.baseline._tag !== 'Captured') throw new Error('Capture');
    expect(m.baseline.record.id).toBe(key);
    expect(m.baseline.record[metric]._tag).toBe(tag);
  }
});
test('inspection navigation and freshness stay independent from captured evidence', () => {
  let m = captured();
  const baseline = m.baseline;
  m = step(m, Message.PressedInspectionKey({ role: 'latency', key: 'Home' }));
  expect(m.inspection.key).toBe('signal-000');
  m = step(m, Message.PressedInspectionKey({ role: 'latency', key: 'ArrowRight' }));
  expect(m.inspection.key).toBe('signal-001');
  m = step(m, Message.ClickedPinInspection());
  m = step(m, Message.ClickedResumeInspection());
  m = step(m, Message.ClickedFreshnessScenario({ scenario: 'Stale' }));
  expect(m.baseline).toBe(baseline);
  expect(m.snapshot.asOf).toBe(1700000134001);
  if (baseline._tag !== 'Captured') throw new Error('Capture');
  expect(baseline.snapshot.asOf).toBe(1700000124000);
  for (const msg of [
    Message.ChangedRangeStart({ index: 20 }),
    Message.ChangedRangeEnd({ index: 60 }),
    Message.ClickedZoomIn(),
    Message.ClickedZoomOut(),
    Message.RecordedChartWidth({ role: 'latency', width: 390 }),
    Message.ClickedResetView(),
    Message.ClickedClearSelection(),
  ]) {
    m = step(m, msg);
    expect(m.baseline).toBe(baseline);
  }
  m = step(m, Message.StartedChartPointer({ role: 'latency', pointerId: 2, x: 400, y: 50 }));
  m = step(m, Message.MovedChartPointer({ role: 'latency', pointerId: 2, x: 300, y: 50 }));
  m = step(m, Message.EndedChartPointer({ role: 'latency', pointerId: 2, x: 300, y: 50 }));
  expect(m.baseline).toBe(baseline);
});
test('explicit replacement and clear preserve the committed inspection and view', () => {
  let m = captured();
  m = { ...m, inspection: { _tag: 'Pinned', key: 'signal-040' } };
  const next = step(m, Message.ClickedCaptureBaseline());
  if (next.baseline._tag !== 'Captured') throw new Error('Capture');
  expect(next.baseline.record.id).toBe('signal-040');
  const cleared = step(next, Message.ClickedClearBaseline());
  expect(cleared.baseline).toEqual({ _tag: 'None' });
  expect(cleared.inspection).toEqual(next.inspection);
  expect(cleared.viewport).toEqual(next.viewport);
  expect(cleared.selection).toEqual(next.selection);
});
test('dataset replacement with reused revision and identity always resets captured state', () => {
  const m = captured();
  const next = step(m, Message.ChangedSignalDataset({ props: structuredClone(qualityProps) }));
  expect(next.baseline).toEqual({ _tag: 'None' });
  expect(next.inspection.key).toBeNull();
  expect(
    update(m, Message.ChangedSignalDataset({ props: { ...qualityProps, data: [] } })).model._tag,
  ).toBe('Empty');
  expect(
    update(m, Message.ChangedSignalDataset({ props: { ...qualityProps, maxGapMs: 0 } })).model._tag,
  ).toBe('Invalid');
});
test('capture and clear roll back pan and brush before ignoring late pointer commits', () => {
  for (const role of ['overview', 'latency'] as const)
    for (const action of ['capture', 'clear'] as const) {
      let m = step(captured(), Message.ChangedRangeStart({ index: 20 }));
      m = step(m, Message.ChangedRangeEnd({ index: 60 }));
      const start = m;
      m = step(m, Message.StartedChartPointer({ role, pointerId: 7, x: 300, y: 50 }));
      m = step(m, Message.MovedChartPointer({ role, pointerId: 7, x: 450, y: 50 }));
      expect(m.gesture._tag).toBe(role === 'overview' ? 'Brushing' : 'Panning');
      m = step(
        m,
        action === 'capture' ? Message.ClickedCaptureBaseline() : Message.ClickedClearBaseline(),
      );
      expect(m.gesture._tag).toBe('Idle');
      expect(m.viewport).toEqual(start.viewport);
      expect(m.selection).toEqual(start.selection);
      expect(m.inspection).toEqual(start.inspection);
      const settled = m;
      m = step(m, Message.EndedChartPointer({ role, pointerId: 7, x: 450, y: 50 }));
      m = step(m, Message.CancelledChartPointer({ role, pointerId: 7 }));
      expect(m).toEqual(settled);
    }
});
