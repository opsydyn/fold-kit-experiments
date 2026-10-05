import { expect, test } from 'bun:test';

import { signalData } from '../src/examples/signals/data';
import { deriveSignalChart } from '../src/examples/signals/derive';
import { init } from '../src/examples/signals/model';
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
  expect(deriveSignalChart(m, 'overview').frame.height).toBe(140);
});
