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
/** The right controller ahead at the cube's height, offset to its right. */
function aimAtCube(): void {
  Reflect.get(globalThis, '__xr').aimRight(1.5);
}
/** The right controller ahead, well above the cube. */
function aimOver(): void {
  Reflect.get(globalThis, '__xr').aimRight(3);
}
function pull(): void {
  Reflect.get(globalThis, '__xr').trigger(1);
}
function release(): void {
  Reflect.get(globalThis, '__xr').trigger(0);
}
function clicks(): ReadonlyArray<string> {
  return Reflect.get(globalThis, '__xr').clicks();
}
/** Whether `count` session changes have been reported. */
function sessionsReported(count: number): boolean {
  return Reflect.get(globalThis, '__xr').sessions().length === count;
}

const inPage = <A>(page: Page, run: () => A) => page.evaluate(run);

test('a session presents from the origin, drives frames, takes controller clicks, and ends', async () => {
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

  // A controller pointed at the cube and its trigger pulled and released: a click on it.
  await inPage(page, aimAtCube);
  await page.waitForTimeout(100);
  await inPage(page, pull);
  await page.waitForTimeout(100);
  await inPage(page, release);
  await page.waitForFunction(() => Reflect.get(globalThis, '__xr').clicks().length === 1);
  expect(await inPage(page, clicks)).toEqual(['cube']);
  // Pointed over it, nothing is clicked.
  await inPage(page, aimOver);
  await page.waitForTimeout(100);
  await inPage(page, pull);
  await page.waitForTimeout(100);
  await inPage(page, release);
  await page.waitForTimeout(200);
  expect(await inPage(page, clicks)).toEqual(['cube']);

  await inPage(page, exit);
  await page.waitForFunction(sessionsReported, 2);
  expect(await inPage(page, sessions)).toEqual(['immersive-vr', null]);
  expect(await inPage(page, presenting)).toBe(false);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);

function events(): ReadonlyArray<string> {
  return Reflect.get(globalThis, '__xr').events();
}
function drags(): number {
  return Reflect.get(globalThis, '__xr').drags();
}
function inputs(): { readonly rays: number; readonly joints: number } {
  return Reflect.get(globalThis, '__xr').inputs();
}
function enterAr(): Promise<void> {
  return Reflect.get(globalThis, '__xr').enterAr();
}
function aimAtFloor(): void {
  Reflect.get(globalThis, '__xr').aimDown(1);
}
function stickLeft(): void {
  Reflect.get(globalThis, '__xr').stick(-1, 0);
}
function stickCentre(): void {
  Reflect.get(globalThis, '__xr').stick(0, 0);
}
function grip(): void {
  Reflect.get(globalThis, '__xr').squeeze(1);
}
function useHands(): void {
  Reflect.get(globalThis, '__xr').inputMode('hand');
}

/** Opens the XR page and enters `mode`, waiting for the session to start. */
const presentIn = async (enterMode: () => Promise<void>) => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(app.url('xr.html'));
  await page.waitForFunction(xrReady);
  await inPage(page, enterMode);
  await page.waitForFunction(sessionsReported, 1);
  return { page, errors };
};

const settle = (page: Page) => page.waitForTimeout(150);

/** The left controller pointed well above everything, out of the way. */
function leftAway(): void {
  Reflect.get(globalThis, '__xr').aimLeft(4);
}
function clearEvents(): void {
  Reflect.get(globalThis, '__xr').clearEvents();
}

/** Points both controllers above everything and forgets what happened before. */
const pointAway = async (page: Page) => {
  await inPage(page, leftAway);
  await inPage(page, aimOver);
  await settle(page);
  await inPage(page, clearEvents);
};

test('controllers hover, drag, push sticks and press buttons; their rays are drawn', async () => {
  const { page, errors } = await presentIn(enter);
  await pointAway(page);
  await inPage(page, aimAtCube);
  await settle(page);
  expect(await inPage(page, events)).toEqual(['pointer-enter cube']);
  // Both controllers' rays are drawn.
  expect(await inPage(page, inputs)).toEqual({ rays: 2, joints: 0 });

  // Pulled on the cube and moved off it: dragged every frame, left, and the drag ends.
  await inPage(page, pull);
  await settle(page);
  await inPage(page, aimOver);
  await settle(page);
  expect(await inPage(page, drags)).toBeGreaterThan(2);
  await inPage(page, release);
  await settle(page);
  // The thumbstick pushed left and let back; the grip squeezed.
  await inPage(page, stickLeft);
  await settle(page);
  await inPage(page, stickCentre);
  await settle(page);
  await inPage(page, grip);
  await settle(page);
  expect(await inPage(page, events)).toEqual([
    'pointer-enter cube',
    'xr-button right trigger true',
    'pointer-leave cube',
    'drag-end cube 0',
    'xr-button right trigger false',
    'xr-stick right left',
    'xr-stick right center',
    'xr-button right squeeze true',
  ]);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);

test('tracked hands are drawn joint by joint, and their pinches select', async () => {
  const { page, errors } = await presentIn(enter);
  await inPage(page, useHands);
  await settle(page);
  // Two hands of 25 joints each; a hand points from its wrist, so no rays.
  expect(await inPage(page, inputs)).toEqual({ rays: 0, joints: 50 });
  // A pinch is a select: the right hand points at the cube, so pinching clicks it.
  await inPage(page, clearEvents);
  await inPage(page, () => Reflect.get(globalThis, '__xr').pinch(1));
  await settle(page);
  await inPage(page, () => Reflect.get(globalThis, '__xr').pinch(0));
  await settle(page);
  expect(await inPage(page, events)).toEqual(['click cube 0']);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);

test('in AR, a select reports where its ray met the real floor', async () => {
  const { page, errors } = await presentIn(enterAr);
  expect(await inPage(page, sessions)).toEqual(['immersive-ar']);
  await pointAway(page);
  await inPage(page, aimAtFloor);
  await settle(page);
  await inPage(page, pull);
  await settle(page);
  await inPage(page, release);
  await settle(page);
  // Straight down from 0.2 right and 0.3 ahead of the player, who stands at x = 2 facing
  // +x: the floor at (2.3, 0, 0.2) in the scene.
  expect((await inPage(page, events)).filter((line) => line.startsWith('xr-surface'))).toEqual([
    'xr-surface right 2.3,0.0,0.2',
  ]);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);

function pushForward(): void {
  Reflect.get(globalThis, '__xr').leftStick(0, -1);
}
function letGo(): void {
  Reflect.get(globalThis, '__xr').leftStick(0, 0);
}

test('with glide, the left stick moves the player where they face, and letting go says where', async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(app.url('xr.html?glide'));
  await page.waitForFunction(xrReady);
  await inPage(page, enter);
  await page.waitForFunction(sessionsReported, 1);
  await pointAway(page);
  const [startX = 0] = (await inPage(page, head)) ?? [];
  // The player stands at x = 2 facing +x; half a second at 2 m/s is about a metre.
  await inPage(page, pushForward);
  await page.waitForTimeout(500);
  await inPage(page, letGo);
  await settle(page);
  const [x = 0, , z = 0] = (await inPage(page, head)) ?? [];
  expect(x - startX).toBeGreaterThan(0.6);
  expect(x - startX).toBeLessThan(1.6);
  expect(z).toBeCloseTo(0, 1);
  const moved = (await inPage(page, events)).filter((line) => line.startsWith('xr-moved'));
  expect(moved).toHaveLength(1);
  // The origin moved with the player, from x = 2, as far as the head did.
  const [originX = 0] = (moved[0] ?? '').split(' ').at(-1)?.split(',').map(Number) ?? [];
  expect(originX - 2).toBeCloseTo(x - startX, 1);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);
