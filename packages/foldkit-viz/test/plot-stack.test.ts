import { describe, expect, it } from 'bun:test';

import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';

const base = {
  width: 300,
  height: 200,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const sales = [
  { month: 'Jan', region: 'north', units: 2 },
  { month: 'Jan', region: 'south', units: 3 },
  { month: 'Feb', region: 'north', units: 4 },
  { month: 'Feb', region: 'south', units: 1 },
];
const graphics = (spec: PlotSpec): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[0]?.graphics ?? [];
const rects = (spec: PlotSpec) => graphics(spec).flatMap((g) => (g.kind === 'rect' ? [g] : []));
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe('stacked bars', () => {
  const spec: PlotSpec = {
    ...base,
    data: sales,
    marks: [{ mark: 'bar', x: 'month', y: 'units', fill: 'region', stack: 'zero' }],
  };

  it('stacks each series on the last within its band, covering the total', () => {
    const plot = compilePlot(spec);
    expect(plot.facets[0]?.y?.domain).toEqual([0, 5]);
    const [janNorth, janSouth] = rects(spec);
    expect(janNorth?.x).toBe(janSouth?.x ?? Number.NaN);
    // North sits on the axis; south sits on north.
    expect(near((janNorth?.y ?? 0) + (janNorth?.height ?? 0), 200)).toBe(true);
    expect(near((janSouth?.y ?? 0) + (janSouth?.height ?? 0), janNorth?.y ?? 0)).toBe(true);
    expect(near(janSouth?.height ?? 0, (200 * 3) / 5)).toBe(true);
  });

  it('stacks negative values down from zero, for diverging charts', () => {
    const plot = compilePlot({
      ...spec,
      data: [
        { q: 'A', answer: 'disagree', share: -0.3 },
        { q: 'A', answer: 'strongly disagree', share: -0.2 },
        { q: 'A', answer: 'agree', share: 0.4 },
      ],
      marks: [{ mark: 'bar', x: 'share', y: 'q', fill: 'answer', stack: 'zero' }],
    });
    expect(plot.facets[0]?.x?.domain).toEqual([-0.5, 0.4]);
    const [disagree, strongly, agree] = plot.facets[0]?.marks[0]?.graphics ?? [];
    const right = (g: Graphic | undefined) => (g?.kind === 'rect' ? g.x + g.width : Number.NaN);
    const left = (g: Graphic | undefined) => (g?.kind === 'rect' ? g.x : Number.NaN);
    expect(near(right(strongly), left(disagree))).toBe(true);
    expect(near(right(disagree), left(agree))).toBe(true);
  });

  it('normalises each stack to one', () => {
    const plot = compilePlot({
      ...spec,
      marks: [{ mark: 'bar', x: 'month', y: 'units', fill: 'region', stack: 'normalize' }],
    });
    expect(plot.facets[0]?.y?.domain).toEqual([0, 1]);
    const heights = rects({
      ...spec,
      marks: [{ mark: 'bar', x: 'month', y: 'units', fill: 'region', stack: 'normalize' }],
    }).map((r) => r.height);
    expect(near((heights[0] ?? 0) + (heights[1] ?? 0), 200)).toBe(true);
  });

  it('orders series by total when asked', () => {
    const descending = rects({
      ...spec,
      marks: [
        {
          mark: 'bar',
          x: 'month',
          y: 'units',
          fill: 'region',
          stack: { offset: 'zero', order: 'descending' },
        },
      ],
    });
    // North (6 units) is larger than south (4), so north sits on the axis.
    const janNorth = descending.find((r) => r.key === '0:0');
    expect(near((janNorth?.y ?? 0) + (janNorth?.height ?? 0), 200)).toBe(true);
  });
});

describe('grouped bars', () => {
  it('places each series side by side within its band', () => {
    const [janNorth, janSouth, febNorth] = rects({
      ...base,
      data: sales,
      marks: [{ mark: 'bar', x: 'month', y: 'units', fill: 'region', group: true }],
    });
    expect(near(janNorth?.width ?? 0, janSouth?.width ?? 0)).toBe(true);
    expect(near((janNorth?.x ?? 0) + (janNorth?.width ?? 0), janSouth?.x ?? 0)).toBe(true);
    expect(near(febNorth?.width ?? 0, janNorth?.width ?? 0)).toBe(true);
    expect(febNorth?.x).toBeGreaterThan(janSouth?.x ?? 0);
  });
});

describe('stacked areas', () => {
  const flows = [
    { t: 0, kind: 'a', v: 1 },
    { t: 1, kind: 'a', v: 2 },
    { t: 0, kind: 'b', v: 3 },
    { t: 1, kind: 'b', v: 1 },
    { t: 2, kind: 'b', v: 2 },
  ];

  it('stacks at each x, counting a missing series as zero', () => {
    const plot = compilePlot({
      ...base,
      data: flows,
      marks: [{ mark: 'area', x: 't', y: 'v', fill: 'kind', stack: 'zero' }],
    });
    expect(plot.facets[0]?.y?.domain).toEqual([0, 4]);
    expect(plot.facets[0]?.marks[0]?.graphics).toHaveLength(2);
  });

  it('centres a streamgraph around a moving baseline', () => {
    const plot = compilePlot({
      ...base,
      data: flows,
      marks: [{ mark: 'area', x: 't', y: 'v', fill: 'kind', stack: 'wiggle' }],
    });
    const [lo = 0] = plot.facets[0]?.y?.domain ?? [];
    expect(Number(lo)).toBeLessThan(0);
  });
});

describe('stack and group errors name the spec path', () => {
  it.each([
    [
      'stacking and grouping together',
      { mark: 'bar', x: 'month', y: 'units', fill: 'region', stack: 'zero', group: true },
      'marks[0].group: a bar mark cannot both stack and group',
    ],
    [
      'grouping without series',
      { mark: 'bar', x: 'month', y: 'units', group: true },
      'marks[0].group: needs a z or fill field to group by',
    ],
    [
      'a streamgraph offset on bars',
      { mark: 'bar', x: 'month', y: 'units', fill: 'region', stack: 'wiggle' },
      'marks[0].stack: center and wiggle offsets stack areas only',
    ],
    [
      'an unknown offset',
      { mark: 'area', x: 'month', y: 'units', stack: 'sideways' },
      'marks[0].stack: unknown offset "sideways"',
    ],
    [
      'an unknown order',
      { mark: 'area', x: 'month', y: 'units', stack: { order: 'random' } },
      'marks[0].stack.order: unknown order "random"',
    ],
    [
      'a stack with its own start',
      { mark: 'bar', x: 'month', y: 'units', y0: { value: 1 }, stack: 'zero' },
      'marks[0].stack: a stacked bar takes no x0 or y0',
    ],
  ])('rejects %s', (_, mark, message) => {
    // A spec arrives as JSON, so the invalid ones are parsed as any JSON would be.
    const parsed: PlotSpec = JSON.parse(JSON.stringify({ ...base, data: sales, marks: [mark] }));
    expect(() => compilePlot(parsed)).toThrow(message);
  });
});
