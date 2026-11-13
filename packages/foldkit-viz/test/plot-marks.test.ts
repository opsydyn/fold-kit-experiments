import { describe, expect, it } from 'bun:test';

import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';

const base = {
  width: 400,
  height: 200,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const graphics = (spec: PlotSpec, mark = 0): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[mark]?.graphics ?? [];
const sales = [
  { month: 'Jan', units: 10 },
  { month: 'Feb', units: 30 },
  { month: 'Mar', units: 20 },
];

describe('bar marks', () => {
  it('draw vertical bars from zero on a band x axis', () => {
    const plot = compilePlot({
      ...base,
      data: sales,
      marks: [{ mark: 'bar', x: 'month', y: 'units' }],
    });
    const facet = plot.facets[0];
    expect(facet?.y?.domain).toEqual([0, 30]);
    const bars = facet?.marks[0]?.graphics ?? [];
    expect(bars.map((b) => b.kind)).toEqual(['rect', 'rect', 'rect']);
    const tallest = bars[1];
    expect(tallest?.kind === 'rect' && [tallest.y, tallest.height]).toEqual([0, 200]);
    const first = bars[0];
    expect(first?.kind === 'rect' && first.y + first.height).toBeCloseTo(200);
  });

  it('draw horizontal bars when the band axis is y', () => {
    const [bar] = graphics({
      ...base,
      data: sales,
      marks: [{ mark: 'bar', x: 'units', y: 'month' }],
    });
    expect(bar?.kind === 'rect' && bar.x).toBe(0);
    expect(bar?.kind === 'rect' && bar.width).toBeCloseTo(400 / 3);
  });

  it('reach down to negative values from zero', () => {
    const [up, down] = graphics({
      ...base,
      data: [
        { k: 'a', v: 5 },
        { k: 'b', v: -5 },
      ],
      marks: [{ mark: 'bar', x: 'k', y: 'v' }],
    });
    expect(up?.kind === 'rect' && down?.kind === 'rect' && up.y + up.height).toBeCloseTo(
      down?.kind === 'rect' ? down.y : NaN,
    );
  });

  it('need exactly one band axis', () => {
    expect(() =>
      compilePlot({ ...base, data: [{ a: 1, b: 2 }], marks: [{ mark: 'bar', x: 'a', y: 'b' }] }),
    ).toThrow('marks[0]: a bar mark needs exactly one band axis');
  });
});

describe('area marks', () => {
  it('fill from zero to the line, one path per series', () => {
    const data = [
      { x: 0, y: 1, s: 'a' },
      { x: 1, y: 2, s: 'a' },
      { x: 0, y: 2, s: 'b' },
      { x: 1, y: 3, s: 'b' },
    ];
    const plot = compilePlot({ ...base, data, marks: [{ mark: 'area', x: 'x', y: 'y', z: 's' }] });
    expect(plot.facets[0]?.y?.domain).toEqual([0, 3]);
    const paths = plot.facets[0]?.marks[0]?.graphics ?? [];
    expect(paths.map((p) => p.key)).toEqual(['a', 'b']);
    expect(paths[0]?.kind === 'path' && paths[0].d.endsWith('Z')).toBe(true);
  });

  it('take an explicit lower edge', () => {
    const data = [
      { x: 0, lo: 1, hi: 3 },
      { x: 1, lo: 2, hi: 4 },
    ];
    const plot = compilePlot({
      ...base,
      data,
      marks: [{ mark: 'area', x: 'x', y: 'hi', y0: 'lo' }],
    });
    expect(plot.facets[0]?.y?.domain).toEqual([1, 4]);
  });
});

describe('rule, text and cell marks', () => {
  it('draw reference rules across the plot from constants, with no data', () => {
    const plot = compilePlot({
      ...base,
      data: sales,
      marks: [
        { mark: 'bar', x: 'month', y: 'units' },
        { mark: 'rule', y: { value: 15 }, stroke: { value: 'red' } },
      ],
    });
    const [rule] = plot.facets[0]?.marks[1]?.graphics ?? [];
    expect(rule).toMatchObject({ kind: 'line', x1: 0, x2: 400, y1: 100, y2: 100, stroke: 'red' });
  });

  it('take exactly one of x and y on a rule', () => {
    expect(() =>
      compilePlot({ ...base, marks: [{ mark: 'rule', x: { value: 1 }, y: { value: 1 } }] }),
    ).toThrow('marks[0]: a rule mark takes exactly one of x and y');
  });

  it('place labels with offsets', () => {
    const [label] = graphics({
      ...base,
      data: sales,
      marks: [{ mark: 'text', x: 'month', y: 'units', text: 'units', dy: -4, anchor: 'start' }],
    });
    expect(label).toMatchObject({ kind: 'text', text: '10', anchor: 'start' });
  });

  it('lay out heatmap cells on two band axes, coloured by value', () => {
    const data = [
      { day: 'Mon', hour: '09', n: 1 },
      { day: 'Mon', hour: '10', n: 5 },
      { day: 'Tue', hour: '09', n: 3 },
    ];
    const plot = compilePlot({
      ...base,
      data,
      marks: [{ mark: 'cell', x: 'hour', y: 'day', fill: 'n' }],
    });
    const cells = plot.facets[0]?.marks[0]?.graphics ?? [];
    expect(cells).toHaveLength(3);
    const fills = cells.map((c) => (c.kind === 'rect' ? c.fill : ''));
    expect(new Set(fills).size).toBe(3);
    expect(plot.legends[0]).toMatchObject({ kind: 'continuous', label: 'n', domain: [1, 5] });
  });

  it('need band axes for cells', () => {
    expect(() =>
      compilePlot({ ...base, data: [{ a: 1, b: 'x' }], marks: [{ mark: 'cell', x: 'a', y: 'b' }] }),
    ).toThrow('marks[0]: a cell mark needs band x and y axes');
  });

  it('reject a channel a mark does not take', () => {
    expect(() =>
      compilePlot(
        JSON.parse(
          JSON.stringify({
            ...base,
            data: sales,
            marks: [{ mark: 'line', x: 'month', y: 'units', r: 3 }],
          }),
        ),
      ),
    ).toThrow('marks[0].r: a line mark does not take r');
  });
});

it('draws a mark of constants once, even when the plot has data', () => {
  const plot = compilePlot({
    width: 200,
    height: 100,
    data: [
      { a: 'x', v: 1 },
      { a: 'y', v: 2 },
    ],
    marks: [
      { mark: 'bar', x: 'a', y: 'v' },
      { mark: 'rule', y: { value: 1 } },
    ],
  });
  expect(plot.facets[0]?.marks[1]?.graphics).toHaveLength(1);
});
