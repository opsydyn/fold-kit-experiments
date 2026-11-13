import { describe, expect, it } from 'bun:test';

import { lineGeometry, scatterGeometry } from '../src/chart/cartesian';
import { axisTicks, chartLayout, resolveDomain } from '../src/chart/layout';
import { lightTheme } from '../src/chart/theme';
import { axis } from '../src/foldkit/cartesian';
import { linear, sqrt } from '../src/math/scale';
import { timeTickFormat } from '../src/math/time';
import { renderChart } from './render-chart';

const frame = { width: 200, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } };
type Row = Readonly<{ id: string; x: number; y: number; series?: string }>;
const accessors = {
  x: (d: Row) => d.x,
  y: (d: Row) => d.y,
  datumKey: (d: Row) => d.id,
  seriesKey: (d: Row) => d.series ?? 'all',
};
const close = (actual: number | undefined, expected: number): void => {
  expect(Math.abs((actual ?? Number.NaN) - expected)).toBeLessThan(1e-9);
};

describe('linear axes, the default', () => {
  const data: ReadonlyArray<Row> = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 10, y: 1000 },
  ];

  it('projects exactly as before and reports a linear scale', () => {
    const geometry = scatterGeometry(data, accessors, { frame });
    expect(geometry.layout.xScale).toEqual({ type: 'linear' });
    expect(geometry.layout.yScale).toEqual({ type: 'linear' });
    const x = linear({ domain: [0, 10], range: [0, 200] });
    expect(geometry.points.map((p) => p.x)).toEqual([x(0), x(10)]);
  });

  it('labels ticks with grouping and as many decimals as the step needs', () => {
    const geometry = scatterGeometry(data, accessors, { frame });
    expect(geometry.yTicks.map((t) => t.label)).toEqual(['0', '200', '400', '600', '800', '1,000']);
    const fine = axisTicks([0, 1], linear({ domain: [0, 1], range: [0, 100] }), 5);
    expect(fine.map((t) => t.label)).toEqual(['0.0', '0.2', '0.4', '0.6', '0.8', '1.0']);
    const negative = axisTicks([-1000, 0], linear({ domain: [-1000, 0], range: [0, 100] }), 2);
    expect(negative.map((t) => t.label)).toEqual(['-1,000', '-500', '0']);
  });
});

describe('log axes', () => {
  const data: ReadonlyArray<Row> = [
    { id: 'a', x: 0, y: 1 },
    { id: 'b', x: 1, y: 10 },
    { id: 'c', x: 2, y: 100 },
  ];
  const config = { frame, yScale: { type: 'log' } as const };

  it('places each power of the base an equal distance apart', () => {
    const geometry = scatterGeometry(data, accessors, config);
    const [a, b, c] = geometry.points.map((p) => p.y);
    close((a ?? 0) - (b ?? 0), (b ?? 0) - (c ?? 0));
    expect(geometry.layout.yScale).toEqual({ type: 'log' });
  });

  it('ticks and labels the powers of the base', () => {
    const geometry = scatterGeometry(data, accessors, config);
    expect(geometry.yTicks.map((t) => t.value)).toEqual([1, 10, 100]);
    expect(geometry.yTicks.map((t) => t.label)).toEqual(['1', '10', '100']);
    const wide = axisTicks([1, 1e6], (v) => v, 5, { type: 'log' });
    expect(wide.map((t) => t.label)).toEqual(['1', '10', '100', '1k', '10k', '100k', '1M']);
  });

  it('uses whole multiples when fewer than two powers fit, labelling only the powers', () => {
    const ticks = axisTicks([2, 30], (v) => v, 5, { type: 'log' });
    expect(ticks.map((t) => t.value)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30]);
    expect(ticks.filter((t) => t.label !== '').map((t) => t.value)).toEqual([10]);
  });

  it('omits non-positive values the way it omits non-finite ones, breaking lines', () => {
    const rows: ReadonlyArray<Row> = [
      { id: 'a', x: 0, y: 1 },
      { id: 'b', x: 1, y: 0 },
      { id: 'c', x: 2, y: -5 },
      { id: 'd', x: 3, y: 10 },
      { id: 'e', x: 4, y: 100 },
    ];
    const geometry = lineGeometry(rows, accessors, config);
    expect(geometry.points.map((p) => p.key)).toEqual(['a', 'd', 'e']);
    expect(geometry.layout.yDomain).toEqual([1, 100]);
    expect(geometry.series[0]?.path.match(/M/g)).toHaveLength(2);
  });

  it('spans one base either side of a single value', () => {
    expect(resolveDomain([5], undefined, false, { type: 'log' })).toEqual([0.5, 50]);
    expect(resolveDomain([], undefined, false, { type: 'log' })).toEqual([1, 10]);
  });

  it.each([
    ['an explicit domain touching zero', { yDomain: [0, 100] as const }],
    ['an explicit negative domain', { yDomain: [-100, -1] as const }],
    ['including zero', { includeZero: { x: false, y: true } }],
    ['a base of one', { yScale: { type: 'log', base: 1 } as const }],
  ])('rejects %s', (_, extra) => {
    expect(() => scatterGeometry(data, accessors, { ...config, ...extra })).toThrow(RangeError);
  });
});

describe('symlog and power axes', () => {
  it('projects symlog symmetrically through zero', () => {
    const data: ReadonlyArray<Row> = [
      { id: 'n', x: -100, y: 0 },
      { id: 'z', x: 0, y: 0 },
      { id: 'p', x: 100, y: 0 },
      { id: 'q', x: 10, y: 0 },
    ];
    const geometry = scatterGeometry(data, accessors, {
      frame,
      xScale: { type: 'symlog' },
      xDomain: [-100, 100],
    });
    const [n, z, p, q] = geometry.points.map((point) => point.x);
    close(z, 100);
    close((z ?? 0) - (n ?? 0), (p ?? 0) - (z ?? 0));
    // Symlog compresses: 10 sits well past a tenth of the way from 0 to 100.
    expect(((q ?? 0) - 100) / 100).toBeGreaterThan(0.4);
  });

  it('matches the square-root scale at exponent one half', () => {
    const data: ReadonlyArray<Row> = [0, 1, 4, 9, 16].map((v) => ({ id: String(v), x: v, y: 0 }));
    const geometry = scatterGeometry(data, accessors, {
      frame,
      xScale: { type: 'pow', exponent: 0.5 },
      xDomain: [0, 16],
    });
    const expected = sqrt({ domain: [0, 16], range: [0, 200] });
    geometry.points.forEach((point, index) => close(point.x, expected(data[index]?.x ?? 0)));
  });

  it('projects equal explicit endpoints to the middle on every scale', () => {
    for (const scale of [
      { type: 'log' },
      { type: 'symlog' },
      { type: 'pow', exponent: 2 },
      { type: 'time' },
    ] as const) {
      const layout = chartLayout(frame, [5, 5], [0, 1], { x: scale });
      expect(layout.x(5)).toBe(100);
    }
  });
});

describe('time axes', () => {
  const hour = 3_600_000;
  const start = Date.UTC(2026, 10, 13, 12, 47);
  const data: ReadonlyArray<Row> = [0, 1, 2, 3, 4, 5].map((i) => ({
    id: String(i),
    x: start + i * hour,
    y: i,
  }));

  it('defaults to UTC: ticks fall on UTC boundaries with UTC labels, whatever the machine zone', () => {
    const geometry = scatterGeometry(data, accessors, {
      frame,
      xScale: { type: 'time' },
      xTickCount: 5,
    });
    expect(geometry.layout.xScale).toEqual({ type: 'time' });
    expect(geometry.xTicks.length).toBeGreaterThan(1);
    for (const tick of geometry.xTicks) {
      expect(tick.value % hour).toBe(0);
      const date = new Date(tick.value);
      const expected = `${String(date.getUTCHours()).padStart(2, '0')}:00`;
      expect(tick.label).toBe(expected);
    }
  });

  it('keeps local time when asked for it', () => {
    const geometry = scatterGeometry(data, accessors, {
      frame,
      xScale: { type: 'time', zone: 'local' },
      xTickCount: 5,
    });
    expect(geometry.xTicks.length).toBeGreaterThan(1);
    for (const tick of geometry.xTicks)
      expect(tick.label).toBe(timeTickFormat(new Date(tick.value)));
  });
});

it('the FoldKit axis draws tick labels when no format is given', async () => {
  const geometry = scatterGeometry(
    [
      { id: 'a', x: 1, y: 1 },
      { id: 'b', x: 1000, y: 2 },
    ],
    accessors,
    {
      frame: { ...frame, margins: { top: 10, right: 10, bottom: 30, left: 40 } },
      xScale: { type: 'log' },
    },
  );
  const html = await renderChart((h) =>
    axis(h, {
      layout: geometry.layout,
      orientation: 'bottom',
      ticks: geometry.xTicks,
      label: 'Requests',
      theme: lightTheme,
    }),
  );
  for (const label of ['>1<', '>10<', '>100<', '>1k<']) expect(html).toContain(label);
});
