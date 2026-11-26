import { expect, it } from 'bun:test';

import { compilePlot, sharePlotScales, type PlotSpec } from '../src/plot';

const days = [Date.UTC(2026, 10, 21), Date.UTC(2026, 10, 23)] as const;
const frame = { width: 400, height: 260 };

it('aligns dates and series across independently sized plots with independent y scales', () => {
  const share = sharePlotScales({
    x: { type: 'time', domain: days },
    color: { type: 'categorical', domain: ['Checkout', 'Search'], range: ['#123456', '#654321'] },
  });
  const overview = compilePlot(
    share({
      ...frame,
      data: [
        { day: days[0], latency: 120, service: 'Checkout' },
        { day: days[1], latency: 230, service: 'Search' },
      ],
      x: { label: 'Day' },
      y: { label: 'Latency (ms)', domain: [0, 250] },
      marks: [{ mark: 'dot', x: 'day', y: 'latency', fill: 'service' }],
    }),
  );
  const detail = compilePlot(
    share({
      ...frame,
      width: 300,
      data: [{ day: days[1], failures: 0.02, service: 'Search' }],
      x: { label: 'Reporting day', grid: false },
      y: { label: 'Failure rate', domain: [0, 0.1] },
      marks: [{ mark: 'dot', x: 'day', y: 'failures', fill: 'service' }],
    }),
  );
  expect(overview.facets[0]?.x).toMatchObject({ type: 'time', domain: days, label: 'Day' });
  expect(detail.facets[0]?.x).toMatchObject({
    type: 'time',
    domain: days,
    label: 'Reporting day',
    grid: false,
  });
  expect(detail.facets[0]?.x?.range).not.toEqual(overview.facets[0]?.x?.range);
  expect(overview.facets[0]?.y).toMatchObject({ domain: [0, 250], label: 'Latency (ms)' });
  expect(detail.facets[0]?.y).toMatchObject({ domain: [0, 0.1], label: 'Failure rate' });
  expect(overview.facets[0]?.marks[0]?.graphics[1]).toMatchObject({ fill: '#654321' });
  expect(detail.facets[0]?.marks[0]?.graphics[0]).toMatchObject({ fill: '#654321' });
});

it('accepts equivalent explicit scales and names a conflict without mutating the input plot', () => {
  const share = sharePlotScales({ x: { type: 'time', domain: days } });
  const plot: PlotSpec = { ...frame, x: { type: 'time', domain: [...days] }, marks: [] };
  expect(share(plot)).toEqual(plot);
  const conflicting: PlotSpec = { ...plot, x: { ...plot.x, domain: [0, 3] } };
  expect(() => share(conflicting)).toThrow('x.domain: conflicts with the shared scale');
  expect(conflicting.x?.domain).toEqual([0, 3]);
});
