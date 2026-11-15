import { describe, expect, it } from 'bun:test';

import { colorScale, interpolateRgbBasis } from '../src/math/color';
import * as schemes from '../src/math/schemes';
import { tableau10, viridis, wong } from '../src/math/schemes';
import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec, SchemeName } from '../src/plot';

const base = {
  width: 300,
  height: 200,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const rows = [
  { x: 1, y: 1, kind: 'alpha', size: 4, score: 0 },
  { x: 2, y: 2, kind: 'beta', size: 16, score: 50 },
  { x: 3, y: 3, kind: 'alpha', size: 0, score: 100 },
];
const graphics = (spec: PlotSpec): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[0]?.graphics ?? [];
const fillOf = (g: Graphic | undefined): string => (g !== undefined && 'fill' in g ? g.fill : '');
const [tableauFirst = '', tableauSecond = ''] = tableau10;
const [wongFirst = '', wongSecond = ''] = wong;

describe('categorical colour', () => {
  const spec: PlotSpec = {
    ...base,
    data: rows,
    marks: [{ mark: 'dot', x: 'x', y: 'y', fill: 'kind' }],
  };

  it('paints strings from tableau10 in first-seen order, with a legend', () => {
    expect(graphics(spec).map(fillOf)).toEqual([tableauFirst, tableauSecond, tableauFirst]);
    expect(compilePlot(spec).legends).toEqual([
      {
        kind: 'categorical',
        label: 'kind',
        entries: [
          { key: 'alpha', label: 'alpha', color: tableauFirst },
          { key: 'beta', label: 'beta', color: tableauSecond },
        ],
      },
    ]);
  });

  it('follows an explicit domain and scheme, and can hide the legend', () => {
    const plot = compilePlot({
      ...spec,
      color: { domain: ['beta', 'alpha'], scheme: 'wong', legend: false },
    });
    expect((plot.facets[0]?.marks[0]?.graphics ?? []).map(fillOf)).toEqual([
      wongSecond,
      wongFirst,
      wongSecond,
    ]);
    expect(plot.legends).toEqual([]);
  });

  it('colours each line series by its stroke field', () => {
    const lines = graphics({
      ...base,
      data: rows,
      marks: [{ mark: 'line', x: 'x', y: 'y', stroke: 'kind' }],
    });
    expect(lines.map((l) => l.key)).toEqual(['alpha', 'beta']);
    expect(lines.map((l) => (l.kind === 'path' ? l.stroke : ''))).toEqual([
      tableauFirst,
      tableauSecond,
    ]);
  });

  it('rejects an unknown scheme, which a spec from outside TypeScript can still name', () => {
    const fromJson = JSON.parse(JSON.stringify({ ...spec, color: { scheme: 'rainbow' } }));
    expect(() => compilePlot(fromJson)).toThrow('color.scheme: unknown scheme "rainbow"');
  });
});

describe('continuous colour', () => {
  it('paints numbers on viridis by default, with a gradient legend', () => {
    const plot = compilePlot({
      ...base,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', fill: 'score' }],
    });
    const expected = colorScale({ domain: [0, 100], interpolator: interpolateRgbBasis(viridis) });
    const fills = (plot.facets[0]?.marks[0]?.graphics ?? []).map(fillOf);
    expect(fills).toEqual([expected(0), expected(50), expected(100)]);
    const legend = plot.legends[0];
    expect(legend?.kind).toBe('continuous');
    expect(legend?.kind === 'continuous' && legend.domain).toEqual([0, 100]);
    expect(legend?.kind === 'continuous' && legend.stops).toHaveLength(9);
  });

  it('centres a diverging scale on zero', () => {
    const data = [
      { x: 1, y: 1, d: -10 },
      { x: 2, y: 2, d: 0 },
      { x: 3, y: 3, d: 30 },
    ];
    const plot = compilePlot({
      ...base,
      data,
      color: { type: 'diverging' },
      marks: [{ mark: 'dot', x: 'x', y: 'y', fill: 'd' }],
    });
    const legend = plot.legends[0];
    expect(legend?.kind === 'continuous' && legend.domain).toEqual([-10, 30]);
  });
});

describe('size', () => {
  it('maps r through a square-root scale from zero to the largest value', () => {
    const radii = graphics({
      ...base,
      data: rows,
      r: { range: [0, 8] },
      marks: [{ mark: 'dot', x: 'x', y: 'y', r: 'size' }],
    }).map((g) => (g.kind === 'circle' ? g.r : NaN));
    expect(radii).toEqual([4, 8, 0]);
  });
});

describe('scheme names', () => {
  it('name every scheme math/schemes exports, and no other', () => {
    const names = [
      'tableau10',
      'category10',
      'dark2',
      'set1',
      'blues',
      'greens',
      'reds',
      'oranges',
      'purples',
      'rdBu',
      'spectral',
      'rdYlGn',
      'brBG',
      'wong',
      'ibmCarbon',
      'tolMuted',
      'viridis',
      'magma',
      'inferno',
      'plasma',
      'cividis',
    ] as const satisfies ReadonlyArray<SchemeName>;
    // Fails to compile if SchemeName gains a name this list lacks.
    const exhaustive: Exclude<SchemeName, (typeof names)[number]> extends never ? true : false =
      true;
    expect(exhaustive).toBe(true);
    const exported = Object.entries(schemes)
      .filter(([, value]) => Array.isArray(value))
      .map(([name]) => name);
    expect(exported.sort()).toEqual([...names].sort());
  });
});
