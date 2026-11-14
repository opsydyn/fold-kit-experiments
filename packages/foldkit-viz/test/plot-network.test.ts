import { describe, expect, it } from 'bun:test';

import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';

const base = {
  width: 400,
  height: 300,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const graphics = (spec: PlotSpec): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[0]?.graphics ?? [];
const ofKind = <K extends Graphic['kind']>(gs: ReadonlyArray<Graphic>, kind: K) =>
  gs.filter((g): g is Extract<Graphic, { kind: K }> => g.kind === kind);
const inside = (g: Graphic): boolean =>
  g.kind !== 'circle' || (g.cx >= 0 && g.cx <= 400 && g.cy >= 0 && g.cy <= 300);

const stack = [
  { leaf: 'App/UI/React' },
  { leaf: 'App/UI/Styles' },
  { leaf: 'App/Data/State' },
  { leaf: 'App/Build' },
];

describe('tree', () => {
  it('lays out every node from the leaves’ paths, rooted at the single top node', () => {
    const drawn = graphics({ ...base, data: stack, marks: [{ mark: 'tree', path: 'leaf' }] });
    // App, UI, React, Styles, Data, State, Build.
    expect(ofKind(drawn, 'circle')).toHaveLength(7);
    expect(ofKind(drawn, 'path')).toHaveLength(6);
    expect(ofKind(drawn, 'text').map((t) => t.text)).toContain('App');
    expect(drawn.every(inside)).toBe(true);
  });

  it('runs depth left to right, keeping the rows’ order', () => {
    const circles = ofKind(
      graphics({ ...base, data: stack, marks: [{ mark: 'tree', path: 'leaf' }] }),
      'circle',
    );
    const app = circles.find((c) => c.key === 'App');
    const react = circles.find((c) => c.key === 'App/UI/React');
    const build = circles.find((c) => c.key === 'App/Build');
    expect(app?.cx ?? 0).toBeLessThan(react?.cx ?? 0);
    expect(react?.cy ?? 0).toBeLessThan(build?.cy ?? 0);
  });

  it('lays out radially about the centre, and as a cluster with every leaf level', () => {
    const radial = ofKind(
      graphics({ ...base, data: stack, marks: [{ mark: 'tree', path: 'leaf', radial: true }] }),
      'circle',
    );
    const root = radial.find((c) => c.key === 'App');
    expect([root?.cx, root?.cy]).toEqual([200, 150]);
    const cluster = ofKind(
      graphics({
        ...base,
        data: stack,
        marks: [{ mark: 'tree', path: 'leaf', layout: 'cluster' }],
      }),
      'circle',
    );
    const leafX = new Set(
      cluster.filter((c) => ['App/UI/React', 'App/Build'].includes(c.key)).map((c) => c.cx),
    );
    expect(leafX.size).toBe(1);
  });
});

describe('pack', () => {
  it('packs leaves inside their branches, labelling the roomy ones', () => {
    const drawn = graphics({
      ...base,
      data: [
        { lang: 'Systems/C', share: 18, family: 'Systems' },
        { lang: 'Systems/Rust', share: 8, family: 'Systems' },
        { lang: 'Web/JS', share: 30, family: 'Web' },
      ],
      marks: [{ mark: 'pack', path: 'lang', value: 'share', fill: 'family' }],
    });
    const circles = ofKind(drawn, 'circle');
    expect(circles).toHaveLength(5);
    const systems = circles.find((c) => c.key === 'Systems');
    const c = circles.find((n) => n.key === 'Systems/C');
    expect(
      Math.hypot((c?.cx ?? 0) - (systems?.cx ?? 0), (c?.cy ?? 0) - (systems?.cy ?? 0)),
    ).toBeLessThan(systems?.r ?? 0);
    expect(c?.fill).not.toBe(circles.find((n) => n.key === 'Web/JS')?.fill);
  });
});

describe('flows', () => {
  const flows = [
    { from: 'Cloud', to: 'AI', amount: 32 },
    { from: 'AI', to: 'Cloud', amount: 20 },
    { from: 'Software', to: 'AI', amount: 24 },
  ];

  it('draws a chord diagram of groups and ribbons in categorical colours', () => {
    const plot = compilePlot({
      ...base,
      data: flows,
      marks: [{ mark: 'chord', source: 'from', target: 'to', value: 'amount' }],
    });
    const drawn = plot.facets[0]?.marks[0]?.graphics ?? [];
    const groups = ofKind(drawn, 'path').filter((g) => !g.key.includes('->'));
    expect(groups.map((g) => g.key)).toEqual(['Cloud', 'AI', 'Software']);
    expect(new Set(groups.map((g) => g.fill)).size).toBe(3);
    expect(plot.legends[0]?.kind).toBe('categorical');
  });

  it('draws an arc above the baseline for each link, nodes in order of appearance', () => {
    const drawn = graphics({
      ...base,
      data: flows,
      marks: [{ mark: 'arc-diagram', source: 'from', target: 'to', value: 'amount' }],
    });
    expect(ofKind(drawn, 'path')).toHaveLength(3);
    const nodes = ofKind(drawn, 'circle');
    expect(nodes.map((n) => n.key)).toEqual(['Cloud', 'AI', 'Software']);
    expect(nodes[0]?.cx ?? 0).toBeLessThan(nodes[1]?.cx ?? 0);
  });

  it('lays out a force-directed graph the same way every time, inside the panel', () => {
    const spec: PlotSpec = {
      ...base,
      data: flows,
      marks: [{ mark: 'force', source: 'from', target: 'to', iterations: 120 }],
    };
    const first = graphics(spec);
    expect(ofKind(first, 'line')).toHaveLength(3);
    expect(ofKind(first, 'circle')).toHaveLength(3);
    expect(first.every(inside)).toBe(true);
    expect(graphics(spec)).toEqual(first);
    expect(() =>
      compilePlot({
        ...spec,
        marks: [{ mark: 'force', source: 'from', target: 'to', iterations: 0 }],
      }),
    ).toThrow('marks[0].iterations: must be a whole number from 1 to 5000');
  });
});

describe('voronoi', () => {
  it('draws one cell per point, each holding its point and staying inside the plot', () => {
    const points = [
      { x: 1, y: 1, k: 'a' },
      { x: 5, y: 2, k: 'b' },
      { x: 3, y: 6, k: 'c' },
      { x: 8, y: 7, k: 'd' },
    ];
    const plot = compilePlot({
      ...base,
      x: { domain: [0, 10] },
      y: { domain: [0, 10] },
      data: points,
      marks: [{ mark: 'voronoi', x: 'x', y: 'y', fill: 'k' }],
    });
    const cells = ofKind(plot.facets[0]?.marks[0]?.graphics ?? [], 'path');
    expect(cells).toHaveLength(4);
    const numbers = cells.flatMap((c) => (c.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number));
    expect(numbers.every((n) => n >= -0.01 && n <= 400.01)).toBe(true);
    expect(new Set(cells.map((c) => c.fill)).size).toBe(4);
  });
});
