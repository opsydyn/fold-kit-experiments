/**
 * Labels in a real browser: troika builds the glyphs, and the scene draws them when ready.
 * Each case runs on three's WebGL renderer, where troika's own material draws them, and on
 * its WebGPU renderer (both backends), where the troika package's node materials do.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';

import type { Browser, Page } from 'playwright';
import { PNG } from 'pngjs';

import { launchBrowser, type ServedApp, serveApp } from './support/server.ts';

let browser: Browser;
let app: ServedApp;

beforeAll(async () => {
  app = await serveApp('dist-labels', ['labels.html']);
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser.close();
  await app.stop();
});

/** Runs in the page: whether the scene has its canvas. */
function labelsReady(): boolean {
  return Reflect.get(globalThis, '__labels')?.ready() === true;
}

/** Runs in the page: shows `text` with its left edge at `x`. */
function showLabel([text, x]: readonly [string, number]): void {
  Reflect.get(globalThis, '__labels').show(text, x);
}

/** The columns of the canvas holding dark (glyph) pixels, as `[first, last]`. */
const inkColumns = (png: PNG): readonly [number, number] | undefined => {
  let first = -1;
  let last = -1;
  for (let x = 0; x < png.width; x++) {
    for (let y = 0; y < png.height; y++) {
      if ((png.data[(y * png.width + x) * 4] ?? 255) < 100) {
        if (first < 0) first = x;
        last = x;
        break;
      }
    }
  }
  return first < 0 ? undefined : [first, last];
};

/** Waits until the canvas shows ink whose columns satisfy `ready`. */
const inkWhen = async (
  page: Page,
  ready: (columns: readonly [number, number]) => boolean,
): Promise<readonly [number, number]> => {
  const canvas = page.locator('canvas');
  for (let attempt = 0; attempt < 100; attempt++) {
    const columns = inkColumns(PNG.sync.read(await canvas.screenshot()));
    if (columns !== undefined && ready(columns)) return columns;
    await page.waitForTimeout(100);
  }
  throw new Error('the label never showed as expected');
};

const renderers = [
  { name: 'WebGL', page: 'labels.html' },
  { name: 'WebGPU (WebGL 2 backend)', page: 'labels.html?renderer=webgpu' },
  { name: 'WebGPU', page: 'labels.html?renderer=webgpu&backend=webgpu' },
] as const;

/** Runs in the page: the keys of the scene's clicks so far. */
function clickedKeys(): ReadonlyArray<string> {
  return Reflect.get(globalThis, '__labels')
    .clicks()
    .map((click: { readonly key: string }) => click.key);
}

for (const renderer of renderers) {
  test(`${renderer.name}: a label is drawn once its font has loaded, and redrawn when its text changes`, async () => {
    const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
    const errors: Array<string> = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(app.url(renderer.page));
    await page.waitForFunction(labelsReady);

    // Its left edge at x = −4: 160 pixels left of the 400-pixel canvas's centre.
    const [first, last] = await inkWhen(page, () => true);
    expect(first).toBeGreaterThanOrEqual(38);
    expect(first).toBeLessThan(50);
    const short = last - first;

    // Longer text, moved: the scene draws again when troika has built the new glyphs.
    await page.evaluate(showLabel, ['HIHIHI', 0] as const);
    const [movedFirst, movedLast] = await inkWhen(page, ([from]) => from >= 195);
    expect(movedFirst).toBeLessThan(210);
    expect(movedLast - movedFirst).toBeGreaterThan(short * 2.5);
    expect(errors).toEqual([]);
    await page.close();
  }, 60_000);

  test(`${renderer.name}: an interactive label is picked over its text block, not beside it`, async () => {
    const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
    await page.goto(app.url(renderer.page));
    await page.waitForFunction(labelsReady);
    const [first, last] = await inkWhen(page, () => true);
    const canvas = page.locator('canvas');
    // Well right of the text: the paper, which is not interactive.
    await canvas.click({ position: { x: last + 80, y: 200 } });
    // Between its glyphs: inside the block, where troika's own picking hits too.
    await canvas.click({ position: { x: Math.round((first + last) / 2), y: 200 } });
    await page.waitForFunction(() => Reflect.get(globalThis, '__labels').clicks().length > 0);
    expect(await page.evaluate(clickedKeys)).toEqual(['sign']);
    await page.close();
  }, 60_000);

  /** Runs in the page: whether the last layout reported is the new text's, centred. */
  function newLayoutShown(): boolean {
    const [minX = 0, , maxX = 0] =
      Reflect.get(globalThis, '__labels').measured().at(-1)?.block ?? [];
    return maxX - minX > 3 && Math.abs(minX + maxX) < 0.1;
  }

  function showStyled(): void {
    Reflect.get(globalThis, '__labels').styled();
  }
  function labelMeasured(): ReadonlyArray<{
    readonly key: string;
    readonly block: ReadonlyArray<number>;
  }> {
    return Reflect.get(globalThis, '__labels').measured();
  }

  /** Pixels clearly red, and clearly blue, in the canvas. */
  const redAndBlue = (png: PNG): { readonly red: number; readonly blue: number } => {
    let red = 0;
    let blue = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      const [r = 0, g = 0, b = 0] = [png.data[i], png.data[i + 1], png.data[i + 2]];
      if (r > 150 && g < 80 && b < 80) red++;
      if (b > 150 && r < 80 && g < 80) blue++;
    }
    return { red, blue };
  };

  test(`${renderer.name}: colour ranges, a curve and a lit material draw; a measured label says its size`, async () => {
    const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
    const errors: Array<string> = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(app.url(renderer.page));
    await page.waitForFunction(labelsReady);
    await page.evaluate(showStyled);
    // The label keeps its key, so it is laid out again: the first report may still be the
    // old text's ("HI", left-anchored) until troika has laid out the new one, centred.
    await page.waitForFunction(newLayoutShown);
    const laidOut = (await page.evaluate(labelMeasured)).at(-1);
    // Four glyphs at an em of 2: a block some units wide, two high or more, centred.
    const [minX = 0, minY = 0, maxX = 0, maxY = 0] = laidOut?.block ?? [];
    expect(laidOut?.key).toBe('sign');
    expect(maxX - minX).toBeGreaterThan(3);
    expect(maxY - minY).toBeGreaterThanOrEqual(2);
    expect(minX + maxX).toBeCloseTo(0, 1);
    // The first two letters red, the last two blue.
    const canvas = page.locator('canvas');
    let colours = { red: 0, blue: 0 };
    // A lit node material compiles slowly on a software GPU: allow it up to 20 seconds.
    for (let attempt = 0; attempt < 200 && (colours.red < 50 || colours.blue < 50); attempt++) {
      colours = redAndBlue(PNG.sync.read(await canvas.screenshot()));
      await page.waitForTimeout(100);
    }
    expect(colours.red).toBeGreaterThan(50);
    expect(colours.blue).toBeGreaterThan(50);
    expect(errors).toEqual([]);
    await page.close();
  }, 60_000);
}
