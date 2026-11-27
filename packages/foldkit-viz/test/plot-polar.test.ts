import { describe, expect, it } from 'bun:test';

import { paintPlot } from '../src/canvas/plot';
import { plotChart } from '../src/effect-ui/plot';
import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';
import { canvasCalls } from './canvas-recorder';
import { renderChart } from './render-chart';

const base = {
  width: 300,
  height: 300,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const wind = [
  { dir: 'N', speed: 4 },
  { dir: 'E', speed: 8 },
  { dir: 'S', speed: 2 },
  { dir: 'W', speed: 6 },
];
const graphics = (spec: PlotSpec, mark = 0): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[mark]?.graphics ?? [];

describe('polar coordinates', () => {
  const rose: PlotSpec = {
    ...base,
    coordinates: 'polar',
    data: wind,
    marks: [{ mark: 'bar', x: 'dir', y: 'speed' }],
  };

  it('frames each facet with rings and spokes instead of x and y axes', () => {
    const facet = compilePlot(rose).facets[0];
    expect(facet?.x).toBeNull();
    expect(facet?.y).toBeNull();
    expect(facet?.polar?.cx).toBe(150);
    expect(facet?.polar?.cy).toBe(150);
    expect(facet?.polar?.outer).toBe(128);
    expect(facet?.polar?.angles.map((a) => a.label)).toEqual(['N', 'E', 'S', 'W']);
    expect(facet?.polar?.radii.length).toBeGreaterThan(1);
  });

  it('draws bars as wedges about the centre, one sector per category', () => {
    const wedges = graphics(rose);
    expect(wedges).toHaveLength(4);
    expect(wedges.every((g) => g.kind === 'path' && g.translate?.[0] === 150)).toBe(true);
  });

  it('starts the first sector where polar.start says', () => {
    const turned = compilePlot({ ...rose, polar: { start: 90 } }).facets[0]?.polar?.angles[0];
    const plain = compilePlot(rose).facets[0]?.polar?.angles[0];
    expect((turned?.angle ?? 0) - (plain?.angle ?? 0)).toBeCloseTo(Math.PI / 2);
  });

  it('closes a line over categories into a ring, as a radar does', () => {
    const [ring] = graphics({ ...rose, marks: [{ mark: 'line', x: 'dir', y: 'speed' }] });
    expect(ring?.kind === 'path' ? ring.d.endsWith('Z') : false).toBe(true);
  });

  it('places dots by angle and radius', () => {
    const [north] = graphics({ ...rose, marks: [{ mark: 'dot', x: 'dir', y: 'speed' }] });
    // North sits straight up from the centre.
    expect(north?.kind === 'circle' ? north.cx : 0).toBeCloseTo(150);
    expect(north?.kind === 'circle' ? north.cy : 0).toBeLessThan(150);
  });

  it('draws a y rule as a circle and an x rule as a spoke', () => {
    const [ring] = graphics({ ...rose, marks: [{ mark: 'rule', y: { value: 5 } }] });
    const [spoke] = graphics({ ...rose, marks: [{ mark: 'rule', x: { value: 'E' } }] });
    expect(ring?.kind).toBe('path');
    expect(spoke?.kind).toBe('line');
  });

  it('names the mark that polar coordinates cannot draw', () => {
    expect(() =>
      compilePlot({ ...rose, marks: [{ mark: 'link', x1: 'dir', y1: 'speed' }] }),
    ).toThrow('marks[0]: the link mark cannot be drawn in polar coordinates');
    const unknown: PlotSpec = JSON.parse(JSON.stringify({ ...rose, coordinates: 'spherical' }));
    expect(() => compilePlot(unknown)).toThrow('coordinates: unknown coordinates "spherical"');
  });

  it('renders its frame in SVG and on canvas', async () => {
    const plot = compilePlot(rose);
    const html = await renderChart((h) => plotChart(h, plot));
    expect(html).toContain('class="plot-polar"');
    expect(html).toContain('>E</text>');
    const { ctx, count } = canvasCalls();
    paintPlot(ctx, plot, { makePath: (d: string) => ({ d }) });
    expect(count('arc')).toBeGreaterThan(1);
  });
});

describe('arc mark', () => {
  const budget = [
    { team: 'Design', share: 42 },
    { team: 'Build', share: 38 },
    { team: 'Market', share: 20 },
  ];

  it('draws one slice per row about the panel centre, with a donut hole', () => {
    const slices = graphics({
      ...base,
      data: budget,
      marks: [{ mark: 'arc', value: 'share', fill: 'team', inner: 0.6, text: { value: '100' } }],
    });
    const paths = slices.filter((g) => g.kind === 'path');
    expect(paths).toHaveLength(3);
    expect(new Set(paths.map((g) => (g.kind === 'path' ? g.fill : ''))).size).toBe(3);
    const centre = slices.find((g) => g.kind === 'text');
    expect(centre?.kind === 'text' ? [centre.text, centre.x] : []).toEqual(['100', 150]);
  });

  it('labels shares where the slices have room', () => {
    const labels = graphics({
      ...base,
      data: budget,
      marks: [{ mark: 'arc', value: 'share', labels: true }],
    }).filter((g) => g.kind === 'text');
    expect(labels.map((g) => (g.kind === 'text' ? g.text : ''))).toEqual(['42%', '38%', '20%']);
  });

  it('sweeps only between start and end, for gauges', () => {
    const full = graphics({ ...base, data: budget, marks: [{ mark: 'arc', value: 'share' }] });
    const gauge = graphics({
      ...base,
      data: budget,
      marks: [{ mark: 'arc', value: 'share', start: -120, end: 120 }],
    });
    expect(gauge.map((g) => (g.kind === 'path' ? g.d : ''))).not.toEqual(
      full.map((g) => (g.kind === 'path' ? g.d : '')),
    );
    expect(() =>
      compilePlot({
        ...base,
        data: budget,
        marks: [{ mark: 'arc', value: 'share', start: 90, end: 10 }],
      }),
    ).toThrow('marks[0].end: must be after start');
  });
});
