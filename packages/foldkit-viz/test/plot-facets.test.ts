import { describe, expect, it } from 'bun:test';

import { compilePlot } from '../src/plot';

const base = {
  width: 524,
  height: 300,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const rows = [
  { site: 'north', year: '2025', t: 1, v: 10 },
  { site: 'north', year: '2025', t: 2, v: 20 },
  { site: 'south', year: '2025', t: 1, v: 40 },
  { site: 'south', year: '2026', t: 2, v: 5 },
];

describe('facets', () => {
  it('split rows into side-by-side panels sharing every scale', () => {
    const plot = compilePlot({
      ...base,
      data: rows,
      facet: { x: 'site' },
      marks: [{ mark: 'dot', x: 't', y: 'v' }],
    });
    expect(plot.facets.map((f) => f.label)).toEqual(['north', 'south']);
    expect(plot.facets.map((f) => f.marks[0]?.graphics.length)).toEqual([2, 2]);
    // Both panels use the domain of all the rows, not just their own.
    expect(plot.facets.map((f) => f.y?.domain)).toEqual([
      [5, 40],
      [5, 40],
    ]);
    const [left, right] = plot.facets.map((f) => f.plot);
    expect(left?.width).toBe(250);
    expect(right?.left).toBe(274);
    // Each panel leaves room above for its heading.
    expect(left?.top).toBeGreaterThan(0);
  });

  it('lay out a grid when faceting on both axes, keeping empty panels', () => {
    const plot = compilePlot({
      ...base,
      data: rows,
      facet: { x: 'site', y: 'year' },
      marks: [{ mark: 'dot', x: 't', y: 'v' }],
    });
    expect(plot.facets.map((f) => f.label)).toEqual([
      'north · 2025',
      'south · 2025',
      'north · 2026',
      'south · 2026',
    ]);
    expect(plot.facets.map((f) => f.marks[0]?.graphics.length)).toEqual([2, 1, 0, 1]);
    const keys = plot.facets.map((f) => f.key);
    expect(new Set(keys).size).toBe(4);
  });

  it('repeat a mark whose rows lack the facet field in every panel', () => {
    const plot = compilePlot({
      ...base,
      facet: { x: 'site' },
      marks: [
        { mark: 'dot', data: rows, x: 't', y: 'v' },
        { mark: 'rule', y: { value: 15 } },
      ],
    });
    expect(plot.facets.map((f) => f.marks[1]?.graphics.length)).toEqual([1, 1]);
  });

  it('reject a facet field no mark has, and a plot too small for its panels', () => {
    expect(() =>
      compilePlot({
        ...base,
        data: rows,
        facet: { x: 'region' },
        marks: [{ mark: 'dot', x: 't', y: 'v' }],
      }),
    ).toThrow('facet.x: field "region" is missing from the data');
    expect(() =>
      compilePlot({
        width: 20,
        height: 300,
        data: rows,
        facet: { x: 'site' },
        margins: { left: 0, right: 0 },
        marks: [{ mark: 'dot', x: 't', y: 'v' }],
      }),
    ).toThrow('facet: the plot is too small for this many facets');
  });
});
