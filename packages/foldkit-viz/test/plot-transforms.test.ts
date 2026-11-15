import { describe, expect, it } from 'bun:test';

import { linearRegression } from '../src/math/regression';
import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';

const base = {
  width: 400,
  height: 200,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const points = [
  { x: 1, y: 2, g: 'a' },
  { x: 2, y: 4, g: 'a' },
  { x: 3, y: 5, g: 'a' },
  { x: 4, y: 4, g: 'a' },
  { x: 5, y: 5, g: 'a' },
];
const graphics = (spec: PlotSpec, mark = 0, facet = 0): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[facet]?.marks[mark]?.graphics ?? [];
const pathOf = (g: Graphic | undefined): string => (g?.kind === 'path' ? g.d : '');
const firstPoint = (d: string): readonly [number, number] => {
  const [x, y] = (d.match(/^M([-\d.e]+),([-\d.e]+)/) ?? []).slice(1).map(Number);
  return [x ?? NaN, y ?? NaN];
};

describe('regression', () => {
  const spec: PlotSpec = {
    ...base,
    data: points,
    marks: [
      { mark: 'dot', x: 'x', y: 'y' },
      { mark: 'line', x: 'x', y: 'y', transform: { type: 'regression' } },
    ],
  };

  it('draws the band behind the fitted line, and widens the y domain to hold the band', () => {
    const [band, fit] = graphics(spec, 1);
    expect(band?.key).toBe('all:band');
    expect(band?.kind === 'path' && band.opacity).toBeCloseTo(0.2);
    expect(fit?.key).toBe('all');
    const domain = compilePlot(spec).facets[0]?.y?.domain;
    expect(Number(domain?.[0])).toBeLessThan(2);
  });

  it('starts the line at the fit at the smallest x', () => {
    const plot = compilePlot(spec);
    const facet = plot.facets[0];
    const fit = linearRegression(points, { x: (p) => p.x, y: (p) => p.y });
    const [, fitted] = facet?.marks[1]?.graphics ?? [];
    const [, y0] = firstPoint(pathOf(fitted));
    const lo = Number(facet?.y?.domain[0]);
    const hi = Number(facet?.y?.domain[1]);
    const expected = 200 - ((fit.predict(1) - lo) / (hi - lo)) * 200;
    expect(y0).toBeCloseTo(expected, 3);
  });

  it('omits the band on request', () => {
    const lines = graphics({
      ...spec,
      marks: [{ mark: 'line', x: 'x', y: 'y', transform: { type: 'regression', band: false } }],
    });
    expect(lines.map((l) => l.key)).toEqual(['all']);
  });

  it('fits each series and each facet on its own', () => {
    const data = [...points, ...points.map((p) => ({ ...p, y: p.y * 10, g: 'b' }))];
    const bySeries = graphics({
      ...base,
      data,
      marks: [
        {
          mark: 'line',
          x: 'x',
          y: 'y',
          stroke: 'g',
          transform: { type: 'regression', band: false },
        },
      ],
    });
    expect(bySeries.map((l) => l.key)).toEqual(['a', 'b']);
    const plot = compilePlot({
      ...base,
      width: 600,
      data,
      facet: { x: 'g' },
      marks: [{ mark: 'line', x: 'x', y: 'y', transform: { type: 'regression', band: false } }],
    });
    expect(plot.facets.map((f) => f.marks[0]?.graphics.length)).toEqual([1, 1]);
  });
});

describe('smoothing and downsampling', () => {
  const wave = Array.from({ length: 50 }, (_, i) => ({
    t: i,
    v: Math.sin(i / 5) + (i % 2 === 0 ? 0.5 : -0.5),
  }));

  it('smooths with LOESS into one path', () => {
    const [curve] = graphics({
      ...base,
      data: wave,
      marks: [{ mark: 'line', x: 't', y: 'v', transform: { type: 'loess', bandwidth: 0.3 } }],
    });
    expect(pathOf(curve).startsWith('M')).toBe(true);
  });

  it('smooths with a moving window, breaking where windows are incomplete', () => {
    const [line] = graphics({
      ...base,
      data: wave,
      marks: [
        {
          mark: 'line',
          x: 't',
          y: 'v',
          transform: { type: 'window', size: 5, reduce: 'mean', anchor: 'centre' },
        },
      ],
    });
    // The centred window is incomplete for the first two rows, so the line starts at the third.
    const [x0] = firstPoint(pathOf(line));
    expect(x0).toBeCloseTo((2 / 49) * 400, 3);
  });

  it('downsamples a long series to the plot width, keeping a time axis', () => {
    const start = Date.UTC(2026, 0, 1);
    const long = Array.from({ length: 20_000 }, (_, i) => ({
      t: new Date(start + i * 60_000).toISOString(),
      v: Math.sin(i / 300),
    }));
    const plot = compilePlot({
      ...base,
      width: 200,
      data: long,
      marks: [{ mark: 'line', x: 't', y: 'v', transform: { type: 'downsample', method: 'm4' } }],
    });
    expect(plot.facets[0]?.x?.type).toBe('time');
    const d = pathOf(plot.facets[0]?.marks[0]?.graphics[0]);
    const vertices = (d.match(/[ML]/g) ?? []).length;
    expect(vertices).toBeLessThanOrEqual(4 * 200);
    expect(vertices).toBeGreaterThan(100);
  });

  it('rejects a transform a mark cannot take', () => {
    expect(() =>
      compilePlot(
        JSON.parse(
          JSON.stringify({
            ...base,
            data: points,
            marks: [{ mark: 'dot', x: 'x', y: 'y', transform: { type: 'loess' } }],
          }),
        ),
      ),
    ).toThrow('marks[0].transform.type: a dot mark cannot take a loess transform');
  });
});

describe('transform chains', () => {
  it('apply in order: a moving window, then a downsample to the plot width', () => {
    const long = Array.from({ length: 10_000 }, (_, i) => ({
      t: i,
      v: Math.sin(i / 200) + (i % 2),
    }));
    const spec: PlotSpec = {
      ...base,
      width: 200,
      data: long,
      marks: [
        {
          mark: 'line',
          x: 't',
          y: 'v',
          transform: [
            { type: 'window', size: 9, reduce: 'mean', anchor: 'centre' },
            { type: 'downsample', method: 'm4' },
          ],
        },
      ],
    };
    const d = pathOf(graphics(spec)[0]);
    expect((d.match(/[ML]/g) ?? []).length).toBeLessThanOrEqual(800);
    // The window evened out the alternating 0 / 1 offset, so the line stays near the wave.
    const domain = compilePlot(spec).facets[0]?.y?.domain;
    expect(Number(domain?.[1])).toBeLessThan(1.6);
  });

  it('name the failing step', () => {
    expect(() =>
      compilePlot(
        JSON.parse(
          JSON.stringify({
            ...base,
            data: points,
            marks: [
              {
                mark: 'area',
                x: 'x',
                y: 'y',
                transform: [{ type: 'window', size: 2, reduce: 'mean' }, { type: 'loess' }],
              },
            ],
          }),
        ),
      ),
    ).toThrow('marks[0].transform[1].type: an area mark cannot take a loess transform');
  });
});
