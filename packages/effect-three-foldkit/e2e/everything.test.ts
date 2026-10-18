/** Most of what a scene can hold, at once, on both of three's renderers. */
import { afterAll, beforeAll, expect, test } from 'bun:test';

import type { Browser } from 'playwright';
import { PNG } from 'pngjs';

import { launchBrowser, type ServedApp, serveApp } from './support/server.ts';

let browser: Browser;
let app: ServedApp;

beforeAll(async () => {
  app = await serveApp('dist-everything', ['everything.html']);
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser.close();
  await app.stop();
});

function everythingReady(): boolean {
  return Reflect.get(globalThis, '__everything')?.ready() === true;
}

/** How many distinct colours a picture has, coarsely: a blank or broken frame has few. */
const coloursIn = (png: PNG): number => {
  const seen = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4 * 7) {
    seen.add(
      ((png.data[i] ?? 0) >> 4) * 256 +
        ((png.data[i + 1] ?? 0) >> 4) * 16 +
        ((png.data[i + 2] ?? 0) >> 4),
    );
  }
  return seen.size;
};

for (const renderer of ['webgl', 'webgpu', 'webgpu&backend=webgpu'] as const) {
  test(`${renderer}: everything at once draws without errors`, async () => {
    const page = await browser.newPage({ viewport: { width: 500, height: 400 } });
    const problems: Array<string> = [];
    page.on('pageerror', (error) => problems.push(`pageerror ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`error ${message.text()}`);
      if (message.type() === 'warning' && !message.text().includes('GPU stall')) {
        problems.push(`warning ${message.text()}`);
      }
    });
    await page.goto(app.url(`everything.html?renderer=${renderer}`));
    await page.waitForFunction(everythingReady);
    await page.waitForTimeout(1500);
    const png = PNG.sync.read(await page.locator('canvas').screenshot());
    // A drawn frame has many colours; a blank or broken one, one or two. (WebGL's bloom
    // washes much of this frame out: three's UnrealBloomPass thresholds HDR values, and the
    // sky is far brighter than 1. The renderers' blooms differ; neither is pixel-tested here.)
    expect(coloursIn(png)).toBeGreaterThan(8);
    expect(problems).toEqual([]);
    await page.close();
  }, 60_000);
}
