import { expect, test } from 'bun:test';

import {
  deriveSignalChart,
  currentSignalSource,
  nearestVisible,
} from '../src/examples/signals/derive';
import { init, type ReadyModel } from '../src/examples/signals/model';
import { Reading, type Props } from '../src/examples/signals/quality';
import { qualityProps } from '../src/examples/signals/quality-data';
const t0 = 1700000000000;
const ready = (props: Props = qualityProps): ReadyModel => {
  const m = init(props).model;
  if (m._tag !== 'Ready') throw new Error('Ready');
  return m;
};
test('quality transitions and absent timestamps never bridge', () => {
  const m = ready(),
    latency = deriveSignalChart(m, 'latency'),
    errors = deriveSignalChart(m, 'errors');
  expect(latency.gaps).toContainEqual({ start: t0 + 69000, end: t0 + 75000 });
  expect(latency.qualitySpans).toContainEqual({
    status: 'Missing',
    start: t0 + 10000,
    end: t0 + 14000,
    keys: ['signal-010', 'signal-011', 'signal-012', 'signal-013', 'signal-014'],
  });
  expect(
    latency.runs.some(
      (r) =>
        r.records.some((d) => d.id === 'signal-009') &&
        r.records.some((d) => d.id === 'signal-015'),
    ),
  ).toBe(false);
  expect(
    latency.runs.some(
      (r) =>
        r.records.some((d) => d.id === 'signal-029') &&
        r.records.some((d) => d.id === 'signal-030'),
    ),
  ).toBe(false);
  expect(
    latency.runs.some(
      (r) =>
        r.records.some((d) => d.id === 'signal-069') &&
        r.records.some((d) => d.id === 'signal-075'),
    ),
  ).toBe(false);
  expect(
    errors.runs.some(
      (r) =>
        r.records.some((d) => d.id === 'signal-010') &&
        r.records.some((d) => d.id === 'signal-014'),
    ),
  ).toBe(true);
  expect(latency.bands).toHaveLength(1);
  expect(latency.bands[0]?.points).toHaveLength(10);
});
test('viewport cuts preserve crossing segments and stable bounds', () => {
  const m = ready(),
    full = deriveSignalChart(m, 'latency');
  const cut = deriveSignalChart({ ...m, viewport: [t0 + 32500, t0 + 33500] }, 'latency');
  expect(cut.bands[0]?.points[0]?.key).toBe('signal-030');
  expect(cut.bands[0]?.points.at(-1)?.key).toBe('signal-039');
  expect(cut.bands[0]?.points[0]?.x).toBeLessThan(cut.geometry.layout.plot.left);
  expect(cut.bands[0]?.points.at(-1)?.x).toBeGreaterThan(cut.geometry.layout.plot.right);
  expect(cut.geometry.layout.yDomain).toEqual(full.geometry.layout.yDomain);
  const gap = deriveSignalChart({ ...m, viewport: [t0 + 70000, t0 + 74000] }, 'latency');
  expect(gap.visible).toHaveLength(0);
  expect(gap.noDrawable).toBe(true);
  expect(nearestVisible({ ...m, viewport: [t0 + 70000, t0 + 74000] }, t0 + 72000)).toBeNull();
});
test('empty metric and zero domains do not manufacture observations', () => {
  const sample = qualityProps.data[0];
  if (!sample) throw new Error('Fixture');
  const missing = {
    ...sample,
    latency: Reading.Missing({ reason: 'offline' }),
    errors: Reading.Invalid({ raw: 'NaN', reason: 'invalid' }),
  };
  let m = ready({ ...qualityProps, data: [missing] });
  let d = deriveSignalChart(m, 'latency');
  expect(d.geometry.layout.yDomain[0]).toBe(0);
  expect(d.geometry.layout.yDomain[1]).toBeCloseTo(198, 10);
  expect(d.geometry.points).toHaveLength(0);
  expect(d.noDrawable).toBe(true);
  m = ready({ ...qualityProps, data: [missing], thresholds: [] });
  expect(deriveSignalChart(m, 'latency').geometry.layout.yDomain).toEqual([0, 1]);
  m = ready({
    ...qualityProps,
    data: [
      {
        ...sample,
        latency: Reading.Observed({
          value: 0,
          bounds: { lower: 0, upper: 0, label: 'Equal', support: null },
        }),
      },
    ],
    thresholds: [],
  });
  d = deriveSignalChart(m, 'latency');
  expect(d.geometry.layout.yDomain).toEqual([0, 1]);
  expect(d.bands[0]?.path).toBeNull();
  expect(d.bands[0]?.points).toHaveLength(1);
  expect(d.noDrawable).toBe(false);
});
test('non-drawable records retain exact inspection and independent interval breaks', () => {
  const m = { ...ready(), inspection: { _tag: 'Pinned' as const, key: 'signal-035' } };
  expect(nearestVisible(m, t0 + 10000)?.id).toBe('signal-010');
  expect(deriveSignalChart(m, 'latency').geometry.points.some((p) => p.key === 'signal-010')).toBe(
    false,
  );
  expect(deriveSignalChart(m, 'errors').geometry.points.some((p) => p.key === 'signal-010')).toBe(
    true,
  );
  const source = currentSignalSource(m);
  for (const text of [
    'signal-quality-v1',
    'staleAfterMs',
    'maxGapMs',
    'latency-reference',
    'Illustrative supplied range',
    '"support":0',
    'signal-035',
  ])
    expect(source).toContain(text);
  const records = m.records.map((d) =>
    d.id === 'signal-035'
      ? { ...d, latency: Reading.Estimated({ value: 100, bounds: null, method: 'example' }) }
      : d,
  );
  const split = deriveSignalChart({ ...m, records }, 'latency');
  expect(split.bands).toHaveLength(2);
  expect(split.runs.filter((r) => r.quality === 'Estimated')).toHaveLength(1);
});
