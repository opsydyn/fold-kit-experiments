import { expect, it } from 'bun:test';

import { Component, Mount } from '@effect/ui';
import { Effect } from 'effect';

import { plotCanvas, plotChart } from '../src/effect-ui/plot.js';
import { compilePlot } from '../src/plot/index.js';
import { renderChart } from './render-chart.js';

const count = (html: string, pattern: string): number => html.split(pattern).length - 1;
const paint = Mount.make('PaintTest', { args: {} }, () => Effect.sync(() => Component.noop));
const rows = [
  { dose: 1, response: 2, group: 'control' },
  { dose: 2, response: 4, group: 'treated' },
  { dose: 3, response: 3, group: 'control' },
];

it('renders an accessible SVG with axes, marks, tooltips and a legend', async () => {
  const geometry = compilePlot({
    width: 400,
    height: 260,
    title: 'Dose response',
    description: 'Three observations',
    data: rows,
    marks: [
      { mark: 'dot', x: 'dose', y: 'response', fill: 'group', title: 'group' },
      { mark: 'rule', y: { value: 3 } },
    ],
  });
  const html = await renderChart((h) => plotChart(h, geometry));
  expect(html).toContain('role="img"');
  expect(html).toContain('aria-label="Dose response. Three observations"');
  expect(html).toContain('<title>Dose response</title>');
  expect(count(html, '<circle')).toBe(3);
  expect(html).toContain('<title>treated</title>');
  expect(html).toContain('>dose</text>');
  expect(html).toContain('>response</text>');
  expect(count(html, 'class="plot-legend"')).toBe(1);
  expect(html).toContain('>control</li>');
});

it('draws symbols at their points and a symbol legend in their colours', async () => {
  const geometry = compilePlot({
    width: 400,
    height: 260,
    data: rows,
    marks: [{ mark: 'dot', x: 'dose', y: 'response', fill: 'group', symbol: 'group' }],
  });
  const html = await renderChart((h) => plotChart(h, geometry));
  expect(count(html, '<circle')).toBe(2);
  expect(count(html, 'transform="translate(')).toBe(1);
  expect(count(html, 'class="plot-legend"')).toBe(1);
  expect(count(html, 'viewBox="-6 -6 12 12"')).toBe(2);
  expect(html).toContain('>treated</li>');
});

it('clips marks in a nested viewport over the plot area only when the spec asks', async () => {
  const spec = {
    width: 400,
    height: 260,
    data: rows,
    marks: [{ mark: 'dot' as const, x: 'dose', y: 'response' }],
  };
  const open = await renderChart((h) => plotChart(h, compilePlot(spec)));
  expect(open).not.toContain('plot-clip');
  const clipped = await renderChart((h) => plotChart(h, compilePlot({ ...spec, clip: true })));
  expect(count(clipped, 'class="plot-clip"')).toBe(1);
  expect(clipped).toContain('overflow="hidden"');
});

it('heads each facet with its label and can leave the legend out', async () => {
  const geometry = compilePlot({
    width: 500,
    height: 260,
    data: rows,
    facet: { x: 'group' },
    marks: [{ mark: 'dot', x: 'dose', y: 'response', fill: 'group' }],
  });
  const html = await renderChart((h) => plotChart(h, geometry, { legend: false }));
  expect(count(html, 'class="plot-facet"')).toBe(2);
  expect(html).toContain('>treated</text>');
  expect(html).not.toContain('plot-legend');
});

it('draws an overlay of crosshair, ring and brush without recompiling', async () => {
  const geometry = compilePlot({
    width: 400,
    height: 260,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    data: rows,
    marks: [{ mark: 'dot', x: 'dose', y: 'response' }],
  });
  const html = await renderChart((h) =>
    plotChart(h, geometry, {
      overlay: {
        crosshair: { x: 200, y: 130 },
        ring: { x: 200, y: 130, r: 6 },
        brush: { x0: 100, x1: 50 },
      },
    }),
  );
  expect(count(html, 'class="plot-crosshair"')).toBe(1);
  expect(count(html, 'class="plot-ring"')).toBe(1);
  expect(html).toMatch(
    /<rect[^>]*x="50"[^>]*width="50"[^>]*class="plot-brush"|<rect[^>]*class="plot-brush"[^>]*/,
  );
});

it('renders a canvas sized by aspect ratio, with an overlay above it', async () => {
  const geometry = compilePlot({
    width: 400,
    height: 200,
    data: rows,
    marks: [{ mark: 'dot', x: 'dose', y: 'response', dense: true }],
  });
  const html = await renderChart((h) =>
    plotCanvas(h, geometry, {
      key: 'v1',
      onMount: paint(),
      overlay: { crosshair: { x: 100, y: 100 } },
    }),
  );
  expect(html).toContain('<canvas');
  expect(html).toContain('aspect-ratio:400 / 200');
  expect(html).not.toMatch(/<canvas[^>]* width=/);
  expect(count(html, 'class="plot-canvas-overlay"')).toBe(1);
});

it('stacks a GPU points canvas between the base canvas and the overlay, when given one', async () => {
  const geometry = compilePlot({
    width: 400,
    height: 200,
    data: rows,
    marks: [{ mark: 'dot', x: 'dose', y: 'response', dense: true }],
  });
  const html = await renderChart((h) =>
    plotCanvas(h, geometry, {
      key: 'base',
      onMount: paint(),
      pointsLayer: { key: 'points', onMount: paint() },
    }),
  );
  expect(count(html, '<canvas')).toBe(2);
  const base = html.indexOf('<canvas'),
    points = html.indexOf('class="plot-points"'),
    overlay = html.indexOf('class="plot-canvas-overlay"');
  expect(base).toBeLessThan(points);
  expect(points).toBeLessThan(overlay);
  expect(html).toMatch(
    /<canvas[^>]*class="plot-points"[^>]*aria-hidden="true"[^>]*style="[^"]*pointer-events:none/,
  );
  expect(html).not.toMatch(/<canvas[^>]* width=/);
});
