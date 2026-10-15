/**
 * Visual and resource tests in a real browser.
 *
 * - Golden images: Playwright's clock is paused, so frames are a pure function of fake
 *   time and identical on every run. Goldens are SwiftShader (software) renders, which were
 *   pixel-identical on macOS and Linux. Set UPDATE_GOLDENS=1 to rewrite them. Locally a
 *   missing golden is written; in CI (`CI=true`) it fails, so new goldens must be committed.
 * - Leak oracle: three's own `renderer.info.memory` must return to its baseline after
 *   repeated shared-resource swaps.
 * - Time-travel gate: while the Mount's view state is `Paused`, pointer events are dropped.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdir } from 'node:fs/promises';

import pixelmatch from 'pixelmatch';
import type { Browser, Page } from 'playwright';
import { PNG } from 'pngjs';

import { launchBrowser, type ServedApp, serveApp } from './support/server.ts';

const goldenDir = new URL('./goldens/', import.meta.url).pathname;
const diffDir = new URL('./goldens/__diff__/', import.meta.url).pathname;
// Allowed fraction of differing pixels: zero locally, room for driver drift elsewhere.
const tolerance = 0.002;

let browser: Browser;
let app: ServedApp;

beforeAll(async () => {
  app = await serveApp('dist-visual', ['index.html', 'pause.html']);
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser.close();
  await app.stop();
});

/** Compares `actual` with the named golden, writing it when missing or when updating. */
async function expectGolden(name: string, actual: Buffer): Promise<void> {
  const file = Bun.file(`${goldenDir}${name}.png`);
  const exists = await file.exists();
  if (!exists && Bun.env['CI'] === 'true') {
    await mkdir(diffDir, { recursive: true });
    await Bun.write(`${diffDir}${name}.actual.png`, actual);
    throw new Error(`missing golden ${name}.png; the render is in goldens/__diff__/`);
  }
  if (Bun.env['UPDATE_GOLDENS'] === '1' || !exists) {
    await Bun.write(file, actual);
    return;
  }
  const expected = PNG.sync.read(Buffer.from(await file.arrayBuffer()));
  const received = PNG.sync.read(actual);
  expect([received.width, received.height]).toEqual([expected.width, expected.height]);
  const diff = new PNG({ width: expected.width, height: expected.height });
  const differing = pixelmatch(
    expected.data,
    received.data,
    diff.data,
    expected.width,
    expected.height,
    { threshold: 0.1 },
  );
  const ratio = differing / (expected.width * expected.height);
  if (ratio > tolerance) {
    await mkdir(diffDir, { recursive: true });
    await Bun.write(`${diffDir}${name}.png`, PNG.sync.write(diff));
  }
  expect(ratio).toBeLessThanOrEqual(tolerance);
}

/** Lit cube pixels: horizontal extent and the colour at the image centre. */
function measureCube(png: Buffer) {
  const image = PNG.sync.read(png);
  let minX = image.width;
  let maxX = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const lit = (image.data[i] ?? 0) + (image.data[i + 1] ?? 0) + (image.data[i + 2] ?? 0) > 60;
      if (lit) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }
  const centre = (Math.floor(image.height / 2) * image.width + Math.floor(image.width / 2)) * 4;
  return {
    width: maxX - minX + 1,
    red: image.data[centre] ?? 0,
    blue: image.data[centre + 2] ?? 0,
  };
}

// Foldkit re-renders on the next animation frame and the scene update then runs on an
// Effect fiber; 100 ms of fake time covers both. Scene time advances with it, deterministically.
const settle = 100;

/** Opens the app with time paused at 1 s, then lets it boot for 100 ms of fake time. */
async function openFrozen(): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto(app.url('index.html'));
  await page.clock.runFor(100);
  expect(await page.locator('#started').textContent()).toBe('1');
  return page;
}

test('golden frames at fixed scene times', async () => {
  const page = await openFrozen();
  const canvas = page.locator('effect-three-scene canvas');
  const t0 = await canvas.screenshot();
  await expectGolden('spin-t0', t0);
  await page.clock.runFor(1000);
  const t1 = await canvas.screenshot();
  expect(t1.equals(t0)).toBe(false);
  await expectGolden('spin-t1', t1);

  // Semantic checks first, so a golden written on first run can't lock in a wrong state.
  await page.click('#colour');
  await page.clock.runFor(settle);
  const blue = await canvas.screenshot();
  expect(measureCube(blue).blue).toBeGreaterThan(measureCube(blue).red);
  await expectGolden('spin-t1-blue', blue);
  await page.click('#size');
  await page.clock.runFor(settle);
  const large = await canvas.screenshot();
  expect(measureCube(large).width).toBeGreaterThan(measureCube(blue).width * 1.3);
  await expectGolden('spin-t1-blue-large', large);
  await page.close();
}, 60_000);

type Memory = { readonly geometries: number; readonly textures: number };

function rendererMemory(): Memory {
  return Reflect.get(globalThis, '__probe').rendererMemory();
}

test('renderer GPU memory returns to its baseline after repeated shared-resource swaps', async () => {
  const page = await openFrozen();
  await page.clock.runFor(32);
  const baseline = await page.evaluate(rendererMemory);
  expect(baseline.geometries).toBe(1);
  for (let swap = 0; swap < 20; swap++) {
    await page.click('#size');
    await page.click('#colour');
    await page.clock.runFor(settle);
  }
  await page.clock.runFor(32);
  expect(await page.evaluate(rendererMemory)).toEqual(baseline);
  await page.close();
}, 60_000);

function pauseHarnessReady(): boolean {
  return Reflect.get(globalThis, '__pause').ready();
}

function harnessClicks(): number {
  return Reflect.get(globalThis, '__pause').clicks();
}

function pauseView(): void {
  Reflect.get(globalThis, '__pause').setViewState('Paused');
}

function resumeView(): void {
  Reflect.get(globalThis, '__pause').setViewState('Live');
}

test('pointer events are dropped while the view is paused for time travel', async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  await page.goto(app.url('pause.html'));
  await page.waitForFunction(pauseHarnessReady);
  const canvas = page.locator('effect-three-scene canvas');
  const centre = { position: { x: 160, y: 120 } };

  await canvas.click(centre);
  await page.waitForFunction(() => Reflect.get(globalThis, '__pause').clicks() === 1);

  await page.evaluate(pauseView);
  await canvas.click(centre);
  await canvas.click(centre);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
  expect(await page.evaluate(harnessClicks)).toBe(1);

  await page.evaluate(resumeView);
  await canvas.click(centre);
  await page.waitForFunction(() => Reflect.get(globalThis, '__pause').clicks() === 2);
  await page.close();
}, 60_000);
