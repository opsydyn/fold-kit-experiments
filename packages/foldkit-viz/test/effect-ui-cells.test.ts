import { expect, it } from 'bun:test';

import { cellGeometry } from '../src/chart/cells.js';
import { cellSeries, hexSeries } from '../src/effect-ui/cartesian.js';
import { hexbin } from '../src/math/bin2d.js';
import { renderChart } from './render-chart.js';

type Row = Readonly<{ r: string; c: string; v: number }>;
const geometry = cellGeometry(
  [
    { r: 'a', c: 'x', v: 1 },
    { r: 'b', c: 'x', v: 4 },
  ],
  {
    key: (d: Row) => d.r + d.c,
    row: (d: Row) => d.r,
    column: (d: Row) => d.c,
    value: (d: Row) => d.v,
  },
  { frame: { width: 100, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } } },
);
const count = (html: string, pattern: string): number => html.split(pattern).length - 1;

it('draws one titled rectangle per cell, outlining the active one', async () => {
  const html = await renderChart((h) =>
    cellSeries(h, {
      cells: geometry.cells,
      fillFor: (cell) => (cell.value > 2 ? 'red' : 'blue'),
      labelFor: (row) => `${row.r} by ${row.c}: ${row.v}`,
      activeKey: 'bx',
    }),
  );
  expect(count(html, '<rect')).toBe(2);
  expect(html).toContain('fill="red"');
  expect(html).toContain('<title>b by x: 4</title>');
  expect(count(html, 'stroke="currentColor"')).toBe(1);
});

it('draws one hexagon per bin at its centre', async () => {
  const bins = hexbin(
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 40, y: 40 },
    ],
    { x: (p: { x: number; y: number }) => p.x, y: (p) => p.y },
    { radius: 8 },
  );
  const html = await renderChart((h) =>
    hexSeries(h, {
      bins,
      radius: 8,
      fillFor: () => 'teal',
      labelFor: (bin) => `${bin.count} points`,
    }),
  );
  expect(count(html, '<path')).toBe(2);
  expect(html).toContain('translate(0,0)');
  expect(html).toContain('<title>2 points</title>');
});
