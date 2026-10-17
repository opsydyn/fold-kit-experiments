/** Immersive sessions in a real browser, with Meta's IWER emulating a Quest 3. */
import { afterAll, beforeAll, expect, test } from 'bun:test';

import type { Browser, Page } from 'playwright';

import { launchBrowser, type ServedApp, serveApp } from './support/server.ts';

let browser: Browser;
let app: ServedApp;

beforeAll(async () => {
  app = await serveApp('dist-xr', ['xr.html']);
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser.close();
  await app.stop();
});

// Each runs in the page on its own, so each reaches the page's hooks itself.
function xrReady(): boolean {
  return Reflect.get(globalThis, '__xr')?.ready() === true;
}
function supported(): Promise<boolean> {
  return Reflect.get(globalThis, '__xr').supported();
}
function enter(): Promise<void> {
  return Reflect.get(globalThis, '__xr').enter();
}
function exit(): Promise<void> {
  return Reflect.get(globalThis, '__xr').exit();
}
function sessions(): ReadonlyArray<string | null> {
  return Reflect.get(globalThis, '__xr').sessions();
}
function presenting(): boolean {
  return Reflect.get(globalThis, '__xr').presenting();
}
function frames(): number {
  return Reflect.get(globalThis, '__xr').frames();
}
function head(): ReadonlyArray<number> | null {
  return Reflect.get(globalThis, '__xr').head();
}
/** Half a unit forward, in the headset's own space. */
function lookForward(): void {
  Reflect.get(globalThis, '__xr').moveHead(0, 1.6, -0.5);
}
/** Whether `count` session changes have been reported. */
function sessionsReported(count: number): boolean {
  return Reflect.get(globalThis, '__xr').sessions().length === count;
}

const inPage = <A>(page: Page, run: () => A) => page.evaluate(run);

test('a session presents the scene from the described origin, drives frames, and ends', async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(app.url('xr.html'));
  await page.waitForFunction(xrReady);
  expect(await inPage(page, supported)).toBe(true);
  expect(await inPage(page, presenting)).toBe(false);

  await inPage(page, enter);
  await page.waitForFunction(sessionsReported, 1);
  expect(await inPage(page, sessions)).toEqual(['immersive-vr']);
  expect(await inPage(page, presenting)).toBe(true);

  // The session keeps frames coming, though the scene itself is static.
  const before = await inPage(page, frames);
  await page.waitForTimeout(300);
  expect(await inPage(page, frames)).toBeGreaterThan(before + 3);

  // The headset half a unit forward (−z in its own space) is half a unit along +x in the
  // scene: the player stands at x = 2 facing +x.
  await inPage(page, lookForward);
  await page.waitForTimeout(200);
  const [x = 0, y = 0, z = 0] = (await inPage(page, head)) ?? [];
  expect(x).toBeCloseTo(2.5, 1);
  expect(y).toBeCloseTo(1.6, 1);
  expect(z).toBeCloseTo(0, 1);

  await inPage(page, exit);
  await page.waitForFunction(sessionsReported, 2);
  expect(await inPage(page, sessions)).toEqual(['immersive-vr', null]);
  expect(await inPage(page, presenting)).toBe(false);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);
