import { describe, expect, it } from 'bun:test';

import { compilePlot, indexPlot, invertPlot, pointerToPlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';

const base = {
  width: 400,
  height: 200,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const rows = [
  { id: 'a', x: 0, y: 0, kind: 'p', when: '2026-01-01' },
  { id: 'b', x: 5, y: 50, kind: 'q', when: '2026-06-01' },
  { id: 'c', x: 10, y: 100, kind: 'p', when: '2026-12-01' },
];

describe('pointer and pixels', () => {
  it('scales a client position through the rendered size', () => {
    const geometry = compilePlot({ ...base, data: rows, marks: [{ mark: 'dot', x: 'x', y: 'y' }] });
    expect(
      pointerToPlot({ x: 150, y: 70 }, { left: 50, top: 20, width: 200, height: 100 }, geometry),
    ).toEqual({ x: 200, y: 100 });
  });

  it('inverts pixels to data on each scale type', () => {
    const at = (spec: PlotSpec, x: number, y: number) => invertPlot(compilePlot(spec), x, y);
    expect(
      at({ ...base, data: rows, marks: [{ mark: 'dot', x: 'x', y: 'y' }] }, 200, 100),
    ).toMatchObject({ x: 5, y: 50 });
    const log = at(
      {
        ...base,
        data: rows.slice(1),
        y: { type: 'log', domain: [1, 100] },
        marks: [{ mark: 'dot', x: 'x', y: 'y' }],
      },
      0,
      100,
    );
    expect(Number(log?.y)).toBeCloseTo(10, 9);
    const band = at({ ...base, data: rows, marks: [{ mark: 'dot', x: 'kind', y: 'y' }] }, 300, 100);
    expect(band?.x).toBe('q');
    expect(
      at({ ...base, data: rows, marks: [{ mark: 'dot', x: 'x', y: 'y' }] }, 500, 100),
    ).toBeUndefined();
  });

  it.each([
    ['symlog', { type: 'symlog' } as const],
    ['power', { type: 'pow', exponent: 0.5 } as const],
  ])('round-trips a %s axis', (_, x) => {
    const geometry = compilePlot({
      ...base,
      data: [
        { v: 0, y: 0 },
        { v: 37, y: 1 },
        { v: 1000, y: 2 },
      ],
      x,
      marks: [{ mark: 'dot', x: 'v', y: 'y' }],
    });
    const [, dot] = geometry.facets[0]?.marks[0]?.graphics ?? [];
    const px = dot?.kind === 'circle' ? dot.cx : NaN;
    expect(Number(invertPlot(geometry, px, 100)?.x)).toBeCloseTo(37, 6);
  });
});

describe('nearest marks', () => {
  const geometry = compilePlot({
    ...base,
    data: rows,
    marks: [{ mark: 'dot', x: 'x', y: 'y', key: 'id' }],
  });
  const index = indexPlot(geometry);

  it('finds the closest dot within the radius, by key', () => {
    expect(index.nearest(205, 102)).toMatchObject({ key: 'b', mark: 0, x: 200, y: 100 });
    expect(index.nearest(300, 50, 10)).toBeUndefined();
  });

  it('names the row of a dense point', () => {
    const dense = compilePlot({
      ...base,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
    });
    expect(indexPlot(dense).nearest(398, 2)?.row).toBe(2);
  });

  it('indexes a million points and answers within a frame', () => {
    const big = Array.from({ length: 1_000_000 }, (_, i) => ({
      x: Math.sin(i * 0.7) * 50,
      y: Math.cos(i * 1.3) * 50,
    }));
    const plot = compilePlot({
      width: 800,
      height: 600,
      data: big,
      marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
    });
    const built = performance.now();
    const large = indexPlot(plot);
    const buildMs = performance.now() - built;
    expect(large.size).toBe(1_000_000);
    const queried = performance.now();
    for (let q = 0; q < 1_000; q += 1) large.nearest(100 + (q % 600), 50 + (q % 500), 12);
    const perQuery = (performance.now() - queried) / 1_000;
    expect(buildMs).toBeLessThan(2_000);
    expect(perQuery).toBeLessThan(4);
  });
});

describe('highlights', () => {
  const opacities = (g: ReadonlyArray<Graphic>) => g.map((x) => x.opacity);

  it('dim rows outside a numeric range', () => {
    const plot = compilePlot({
      ...base,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', highlight: { field: 'x', range: [4, 10] } }],
    });
    expect(opacities(plot.facets[0]?.marks[0]?.graphics ?? [])).toEqual([0.15, 1, 1]);
  });

  it('match ISO dates as instants, and listed values', () => {
    const dates = compilePlot({
      ...base,
      data: rows,
      marks: [
        {
          mark: 'dot',
          x: 'x',
          y: 'y',
          highlight: { field: 'when', range: ['2026-03-01', '2026-12-31'] },
        },
      ],
    });
    expect(opacities(dates.facets[0]?.marks[0]?.graphics ?? [])).toEqual([0.15, 1, 1]);
    const listed = compilePlot({
      ...base,
      data: rows,
      marks: [{ mark: 'bar', x: 'id', y: 'y', highlight: { field: 'kind', values: ['q'] } }],
    });
    expect(opacities(listed.facets[0]?.marks[0]?.graphics ?? [])).toEqual([0.15, 1, 0.15]);
  });

  it('flag dimmed points in a dense mark', () => {
    const plot = compilePlot({
      ...base,
      data: rows,
      marks: [
        { mark: 'dot', x: 'x', y: 'y', dense: true, highlight: { field: 'kind', values: ['p'] } },
      ],
    });
    const [packed] = plot.facets[0]?.marks[0]?.graphics ?? [];
    expect(packed?.kind === 'points' ? [...(packed.dimmed ?? [])] : []).toEqual([0, 1, 0]);
  });

  it('name the path of a missing field', () => {
    expect(() =>
      compilePlot({
        ...base,
        data: rows,
        marks: [{ mark: 'dot', x: 'x', y: 'y', highlight: { field: 'colour', values: [] } }],
      }),
    ).toThrow('marks[0].highlight.field: field "colour" is missing from the data');
  });
});
