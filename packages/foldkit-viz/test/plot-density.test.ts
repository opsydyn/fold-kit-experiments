import { describe, expect, it } from 'bun:test';

import { randomLcg, randomNormal } from '../src/math/random';
import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';

const base = {
  width: 400,
  height: 240,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const normal = randomNormal(0, 1, randomLcg(7));
const samples = Array.from({ length: 400 }, (_, i) => ({
  value: i % 2 === 0 ? normal() : 4 + normal(),
  group: i % 2 === 0 ? 'low' : 'high',
  x: normal(),
  y: normal(),
}));
const graphics = (spec: PlotSpec): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[0]?.graphics ?? [];
const pathOf = (g: Graphic | undefined): string => (g?.kind === 'path' ? g.d : '');

describe('one-dimensional density', () => {
  const spec: PlotSpec = {
    ...base,
    data: samples,
    marks: [{ mark: 'density', x: 'value' }],
  };

  it('draws a filled curve and its outline, with density on a y axis from zero', () => {
    const plot = compilePlot(spec);
    const [fill, outline] = plot.facets[0]?.marks[0]?.graphics ?? [];
    expect(fill?.kind === 'path' ? [fill.fill, fill.stroke, fill.opacity] : []).toEqual([
      'currentColor',
      'none',
      0.3,
    ]);
    expect(outline?.kind === 'path' ? [outline.fill, outline.stroke] : []).toEqual([
      'none',
      'currentColor',
    ]);
    expect(pathOf(outline).match(/[ML]/g)?.length).toBe(128);
    const y = plot.facets[0]?.y;
    expect(y?.label).toBe('density');
    expect(y?.domain[0]).toBe(0);
    expect(Number(y?.domain[1])).toBeGreaterThan(0.1);
  });

  it('pads the x axis by three bandwidths beyond the data', () => {
    const plot = compilePlot({ ...spec, marks: [{ mark: 'density', x: 'value', bandwidth: 1 }] });
    const [lo = 0, hi = 0] = plot.facets[0]?.x?.domain ?? [];
    const values = samples.map((s) => s.value);
    expect(Number(lo)).toBeLessThanOrEqual(Math.min(...values) - 3);
    expect(Number(hi)).toBeGreaterThanOrEqual(Math.max(...values) + 3);
  });

  it('draws one curve per series, coloured by the fill field', () => {
    const drawn = graphics({
      ...base,
      data: samples,
      marks: [{ mark: 'density', x: 'value', fill: 'group' }],
    });
    expect(drawn).toHaveLength(4);
    const fills = new Set(drawn.map((g) => (g.kind === 'path' ? g.fill : '')));
    expect(fills.size).toBe(3);
  });
});

describe('two-dimensional density', () => {
  const spec: PlotSpec = {
    ...base,
    data: samples,
    marks: [{ mark: 'density', x: 'x', y: 'y', thresholds: 5, stroke: { value: '#0a0' } }],
  };

  it('draws one contour path per level, more opaque towards the centre', () => {
    const levels = graphics(spec);
    expect(levels).toHaveLength(5);
    expect(levels.every((g) => g.kind === 'path' && g.stroke === '#0a0' && g.fill === 'none')).toBe(
      true,
    );
    const opacities = levels.map((g) => g.opacity);
    expect(opacities).toEqual([...opacities].sort((a, b) => a - b));
    expect(opacities.at(-1)).toBe(1);
  });

  it('keeps every contour inside the plot area', () => {
    const numbers = graphics(spec)
      .flatMap((g) => pathOf(g).match(/-?\d+(\.\d+)?/g) ?? [])
      .map(Number);
    expect(numbers.every((n) => n >= 0 && n <= 400)).toBe(true);
  });

  it('names the spec path for a bad bandwidth or threshold count', () => {
    expect(() =>
      compilePlot({ ...spec, marks: [{ mark: 'density', x: 'x', y: 'y', bandwidth: 0 }] }),
    ).toThrow('marks[0].bandwidth: must be positive');
    expect(() =>
      compilePlot({ ...spec, marks: [{ mark: 'density', x: 'x', y: 'y', thresholds: 0.5 }] }),
    ).toThrow('marks[0].thresholds: must be a whole number of at least 1');
    expect(() =>
      compilePlot({ ...spec, marks: [{ mark: 'density', x: 'value', thresholds: 3 }] }),
    ).toThrow('marks[0].thresholds: a one-dimensional density takes no thresholds');
  });
});
