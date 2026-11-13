import { expect, it } from 'bun:test';

import { Effect } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
import { define as defineMount } from 'foldkit/mount';

import { plotCanvas, plotChart } from '../src/foldkit/plot.js';
import { compilePlot } from '../src/plot/index.js';
import { renderChart } from './render-chart.js';

const count = (html: string, pattern: string): number => html.split(pattern).length - 1;
const { Painted } = defineMessageUnion({ Painted: {} });
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
  const html = await renderChart<never>((h) => plotChart(h, geometry));
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

it('heads each facet with its label and can leave the legend out', async () => {
  const geometry = compilePlot({
    width: 500,
    height: 260,
    data: rows,
    facet: { x: 'group' },
    marks: [{ mark: 'dot', x: 'dose', y: 'response', fill: 'group' }],
  });
  const html = await renderChart<never>((h) => plotChart(h, geometry, { legend: false }));
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
  const html = await renderChart<never>((h) =>
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
  const paint = defineMount('PaintTest', {
    messages: [Painted],
    execute: ({ element }) =>
      Effect.sync(() => {
        element.setAttribute('data-painted', 'true');
        return Painted();
      }),
  });
  const html = await renderChart<typeof Painted.Type>((h) =>
    plotCanvas(h, geometry, {
      key: 'v1',
      onMount: paint(),
      overlay: { crosshair: { x: 100, y: 100 } },
    }),
  );
  expect(html).toContain('<canvas');
  expect(html).toContain('aspect-ratio: 400 / 200');
  expect(html).not.toMatch(/<canvas[^>]* width=/);
  expect(count(html, 'class="plot-canvas-overlay"')).toBe(1);
});
