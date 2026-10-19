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

/** Each case runs on three's WebGL renderer, and on its WebGPU renderer's WebGL 2 backend. */
const renderers = [
  { name: 'WebGL', page: 'staging.html' },
  { name: 'WebGPU (WebGL 2 backend)', page: 'staging.html?renderer=webgpu' },
  { name: 'WebGPU', page: 'staging.html?renderer=webgpu&backend=webgpu' },
] as const;

for (const renderer of renderers) {
  test(`${renderer.name}: contact shadows darken the floor around what rests on it, and go when removed`, async () => {
    const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
    const errors: Array<string> = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(app.url(renderer.page));
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

  /** Runs in the page: shows the shader grid scene. */
  function showGrid(): void {
    Reflect.get(globalThis, '__staging').showGrid();
  }

  function showLines(): void {
    Reflect.get(globalThis, '__staging').showLines();
  }

  /** The pixel's RGB at a canvas pixel. */
  const rgbAt = (png: PNG, x: number, y: number): readonly [number, number, number] => {
    const i = (y * png.width + x) * 4;
    return [png.data[i] ?? 0, png.data[i + 1] ?? 0, png.data[i + 2] ?? 0];
  };

  test(`${renderer.name}: the shader grid draws cell and section lines, and nothing past its plane`, async () => {
    const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
    const errors: Array<string> = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(app.url(renderer.page));
    await page.waitForFunction(stagingReady);
    await page.evaluate(showGrid);
    await frames(page);
    const png = PNG.sync.read(await page.locator('canvas').screenshot());
    // 40 pixels a unit, the origin at (200, 200): a section line (every 2 units) at x = 280
    // is red; a cell line (odd units) at x = 240 is grey; between lines is the white floor.
    const [red, green] = rgbAt(png, 280, 230);
    expect(red).toBeGreaterThan(200);
    expect(green).toBeLessThan(120);
    // (WebGPU blends in linear colour before converting to sRGB, so its lines are lighter.)
    expect(rgbAt(png, 240, 230)[0]).toBeLessThan(225);
    expect(rgbAt(png, 260, 230)).toEqual([255, 255, 255]);
    // The plane is 8 across: beyond x = 360 (4 units) there are no lines.
    expect(rgbAt(png, 380, 230)).toEqual([255, 255, 255]);
    expect(errors).toEqual([]);
    await page.close();
  }, 60_000);

  test(`${renderer.name}: a line is as wide as asked, in pixels, and a dashed one has gaps`, async () => {
    const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
    const errors: Array<string> = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(app.url(renderer.page));
    await page.waitForFunction(stagingReady);
    await page.evaluate(showLines);
    await frames(page);
    const png = PNG.sync.read(await page.locator('canvas').screenshot());
    // Seen from above, z = 0 is the middle row (y = 200): blue there, white 6 pixels off.
    const isBlue = ([r, , b]: readonly [number, number, number]) => b > 200 && r < 100;
    const blue = (x: number, y: number) => isBlue(rgbAt(png, x, y));
    expect(blue(200, 200)).toBe(true);
    expect(blue(100, 201)).toBe(true);
    expect(rgbAt(png, 200, 206)).toEqual([255, 255, 255]);
    // Past its end (x = 3, 120 pixels right of the middle): the floor.
    expect(rgbAt(png, 340, 200)).toEqual([255, 255, 255]);
    // The dashed line at z = 2 (80 pixels down): red dashes with white between them.
    const row = Array.from({ length: 200 }, (_, step) => rgbAt(png, 100 + step, 280));
    const red = row.filter(([r, g]) => r > 200 && g < 100).length;
    expect(red).toBeGreaterThan(60);
    expect(red).toBeLessThan(140);
    expect(errors).toEqual([]);
    await page.close();
  }, 60_000);
}
