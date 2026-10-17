/** Labels in a real browser: troika builds the glyphs, and the scene draws them when ready. */
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

test('a label is drawn once its font has loaded, and redrawn when its text changes', async () => {
  const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(app.url('labels.html'));
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
