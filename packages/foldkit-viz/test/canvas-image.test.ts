import { describe, expect, it } from 'bun:test';

import { imageSize, paintImage, plotPng } from '../src/canvas/image.js';
import type { PngCanvas } from '../src/canvas/image.js';
import { paintPlot } from '../src/canvas/plot.js';
import type { PlotCanvasContext } from '../src/canvas/plot.js';
import { darkTheme, lightTheme } from '../src/chart/theme.js';
import { compilePlot } from '../src/plot/index.js';
import { currentColorPalette, plotSvg } from '../src/svg/plot.js';
import { canvasCalls as recorder } from './canvas-recorder.js';

const fakePath = (d: string) => ({ d });
const rows = [
  { dose: 1, response: 2, group: 'control' },
  { dose: 2, response: 4, group: 'treated' },
  { dose: 3, response: 3, group: 'control' },
];
const geometry = compilePlot({
  width: 400,
  height: 260,
  data: rows,
  marks: [{ mark: 'dot', x: 'dose', y: 'response', fill: 'group' }],
});
const svgHeight = (svg: string) => Number(/ height="([\d.]+)"/.exec(svg)?.[1]);
const fills = (calls: ReadonlyArray<readonly [string, ...unknown[]]>) =>
  calls.filter(([name]) => name === 'fill').map(([, style]) => style);

describe('paintPlot background', () => {
  it('fills the plot area after clearing it, when given a background', () => {
    const { ctx, calls } = recorder();
    paintPlot(ctx, geometry, { background: '#123456', makePath: fakePath });
    const cleared = calls.findIndex(([name]) => name === 'clearRect');
    expect(calls.slice(cleared + 1, cleared + 4)).toEqual([
      ['beginPath'],
      ['rect', 0, 0, 400, 260],
      ['fill', '#123456'],
    ]);
  });
});

describe('imageSize', () => {
  it('is the plot plus its legend rows, as tall as the standalone SVG', () => {
    expect(imageSize(geometry)).toEqual({ width: 400, height: svgHeight(plotSvg(geometry)) });
    expect(imageSize(geometry).height).toBeGreaterThan(260);
    expect(imageSize(geometry, { legend: false })).toEqual({ width: 400, height: 260 });
    expect(imageSize(geometry, { theme: 'high-contrast-light' }).height).toBe(
      svgHeight(plotSvg(geometry, { theme: 'high-contrast-light' })),
    );
  });
});

describe('paintImage', () => {
  it("paints the theme's background over the whole image first, then the plot, then its legend", () => {
    const { ctx, calls } = recorder();
    paintImage(ctx, geometry, { pixelRatio: 2, makePath: fakePath });
    const { width, height } = imageSize(geometry);
    expect(calls.slice(0, 4)).toEqual([
      ['setTransform', 2, 0, 0, 2, 0, 0],
      ['beginPath'],
      ['rect', 0, 0, width, height],
      ['fill', lightTheme.background],
    ]);
    const text = calls.filter(([name]) => name === 'fillText').map(([, t]) => t);
    expect(text.slice(-3)).toEqual(['group', 'control', 'treated']);
    expect(fills(calls).slice(-2)).toEqual(['#4e79a7', '#f28e2c']);
  });

  it('takes a theme, and leaves out the background or legend when asked', () => {
    const dark = recorder();
    paintImage(dark.ctx, geometry, { theme: 'dark', makePath: fakePath });
    expect(fills(dark.calls)[0]).toBe(darkTheme.background);

    const bare = recorder();
    paintImage(bare.ctx, geometry, { background: false, legend: false, makePath: fakePath });
    expect(fills(bare.calls)).not.toContain(lightTheme.background);
    expect(bare.calls.filter(([name]) => name === 'fillText').map(([, t]) => t)).not.toContain(
      'treated',
    );
  });

  it('paints a continuous legend as bands, and symbols at their centres', () => {
    const continuous = recorder();
    paintImage(
      continuous.ctx,
      compilePlot({
        width: 300,
        height: 200,
        data: rows,
        marks: [{ mark: 'dot', x: 'dose', y: 'response', fill: 'dose' }],
      }),
      { makePath: fakePath },
    );
    expect(
      fills(continuous.calls).filter((style) => String(style).startsWith('rgb(')).length,
    ).toBeGreaterThanOrEqual(48);

    const symbols = recorder();
    paintImage(
      symbols.ctx,
      compilePlot({
        width: 300,
        height: 200,
        data: rows,
        marks: [{ mark: 'dot', x: 'dose', y: 'response', symbol: 'group' }],
      }),
      { makePath: fakePath },
    );
    const translated = symbols.calls.filter(([name]) => name === 'translate');
    expect(translated.length).toBeGreaterThanOrEqual(2);
  });

  it('refuses a palette that leans on the page, which a canvas does not have', () => {
    const { ctx } = recorder();
    expect(() => paintImage(ctx, geometry, { theme: currentColorPalette })).toThrow(
      'a canvas has no page colour to inherit; choose a theme such as "light"',
    );
  });
});

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The first bytes of a PNG: its signature, then an IHDR chunk holding width and height. */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set(PNG_SIGNATURE, 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

/** A canvas like OffscreenCanvas: sized, painted through the recorder, encoded on request. */
function fakeCanvas(
  encode: (canvas: { width: number; height: number }) => Uint8Array = (c) =>
    pngHeader(c.width, c.height),
) {
  const { ctx, calls } = recorder();
  const requested: string[] = [];
  let contexts = 0;
  const canvas: PngCanvas = {
    width: 300,
    height: 150,
    getContext: (): PlotCanvasContext => {
      contexts += 1;
      return ctx;
    },
    convertToBlob: async (options) => {
      requested.push(options.type);
      const bytes = encode(canvas);
      return { arrayBuffer: async () => bytes.slice().buffer };
    },
  };
  return { canvas, calls, requested, contexts: () => contexts };
}

describe('plotPng', () => {
  it('sizes the canvas for the pixel ratio, paints the image and returns the encoded PNG', async () => {
    const { canvas, calls, requested } = fakeCanvas();
    const png = await plotPng(geometry, canvas, { pixelRatio: 2, makePath: fakePath });
    const { width, height } = imageSize(geometry);
    expect([canvas.width, canvas.height]).toEqual([width * 2, Math.ceil(height * 2)]);
    expect(requested).toEqual(['image/png']);
    expect([...png.slice(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(calls[0]).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
  });

  it('refuses an image too large to allocate, before touching the canvas', async () => {
    const { canvas, contexts } = fakeCanvas();
    await expect(plotPng(geometry, canvas, { pixelRatio: 64 })).rejects.toThrow(RangeError);
    expect(contexts()).toBe(0);
    await expect(plotPng(geometry, canvas, { pixelRatio: 0 })).rejects.toThrow('pixelRatio');
  });

  it('refuses output that is not a PNG of the size it painted', async () => {
    const notPng = fakeCanvas(() => new Uint8Array([1, 2, 3]));
    await expect(plotPng(geometry, notPng.canvas)).rejects.toThrow('not a PNG');
    const wrongSize = fakeCanvas(() => pngHeader(10, 10));
    await expect(plotPng(geometry, wrongSize.canvas)).rejects.toThrow('10×10');
  });
});
