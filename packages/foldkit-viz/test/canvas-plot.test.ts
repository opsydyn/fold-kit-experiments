import { describe, expect, it } from 'bun:test';

import { paintCanvas, paintPlot } from '../src/canvas/plot';
import { compilePlot } from '../src/plot';
import { canvasCalls as recorder } from './canvas-recorder';

const fakePath = (d: string) => ({ d });

const rows = Array.from({ length: 1_000 }, (_, i) => ({
  x: i,
  y: (i * 37) % 101,
  g: i % 2 === 0 ? 'even' : 'odd',
}));

describe('canvas painter', () => {
  it('draws a dense mark in one fill per colour, with axes and tick labels', () => {
    const geometry = compilePlot({
      width: 400,
      height: 300,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', fill: 'g', dense: true }],
    });
    const { ctx, calls, count } = recorder();
    paintPlot(ctx, geometry, { pixelRatio: 2 });
    expect(calls[0]).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
    expect(count('arc')).toBe(1_000);
    const fills = calls.filter(([n]) => n === 'fill');
    expect(fills).toHaveLength(2);
    expect(count('fillText')).toBeGreaterThan(6);
  });

  it('draws points of radius 1.5 pixels or less as squares, which fill faster', () => {
    const geometry = compilePlot({
      width: 400,
      height: 300,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', r: { value: 1.2 }, dense: true }],
    });
    const { ctx, calls, count } = recorder();
    paintPlot(ctx, geometry);
    expect(count('arc')).toBe(0);
    const squares = calls.filter(([n, , , w]) => n === 'rect' && w === 2.4);
    expect(squares).toHaveLength(1_000);
  });

  it('fills a large colour group in paths of at most 100,000 points, which Chromium draws', () => {
    // Chromium 156 silently draws nothing for one path of more than about
    // 180,000 circles or 453,000 squares.
    const many = Array.from({ length: 250_000 }, (_, i) => ({ x: i % 500, y: (i * 7) % 300 }));
    const geometry = compilePlot({
      width: 400,
      height: 300,
      data: many,
      marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
    });
    const { ctx, calls } = recorder();
    paintPlot(ctx, geometry, { makePath: fakePath });
    const marks = calls.slice(calls.findIndex(([n]) => n === 'arc'));
    const fills = marks.filter(([n]) => n === 'fill');
    expect(fills).toHaveLength(3);
    let since = 0;
    let most = 0;
    for (const [name] of marks) {
      if (name === 'arc') since += 1;
      if (name === 'fill') {
        most = Math.max(most, since);
        since = 0;
      }
    }
    expect(most).toBe(100_000);
  });

  it('paints highlighted points after dimmed ones, so they sit on top', () => {
    const geometry = compilePlot({
      width: 400,
      height: 300,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      x: { domain: [0, 10] },
      y: { domain: [0, 10] },
      data: [
        { x: 5, y: 5, keep: true },
        { x: 0, y: 0, keep: false },
      ],
      marks: [
        {
          mark: 'dot',
          x: 'x',
          y: 'y',
          r: { value: 1 },
          dense: true,
          highlight: { field: 'keep', values: [true] },
        },
      ],
    });
    const { ctx, calls } = recorder();
    paintPlot(ctx, geometry);
    const squares = calls.filter(([n, , , w]) => n === 'rect' && w === 2);
    expect(squares.map(([, x]) => x)).toEqual([-1, 199]);
  });

  it('clips marks to the plot area when the spec asks', () => {
    const geometry = compilePlot({
      width: 400,
      height: 300,
      clip: true,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
    });
    const { ctx, count } = recorder();
    paintPlot(ctx, geometry);
    expect(count('clip')).toBe(1);
  });

  it('draws path marks through Path2D, honouring their translate', () => {
    const geometry = compilePlot({
      width: 300,
      height: 300,
      data: [
        { path: 'a/x', value: 2, g: 'a' },
        { path: 'b/y', value: 1, g: 'b' },
      ],
      marks: [{ mark: 'sunburst', path: 'path', value: 'value', fill: 'g', labels: false }],
    });
    const { ctx, calls, count } = recorder();
    paintPlot(ctx, geometry, { makePath: fakePath });
    expect(count('translate')).toBe(4);
    // Unclipped by default, so marks on the edge of the domain are drawn whole.
    expect(count('clip')).toBe(0);
    expect(calls.filter(([n]) => n === 'fill').every((call) => call.length === 3)).toBe(true);
  });

  it('sizes the canvas for the pixel ratio', () => {
    const geometry = compilePlot({
      width: 200,
      height: 100,
      data: rows.slice(0, 5),
      marks: [{ mark: 'dot', x: 'x', y: 'y' }],
    });
    const { ctx } = recorder();
    const canvas = { width: 0, height: 0, getContext: () => ctx };
    paintCanvas(canvas, geometry, { pixelRatio: 3 });
    expect([canvas.width, canvas.height]).toEqual([600, 300]);
  });
});
