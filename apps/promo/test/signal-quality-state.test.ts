import { expect, test } from 'bun:test';

import { signalData } from '../src/examples/signals/data';
import { deriveSignalChart } from '../src/examples/signals/derive';
import { Message } from '../src/examples/signals/message';
import { init, type ReadyModel } from '../src/examples/signals/model';
import { classifyReading, sourceFreshness, observedRecords } from '../src/examples/signals/quality';
import { qualityProps, freshSnapshot } from '../src/examples/signals/quality-data';
import { update } from '../src/examples/signals/update';
const ready = (): ReadyModel => {
  const m = init(qualityProps).model;
  if (m._tag !== 'Ready') throw new Error('Expected Ready');
  return m;
};
type ReplacementPayload = (typeof Message.ChangedSignalDataset.Type)['props'];
const replace = (props: ReplacementPayload) =>
  update(ready(), Message.ChangedSignalDataset({ props })).model;
test('quality fixture carries exact independent readings', () => {
  expect(qualityProps.data).toHaveLength(115);
  expect(signalData).toHaveLength(120);
  expect(qualityProps.data.find((d) => d.id === 'signal-010')?.latency).toEqual({
    _tag: 'Missing',
    reason: 'collector unavailable',
  });
  expect(qualityProps.data.find((d) => d.id === 'signal-010')?.errors._tag).toBe('Observed');
  expect(qualityProps.data.find((d) => d.id === 'signal-022')?.errors).toEqual({
    _tag: 'Invalid',
    raw: 'NaN',
    reason: 'collector emitted non-finite value',
  });
  const estimated = qualityProps.data.find((d) => d.id === 'signal-035')?.latency;
  if (estimated?._tag !== 'Estimated') throw new Error('Missing estimate');
  expect(estimated.bounds?.support).toBe(0);
  expect(qualityProps.data.find((d) => d.id === 'signal-040')?.latency).toEqual({
    _tag: 'Observed',
    value: 0,
    bounds: null,
  });
  expect(qualityProps.data.some((d) => d.id === 'signal-070')).toBe(false);
  for (const value of [NaN, Infinity, -Infinity]) {
    const r = classifyReading(value, 'latency');
    expect(r._tag).toBe('Invalid');
    if (r._tag === 'Invalid') expect(r.raw).toBe(String(value));
  }
  expect(classifyReading(null, 'latency')._tag).toBe('Missing');
  expect(classifyReading(0, 'errors')).toEqual({ _tag: 'Observed', value: 0, bounds: null });
  expect(classifyReading(101, 'errors')._tag).toBe('Invalid');
});
test('declared metadata cannot be silently repaired', () => {
  const record = qualityProps.data[0];
  if (!record) throw new Error('Fixture');
  const badReadings = [
    { _tag: 'Observed', value: 3, bounds: { lower: 4, upper: 8, label: 'range', support: 3 } },
    {
      _tag: 'Observed',
      value: 3,
      bounds: { lower: 0, upper: Infinity, label: 'range', support: 3 },
    },
    { _tag: 'Observed', value: -1, bounds: null },
    { _tag: 'Observed', value: 3, bounds: { lower: 0, upper: 8, label: '', support: 3 } },
    { _tag: 'Observed', value: 3, bounds: { lower: 0, upper: 8, label: 'range', support: -1 } },
    { _tag: 'Observed', value: 3, bounds: { lower: 0, upper: 8, label: 'range', support: 0.5 } },
    { _tag: 'Estimated', value: 3, bounds: null, method: '' },
    { _tag: 'Missing', reason: '' },
    { _tag: 'Invalid', raw: 'NaN', reason: '' },
  ];
  for (const latency of badReadings)
    expect(replace({ ...qualityProps, data: [{ ...record, latency }] })._tag).toBe('Invalid');
  for (const props of [
    { ...qualityProps, maxGapMs: 0 },
    { ...qualityProps, snapshot: { ...freshSnapshot, revision: '' } },
    { ...qualityProps, snapshot: { ...freshSnapshot, updatedAt: freshSnapshot.asOf + 1 } },
    {
      ...qualityProps,
      scenarioAsOf: { Fresh: freshSnapshot.updatedAt + 10001, Stale: freshSnapshot.updatedAt },
    },
    { ...qualityProps, data: [record, { ...record, id: 'other' }] },
    { ...qualityProps, data: [{ ...record, time: Infinity }] },
    {
      ...qualityProps,
      thresholds: [{ id: 'bad', metric: 'errors', value: 101, label: 'bad', style: {} }],
    },
    {
      ...qualityProps,
      thresholds: [
        { id: 'bad', metric: 'latency', value: 1, label: 'bad', style: { opacity: NaN } },
      ],
    },
  ])
    expect(replace(props)._tag).toBe('Invalid');
  expect(replace({ ...qualityProps, data: [] })._tag).toBe('Empty');
  const one = replace({ ...qualityProps, data: [record] });
  if (one._tag !== 'Ready') throw new Error('Singleton');
  expect(one.bounds).toEqual([record.time - 500, record.time + 500]);
  const reverse = [...qualityProps.data].reverse();
  const sorted = replace({ ...qualityProps, data: reverse });
  if (sorted._tag !== 'Ready') throw new Error('Sorted');
  expect(sorted.records[0]?.id).toBe('signal-000');
  expect(reverse[0]?.id).toBe('signal-119');
  expect(
    replace({
      ...qualityProps,
      data: observedRecords([{ id: 'zero', time: 1700000000000, latencyMs: 0, errorPercent: 0 }]),
      thresholds: [],
    })._tag,
  ).toBe('Ready');
});
test('source staleness has a strict independent cutoff', () => {
  expect(sourceFreshness({ ...freshSnapshot, asOf: freshSnapshot.updatedAt + 10000 })).toBe(
    'Fresh',
  );
  expect(sourceFreshness({ ...freshSnapshot, asOf: freshSnapshot.updatedAt + 10001 })).toBe(
    'Stale',
  );
  expect(() => sourceFreshness({ ...freshSnapshot, updatedAt: Infinity })).toThrow(RangeError);
});
test('freshness preserves gestures and pin while replacement resets atomically', () => {
  let m = ready();
  const x = deriveSignalChart(m, 'latency').geometry.layout.x(1700000010000);
  m = { ...m, inspection: { _tag: 'Pinned', key: 'signal-010' } };
  let result = update(
    m,
    Message.StartedChartPointer({ role: 'latency', pointerId: 1, x, y: 50 }),
  ).model;
  if (result._tag !== 'Ready') throw new Error('Ready');
  m = result;
  result = update(m, Message.ClickedFreshnessScenario({ scenario: 'Stale' })).model;
  if (result._tag !== 'Ready') throw new Error('Ready');
  expect(result.viewport).toEqual(m.viewport);
  expect(result.selection).toEqual(m.selection);
  expect(result.gesture).toEqual(m.gesture);
  expect(result.inspection).toEqual(m.inspection);
  expect(sourceFreshness(result.snapshot)).toBe('Stale');
  const next = update(result, Message.ChangedSignalDataset({ props: qualityProps })).model;
  if (next._tag !== 'Ready') throw new Error('Ready');
  expect(next.gesture._tag).toBe('Idle');
  expect(next.inspection).toEqual({ _tag: 'Following', key: null });
  expect(next.selection._tag).toBe('None');
  expect(next.viewport).toEqual(next.bounds);
  expect(
    update(next, Message.EndedChartPointer({ role: 'latency', pointerId: 1, x: 300, y: 50 })).model,
  ).toEqual(next);
  const empty = init({ ...qualityProps, data: [] }).model;
  expect(update(empty, Message.ChangedSignalDataset({ props: qualityProps })).model._tag).toBe(
    'Ready',
  );
});
test('missing and invalid observations participate in exact pointer and keyboard inspection', () => {
  let m = ready();
  const p = {
    role: 'latency' as const,
    pointerId: 1,
    x: deriveSignalChart(m, 'latency').geometry.layout.x(1700000010000),
    y: 50,
  };
  let result = update(m, Message.RecordedPointerPosition(p)).model;
  if (result._tag !== 'Ready') throw new Error('Ready');
  m = result;
  expect(m.inspection.key).toBe('signal-010');
  result = update(m, Message.PressedInspectionKey({ role: 'latency', key: 'ArrowRight' })).model;
  if (result._tag !== 'Ready') throw new Error('Ready');
  expect(result.inspection.key).toBe('signal-011');
});
