import { describe, expect, it } from 'bun:test';

import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';

const base = {
  width: 400,
  height: 300,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const graphics = (spec: PlotSpec, mark = 0): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[mark]?.graphics ?? [];
const revenue = [
  { path: 'Cloud/AWS', value: 90, group: 'Cloud' },
  { path: 'Cloud/Azure', value: 70, group: 'Cloud' },
  { path: 'Devices/Apple', value: 100, group: 'Devices' },
  { path: 'Devices/Dell', value: 40, group: 'Devices' },
];
const area = (g: Graphic | undefined): number => (g?.kind === 'rect' ? g.width * g.height : 0);

describe('treemap marks', () => {
  const spec: PlotSpec = {
    ...base,
    data: revenue,
    marks: [{ mark: 'treemap', path: 'path', value: 'value', fill: 'group', padding: 0 }],
  };

  it('tile the panel with one rectangle per leaf, sized by value', () => {
    const plot = compilePlot(spec);
    expect(plot.facets[0]?.x).toBeNull();
    expect(plot.facets[0]?.y).toBeNull();
    const rects = (plot.facets[0]?.marks[0]?.graphics ?? []).filter((g) => g.kind === 'rect');
    expect(rects.map((r) => r.key).sort()).toEqual([
      'Cloud/AWS',
      'Cloud/Azure',
      'Devices/Apple',
      'Devices/Dell',
    ]);
    const total = rects.reduce((sum, r) => sum + area(r), 0);
    expect(total).toBeCloseTo(400 * 300, 0);
    const apple = rects.find((r) => r.key === 'Devices/Apple');
    expect(area(apple) / total).toBeCloseTo(100 / 300, 2);
    expect(apple?.title).toBe('Devices/Apple: 100');
  });

  it('colour leaves by their fill field, and label the ones with room', () => {
    const drawn = graphics(spec);
    const fills = new Set(
      drawn.filter((g) => g.kind === 'rect').map((g) => (g.kind === 'rect' ? g.fill : '')),
    );
    expect(fills.size).toBe(2);
    expect(
      drawn.filter((g) => g.kind === 'text').map((g) => (g.kind === 'text' ? g.text : '')),
    ).toContain('Apple');
  });
});

describe('sunburst marks', () => {
  it('draw a ring per level around an empty centre, centred in the panel', () => {
    const drawn = graphics({
      ...base,
      data: revenue,
      marks: [{ mark: 'sunburst', path: 'path', value: 'value', fill: 'group' }],
    });
    const arcs = drawn.filter((g) => g.kind === 'path');
    expect(arcs.map((a) => a.key)).toEqual([
      'Cloud',
      'Cloud/AWS',
      'Cloud/Azure',
      'Devices',
      'Devices/Apple',
      'Devices/Dell',
    ]);
    expect(
      arcs.every((a) => a.kind === 'path' && a.translate?.[0] === 200 && a.translate[1] === 150),
    ).toBe(true);
  });
});

describe('sankey marks', () => {
  const flows = [
    { from: 'Gas', to: 'Power', amount: 75 },
    { from: 'Coal', to: 'Power', amount: 50 },
    { from: 'Power', to: 'Homes', amount: 125 },
  ];
  const spec: PlotSpec = {
    ...base,
    data: flows,
    color: { legend: false },
    marks: [{ mark: 'sankey', source: 'from', target: 'to', value: 'amount' }],
  };

  it('draw a node per endpoint and a ribbon per flow, coloured by node', () => {
    const plot = compilePlot(spec);
    const drawn = plot.facets[0]?.marks[0]?.graphics ?? [];
    const nodes = drawn.filter((g) => g.kind === 'rect');
    const ribbons = drawn.filter((g) => g.kind === 'path');
    expect(nodes.map((n) => n.key)).toEqual(['node:Gas', 'node:Power', 'node:Coal', 'node:Homes']);
    expect(ribbons.map((r) => r.title)).toEqual([
      'Gas → Power: 75',
      'Coal → Power: 50',
      'Power → Homes: 125',
    ]);
    const gas = nodes[0];
    const gasRibbon = ribbons[0];
    expect(gas?.kind === 'rect' && gasRibbon?.kind === 'path' && gasRibbon.fill === gas.fill).toBe(
      true,
    );
    expect(plot.legends).toEqual([]);
  });

  it('label each node', () => {
    const labels = graphics(spec)
      .filter((g) => g.kind === 'text')
      .map((g) => (g.kind === 'text' ? g.text : ''));
    expect(labels).toEqual(['Gas', 'Power', 'Coal', 'Homes']);
  });
});

describe('parallel coordinates marks', () => {
  const cars = [
    { name: 'Prius', mpg: 52, hp: 121, kind: 'hybrid' },
    { name: 'Mustang', mpg: 18, hp: 450, kind: 'sport' },
  ];

  it('draw an axis per dimension and a polyline per row', () => {
    const drawn = graphics({
      ...base,
      data: cars,
      marks: [{ mark: 'parallel', dimensions: ['mpg', 'hp'], stroke: 'kind', title: 'name' }],
    });
    const lines = drawn.filter((g) => g.kind === 'path');
    expect(lines.map((l) => l.title)).toEqual(['Prius', 'Mustang']);
    const axes = drawn.filter((g) => g.kind === 'line');
    expect(axes.map((a) => (a.kind === 'line' ? a.x1 : NaN))).toEqual([0, 400]);
    const headings = drawn.filter(
      (g) => g.kind === 'text' && (g.text === 'mpg' || g.text === 'hp'),
    );
    expect(headings).toHaveLength(2);
  });

  it('reject an empty or non-numeric dimension list', () => {
    expect(() =>
      compilePlot({ ...base, data: cars, marks: [{ mark: 'parallel', dimensions: [] }] }),
    ).toThrow('marks[0].dimensions');
    expect(() =>
      compilePlot({ ...base, data: cars, marks: [{ mark: 'parallel', dimensions: ['name'] }] }),
    ).toThrow('marks[0].dimensions[0]');
  });
});
