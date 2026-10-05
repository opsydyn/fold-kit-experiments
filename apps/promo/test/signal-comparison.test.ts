import { expect, test } from 'bun:test';

import {
  compareReading,
  deriveSignalComparison,
  deriveComparisonChart,
} from '../src/examples/signals/comparison';
import { currentSignalSource, deriveSignalChart } from '../src/examples/signals/derive';
import { Message } from '../src/examples/signals/message';
import { init, type ReadyModel } from '../src/examples/signals/model';
import { Reading, sourceFreshness } from '../src/examples/signals/quality';
import { qualityProps } from '../src/examples/signals/quality-data';
import { update } from '../src/examples/signals/update';
const ready = (): ReadyModel => {
  const m = init(structuredClone(qualityProps)).model;
  if (m._tag !== 'Ready') throw new Error('Ready');
  return m;
};
const capture = (): ReadyModel => {
  const m = update(
    { ...ready(), inspection: { _tag: 'Following', key: 'signal-035' } },
    Message.ClickedCaptureBaseline(),
  ).model;
  if (m._tag !== 'Ready') throw new Error('Ready');
  return m;
};
test('error delta is percentage points from exact input, not relative percent', () => {
  const current = Reading.Observed({ value: 0.5, bounds: null }),
    baseline = Reading.Observed({ value: 0.2, bounds: null });
  expect(compareReading('errors', current, baseline)).toEqual({
    _tag: 'Available',
    metric: 'errors',
    current,
    baseline,
    delta: 0.5 - 0.2,
    unit: 'percentage points',
  });
  expect(compareReading('errors', baseline, baseline)).toMatchObject({ delta: 0 });
});
test('comparison retains estimated method supplied range and zero or unspecified support', () => {
  const baseline = Reading.Observed({
    value: 80,
    bounds: { lower: 70, upper: 90, label: 'provided', support: null },
  });
  const current = Reading.Estimated({
    value: 100,
    bounds: { lower: 92, upper: 108, label: 'supplied', support: 0 },
    method: 'test estimate',
  });
  const result = compareReading('latency', current, baseline);
  expect(result).toEqual({
    _tag: 'Available',
    metric: 'latency',
    current,
    baseline,
    delta: 20,
    unit: 'ms',
  });
  expect(compareReading('latency', baseline, current)).toMatchObject({ delta: -20 });
});
test('unavailable comparisons preserve both nonnumeric diagnostics without substitutes', () => {
  const missing = Reading.Missing({ reason: 'offline' }),
    invalid = Reading.Invalid({ raw: 'NaN', reason: 'bad collector' }),
    valid = Reading.Observed({ value: 0, bounds: null });
  for (const [current, baseline] of [
    [missing, valid],
    [valid, missing],
    [invalid, valid],
    [valid, invalid],
    [missing, invalid],
  ] as const) {
    const result = compareReading('latency', current ?? null, baseline ?? null);
    expect(result).toEqual({
      _tag: 'Unavailable',
      metric: 'latency',
      current,
      baseline,
      reason: 'NonNumeric',
    });
  }
  expect(compareReading('latency', null, null)).toMatchObject({
    _tag: 'Unavailable',
    reason: 'NoBaseline',
  });
  expect(compareReading('latency', null, valid)).toMatchObject({
    _tag: 'Unavailable',
    reason: 'NoCurrent',
  });
});
test('captured and current provenance remain distinct after scenario and inspection changes', () => {
  const m = { ...capture(), inspection: { _tag: 'Following' as const, key: 'signal-040' } };
  const stale = update(m, Message.ClickedFreshnessScenario({ scenario: 'Stale' })).model;
  if (stale._tag !== 'Ready') throw new Error('Ready');
  const comparison = deriveSignalComparison(stale);
  if (comparison.baseline._tag !== 'Captured') throw new Error('Capture');
  expect(comparison.current?.id).toBe('signal-040');
  expect(comparison.baseline.record.id).toBe('signal-035');
  expect(comparison.latency).toMatchObject({ delta: -100, unit: 'ms' });
  expect(comparison.errors).toMatchObject({ delta: -0.2, unit: 'percentage points' });
  expect(sourceFreshness(comparison.baseline.snapshot)).toBe('Fresh');
  expect(sourceFreshness(stale.snapshot)).toBe('Stale');
  const off = { ...stale, viewport: [1700000050000, 1700000060000] as const };
  expect(deriveSignalComparison(off).baselineOutsideView).toBe(true);
  expect(
    deriveSignalComparison({ ...off, inspection: { _tag: 'Following', key: null } }).latency,
  ).toMatchObject({ reason: 'NoCurrent' });
  expect(
    deriveSignalComparison({ ...off, inspection: { _tag: 'Pinned', key: 'signal-040' } }).current
      ?.id,
  ).toBe('signal-040');
  const source = currentSignalSource(stale);
  expect(source).toContain('const baseline = {"_tag":"Captured"');
  expect(source).toContain('const baselineFreshnessAtCapture = "Fresh"');
  expect(source).toContain('const freshness = "Stale"');
});
test('selected intervals deduplicate shared records while full geometry stays unchanged', () => {
  const initial = { ...ready(), inspection: { _tag: 'Following' as const, key: 'signal-035' } };
  const m = capture();
  const before = deriveSignalChart(initial, 'latency');
  const after = deriveSignalChart(m, 'latency');
  for (const field of ['bands', 'runs', 'qualitySpans', 'gaps'] as const)
    expect(after[field]).toEqual(before[field]);
  expect(after.geometry.layout.yDomain).toEqual(before.geometry.layout.yDomain);
  expect(after.geometry.points).toEqual(before.geometry.points);
  const same = deriveComparisonChart(m, 'latency', after.geometry.layout);
  expect(same.errorBars).toHaveLength(1);
  expect(same.errorBars[0]?.purpose).toBe('both');
  const mark = same.errorBars[0]?.mark;
  if (!mark) throw new Error('Expected selected interval');
  expect(mark.lowerCap.end[0] - mark.lowerCap.start[0]).toBe(8);
  const different = { ...m, inspection: { _tag: 'Following' as const, key: 'signal-036' } };
  const chart = deriveComparisonChart(different, 'latency', after.geometry.layout);
  expect(chart.errorBars.map((p) => p.purpose)).toEqual(['baseline', 'inspection']);
  expect(deriveComparisonChart(ready(), 'latency', before.geometry.layout)).toEqual({
    errorBars: [],
    baselineReference: null,
  });
});
test('outside viewport intervals retain actual coordinates and a numeric reference despite missing current', () => {
  const m = {
    ...capture(),
    viewport: [1700000050000, 1700000060000] as const,
    inspection: { _tag: 'Pinned' as const, key: 'signal-010' },
  };
  const layout = deriveSignalChart(m, 'latency').geometry.layout;
  const chart = deriveComparisonChart(m, 'latency', layout);
  expect(chart.errorBars).toHaveLength(1);
  expect(chart.errorBars[0]?.mark.stem.start[0]).toBeLessThan(layout.plot.left);
  expect(chart.baselineReference?.value).toBe(100);
  expect(chart.baselineReference?.record.id).toBe('signal-035');
  const noBounds = { ...m, inspection: { _tag: 'Pinned' as const, key: 'signal-040' } };
  expect(deriveComparisonChart(noBounds, 'latency', layout).errorBars).toHaveLength(1);
});
test('equal supplied bounds retain a selected mark and invalid baseline has no value reference', () => {
  const p = structuredClone(qualityProps);
  const data = p.data.map((d) =>
    d.id === 'signal-035'
      ? {
          ...d,
          latency: Reading.Estimated({
            value: 100,
            bounds: { lower: 100, upper: 100, label: 'equal', support: 0 },
            method: 'provided',
          }),
        }
      : d,
  );
  const base = init({ ...p, data }).model;
  if (base._tag !== 'Ready') throw new Error('Ready');
  const m = update(
    { ...base, inspection: { _tag: 'Following', key: 'signal-035' } },
    Message.ClickedCaptureBaseline(),
  ).model;
  if (m._tag !== 'Ready') throw new Error('Ready');
  const result = deriveComparisonChart(
    m,
    'latency',
    deriveSignalChart(m, 'latency').geometry.layout,
  );
  expect(result.errorBars[0]?.mark.lowerCap).toEqual(result.errorBars[0]?.mark.upperCap);
  const bad = update(
    { ...ready(), inspection: { _tag: 'Following', key: 'signal-022' } },
    Message.ClickedCaptureBaseline(),
  ).model;
  if (bad._tag !== 'Ready') throw new Error('Ready');
  expect(
    deriveComparisonChart(bad, 'errors', deriveSignalChart(bad, 'errors').geometry.layout),
  ).toEqual({ errorBars: [], baselineReference: null });
});
