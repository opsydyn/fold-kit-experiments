import { expect, test } from 'bun:test';

import {
  deriveSignalChart,
  inspectionNotice,
  currentSignalSource,
} from '../src/examples/signals/derive';
import { Message } from '../src/examples/signals/message';
import { init, type ReadyModel } from '../src/examples/signals/model';
import { update } from '../src/examples/signals/update';
export const t0 = 1700000000000;
export const records = Array.from({ length: 5 }, (_, i) => ({
  id: `sample-${i}`,
  time: t0 + i * 1000,
  latencyMs: 80 + i * 10,
  errorPercent: i,
}));
const sample0 = records[0],
  sample1 = records[1],
  sample4 = records[4];
if (!sample0 || !sample1 || !sample4) throw new Error('Missing test fixture');
const ready = (data = records): ReadyModel => {
  const m = init({ data }).model;
  if (m._tag !== 'Ready') throw new Error('Expected Ready');
  return m;
};
const send = (m: ReadyModel, msg: Message): ReadyModel => {
  const next = update(m, msg).model;
  if (next._tag !== 'Ready') throw new Error('Expected Ready');
  return next;
};
const point = (
  m: ReadyModel,
  role: 'overview' | 'latency' | 'errors',
  time: number,
  pointerId = 1,
) => ({ role, pointerId, x: deriveSignalChart(m, role).geometry.layout.x(time), y: 50 });
test('initialization validates without fabricating or mutating caller records', () => {
  const m = ready();
  expect(m.bounds).toEqual([t0, t0 + 4000]);
  expect(m.viewport).toEqual(m.bounds);
  expect(m.selection._tag).toBe('None');
  expect(m.inspection).toEqual({ _tag: 'Following', key: null });
  expect(m.gesture._tag).toBe('Idle');
  expect(init({ data: [] }).model._tag).toBe('Empty');
  for (const data of [
    [{ ...sample0, id: '' }],
    [{ ...sample0 }, { ...sample0 }],
    [{ ...sample0, latencyMs: -1 }],
    [{ ...sample0, errorPercent: 101 }],
    [{ ...sample0, time: Infinity }],
  ])
    expect(init({ data }).model._tag).toBe('Invalid');
  expect(ready([sample0]).bounds).toEqual([t0 - 500, t0 + 500]);
  expect(ready([{ ...sample0 }, { ...sample1, time: t0 + 200 }]).bounds).toEqual([
    t0 - 400,
    t0 + 600,
  ]);
  const reversed = [...records].reverse();
  expect(ready(reversed).records[0]?.id).toBe('sample-0');
  expect(reversed[0]?.id).toBe('sample-4');
});
test('overview preview commits only on release and short taps preserve domains', () => {
  let m = ready();
  m = send(m, Message.StartedChartPointer(point(m, 'overview', t0 + 1000)));
  m = send(m, Message.MovedChartPointer(point(m, 'overview', t0 + 3000)));
  expect(m.selection._tag).toBe('None');
  expect(m.gesture._tag).toBe('Brushing');
  m = send(m, Message.EndedChartPointer(point(m, 'overview', t0 + 3000)));
  expect(m.selection).toEqual({ _tag: 'Interval', axis: 'x', domain: [t0 + 1000, t0 + 3000] });
  expect(m.viewport).toEqual([t0 + 1000, t0 + 3000]);
  const before = m;
  const p = point(m, 'overview', t0 + 2000);
  m = send(m, Message.StartedChartPointer(p));
  m = send(m, Message.EndedChartPointer({ ...p, x: p.x + 3 }));
  expect(m.viewport).toEqual(before.viewport);
  expect(m.selection).toEqual(before.selection);
  expect(m.inspection.key).toBe('sample-2');
  m = send(m, Message.StartedChartPointer(p));
  m = send(m, Message.EndedChartPointer({ ...p, x: p.x + 4 }));
  expect(m.viewport[1] - m.viewport[0]).toBe(1000);
});
test('pan derives from starting frame and cancel resize foreign and late pointers cannot commit', () => {
  let m = send(ready(), Message.ClickedZoomIn());
  const original = m;
  const p = point(m, 'latency', t0 + 2000);
  m = send(m, Message.StartedChartPointer(p));
  m = send(m, Message.MovedChartPointer({ ...p, x: p.x + 20 }));
  const once = m.viewport;
  m = send(m, Message.MovedChartPointer({ ...p, x: p.x + 20 }));
  expect(m.viewport).toEqual(once);
  expect(m.selection).toEqual(original.selection);
  expect(send(m, Message.MovedChartPointer({ ...p, pointerId: 9, x: 0 }))).toEqual(m);
  m = send(m, Message.CancelledChartPointer({ role: 'latency', pointerId: 1 }));
  expect(m.viewport).toEqual(original.viewport);
  expect(m.gesture._tag).toBe('Idle');
  m = send(m, Message.StartedChartPointer(p));
  m = send(m, Message.StartedChartPointer({ ...p, pointerId: 2 }));
  expect(m.gesture._tag).toBe('Idle');
  m = send(m, Message.StartedChartPointer({ ...p, pointerId: 3 }));
  expect(send(m, Message.EndedChartPointer(p))).toEqual(m);
  m = send(m, Message.RecordedChartWidth({ role: 'latency', width: 390 }));
  expect(m.gesture._tag).toBe('Idle');
  expect(m.viewport).toEqual(original.viewport);
  const before = m;
  m = send(m, Message.RecordedChartWidth({ role: 'errors', width: 0 }));
  expect(m.widths.errors).toBe(before.widths.errors);
  expect(m.inputStatus.errors).toBe('Unavailable');
});
test('pin survives outside view and independent controls; keyboard explicitly moves it', () => {
  let m = ready();
  m = send(m, Message.RecordedPointerPosition(point(m, 'latency', t0 + 4000)));
  m = send(m, Message.ClickedPinInspection());
  m = send(m, Message.ChangedRangeStart({ index: 0 }));
  m = send(m, Message.ChangedRangeEnd({ index: 1 }));
  expect(m.inspection).toEqual({ _tag: 'Pinned', key: 'sample-4' });
  expect(inspectionNotice(m)).toContain('outside current view');
  m = send(m, Message.RecordedPointerPosition(point(m, 'latency', t0)));
  expect(m.inspection.key).toBe('sample-4');
  m = send(m, Message.PressedInspectionKey({ role: 'latency', key: 'Home' }));
  expect(m.inspection).toEqual({ _tag: 'Pinned', key: 'sample-0' });
  m = send(m, Message.PressedInspectionKey({ role: 'errors', key: 'End' }));
  expect(m.inspection.key).toBe('sample-1');
  m = send(m, Message.PressedInspectionKey({ role: 'latency', key: 'ArrowRight' }));
  expect(m.inspection.key).toBe('sample-1');
  const sel = m.selection;
  m = send(m, Message.ClickedZoomOut());
  expect(m.selection).toEqual(sel);
  m = send(m, Message.ClickedResetView());
  expect(m.selection).toEqual(sel);
  expect(m.inspection._tag).toBe('Pinned');
  const vp = m.viewport;
  m = send(m, Message.ClickedClearSelection());
  expect(m.viewport).toEqual(vp);
  expect(m.inspection._tag).toBe('Pinned');
  expect(currentSignalSource(m)).toContain('sample-1');
  m = send(m, Message.ClickedResumeInspection());
  expect(m.inspection._tag).toBe('Following');
  expect(send(ready(), Message.ClickedPinInspection()).inspection._tag).toBe('Following');
});
test('range constraints and keyboard cancellation retain valid state', () => {
  let m = ready();
  for (const index of [-1, 5, NaN, 0.5])
    expect(send(m, Message.ChangedRangeEnd({ index }))).toEqual(m);
  m = send(m, Message.ChangedRangeStart({ index: 4 }));
  expect(m.selection).toEqual({ _tag: 'Interval', axis: 'x', domain: [t0 + 3000, t0 + 4000] });
  const p = point(m, 'overview', t0);
  m = send(m, Message.StartedChartPointer(p));
  m = send(m, Message.PressedInspectionKey({ role: 'latency', key: 'Escape' }));
  expect(m.gesture._tag).toBe('Idle');
  const sparse = ready([{ ...sample0 }, { ...sample4 }]);
  const empty = { ...sparse, viewport: [t0 + 1000, t0 + 2000] as const };
  expect(deriveSignalChart(empty, 'latency').visible).toHaveLength(0);
  expect(inspectionNotice(empty)).toContain('No observation');
});
