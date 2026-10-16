/** Staging in a real browser: contact shadows drawn under objects, the right way round. */
import { afterAll, beforeAll, expect, test } from 'bun:test';

import type { Browser, Page } from 'playwright';
import { PNG } from 'pngjs';

import { launchBrowser, type ServedApp, serveApp } from './support/server.ts';

let browser: Browser;
let app: ServedApp;

beforeAll(async () => {
  app = await serveApp('dist-staging', ['staging.html']);
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser.close();
  await app.stop();
});

/** Runs in the page: whether the scene has its canvas. */
function stagingReady(): boolean {
  return Reflect.get(globalThis, '__staging')?.ready() === true;
}

/** Runs in the page: shows contact shadows with these options, or none. */
function showShadows(options: Readonly<Record<string, number>> | null): void {
  Reflect.get(globalThis, '__staging').show(options);
}

/** The red channel at a canvas pixel: 255 on the white floor, lower in shadow. */
const redAt = (png: PNG, x: number, y: number): number => png.data[(y * png.width + x) * 4] ?? 0;

const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

test('contact shadows darken the floor around what rests on it, and go when removed', async () => {
  const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(app.url('staging.html'));
  await page.waitForFunction(stagingReady);
  const canvas = page.locator('canvas');
  const shot = async () => PNG.sync.read(await canvas.screenshot());

  await page.evaluate(showShadows, { size: 8, near: -0.01, far: 2, blur: 1 });
  await frames(page);
  const shaded = await shot();
  // The cube spans x 100–140 at y 200: shadow just outside both of its sides.
  expect(redAt(shaded, 98, 200)).toBeLessThan(230);
  expect(redAt(shaded, 142, 200)).toBeLessThan(230);
  // The ball is at x 280, z 1.5 (60 pixels down): its shadow rims it there, and nothing
  // shows where a mirrored image would put it (z −1.5).
  expect(redAt(shaded, 280, 281)).toBeLessThan(240);
  expect(redAt(shaded, 280, 119)).toBe(255);
  // Far from both, the floor is untouched.
  expect(redAt(shaded, 200, 360)).toBe(255);

  await page.evaluate(showShadows, null);
  await frames(page);
  expect(redAt(await shot(), 98, 200)).toBe(255);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);
