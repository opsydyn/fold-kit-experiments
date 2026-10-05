import { expect, test } from 'bun:test';

import { signalData } from '../src/examples/signals/data';
import { deriveSignalChart } from '../src/examples/signals/derive';
import { init } from './signal-test-fixtures';

test('same records share X but retain labelled full-data Y domains through zoom', () => {
  const m = init({ data: signalData }).model;
  if (m._tag !== 'Ready') throw new Error('Expected Ready');
  const latency = deriveSignalChart(m, 'latency'),
    errors = deriveSignalChart(m, 'errors');
  expect(m.records).toHaveLength(120);
  expect(latency.geometry.layout.xDomain).toEqual(errors.geometry.layout.xDomain);
  expect(latency.geometry.layout.yDomain[0]).toBe(0);
  expect(errors.geometry.layout.yDomain[0]).toBe(0);
  const max = Math.max(...signalData.map((d) => d.latencyMs));
  expect(latency.geometry.layout.yDomain[1]).toBeCloseTo(max * 1.1, 10);
  const zoom = { ...m, viewport: [m.bounds[0] + 10000, m.bounds[0] + 20000] as const };
  expect(deriveSignalChart(zoom, 'latency').geometry.layout.yDomain).toEqual(
    latency.geometry.layout.yDomain,
  );
  expect(deriveSignalChart(zoom, 'latency').visible).toHaveLength(11);
  expect(latency.geometry.layout.x(m.bounds[0])).toBe(56);
  expect(latency.geometry.layout.x(m.bounds[1])).toBe(680);
  expect(deriveSignalChart(m, 'overview').frame.height).toBe(174);
});

test('narrow time axes leave room for complete UTC tick labels', () => {
  const model = init({ data: signalData }).model;
  if (model._tag !== 'Ready') throw new RangeError('Expected Ready');
  const narrow = { ...model, widths: { overview: 350, latency: 350, errors: 350 } };
  const ticks = deriveSignalChart(narrow, 'overview').geometry.xTicks;
  for (let i = 1; i < ticks.length; i++) {
    const previous = ticks[i - 1],
      current = ticks[i];
    if (!previous || !current) throw new RangeError('Missing tick');
    expect(current.position - previous.position).toBeGreaterThanOrEqual(70);
  }
});

test('sub-percent data uses full-data ten-percent headroom instead of a forced unit ceiling', () => {
  const model = init({
    data: [{ id: 'fractional', time: 1700000000000, latencyMs: 12.5, errorPercent: 0.125 }],
  }).model;
  if (model._tag !== 'Ready') throw new RangeError('Expected Ready');
  expect(deriveSignalChart(model, 'errors').geometry.layout.yDomain[1]).toBeCloseTo(0.1375, 10);
});
