/**
 * The Foldkit adapter end to end, with real WebGL in headless Chromium (SwiftShader).
 * Pointer listeners are read through the Chrome DevTools Protocol, so the oracle is the
 * browser's own listener list rather than anything the adapter reports about itself.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';

import type { Browser, CDPSession, Page } from 'playwright';
import { PNG } from 'pngjs';

import { launchBrowser, type ServedApp, serveApp } from './support/server.ts';

let browser: Browser;
let app: ServedApp;

beforeAll(async () => {
  app = await serveApp('dist', ['index.html']);
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser.close();
  await app.stop();
});

type Probe = {
  readonly updates: number;
  readonly resizeObservers: number;
  readonly intersectionObservers: number;
  readonly stats: {
    readonly geometries: { readonly live: number; readonly created: number };
    readonly materials: { readonly live: number; readonly created: number };
  };
  readonly frameRequests: number;
};

/** Runs in the page: a serialisable copy of `window.__probe`. */
function probeSnapshot(): Probe {
  const probe = Reflect.get(globalThis, '__probe');
  return {
    updates: probe.updates,
    resizeObservers: probe.resizeObservers,
    intersectionObservers: probe.intersectionObservers,
    stats: probe.stats(),
    frameRequests: probe.frameRequests,
  };
}

/** Runs in the page: true once the unmounted scene has released its resources. */
function releasedScene(): boolean {
  const probe = Reflect.get(globalThis, '__probe');
  return probe.stats().geometries.live === 0 && probe.resizeObservers === 0;
}

function readProbe(page: Page): Promise<Probe> {
  return page.evaluate(probeSnapshot);
}

function text(page: Page, selector: string): Promise<string | null> {
  return page.locator(selector).textContent();
}

function waitForText(page: Page, selector: string, expected: string): Promise<unknown> {
  return page.waitForFunction(
    ([s, e]) => document.querySelector(s ?? '')?.textContent === e,
    [selector, expected],
  );
}

/** The RGB colour at the centre of a PNG screenshot. */
function centreColour(png: Buffer): { readonly r: number; readonly g: number; readonly b: number } {
  const image = PNG.sync.read(png);
  const offset = (Math.floor(image.height / 2) * image.width + Math.floor(image.width / 2)) * 4;
  return {
    r: image.data[offset] ?? 0,
    g: image.data[offset + 1] ?? 0,
    b: image.data[offset + 2] ?? 0,
  };
}

function animationFrames(page: Page, count: number): Promise<number> {
  return page.evaluate(
    (frames) =>
      new Promise<number>((resolve) => {
        let seen = 0;
        function tick(): void {
          seen++;
          if (seen >= frames) resolve(seen);
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }),
    count,
  );
}

const sceneInputTypes = new Set([
  'pointermove',
  'pointerdown',
  'pointerup',
  'pointerleave',
  'pointercancel',
  'dblclick',
  'contextmenu',
  'wheel',
]);

/** Scene input listener types registered on the canvas kept in `window.__canvas`. */
async function canvasPointerListeners(cdp: CDPSession): Promise<ReadonlyArray<string>> {
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'window.__canvas' });
  if (result.objectId === undefined) throw new Error('window.__canvas is not set');
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
    objectId: result.objectId,
  });
  return listeners.map((listener) => listener.type).filter((type) => sceneInputTypes.has(type));
}

test('the adapter proves the vertical slice in a real browser', async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(app.url('index.html'));

  // Mount: the Mount reports StartedScene through the app's typed Message.
  await waitForText(page, '#started', '1');
  expect(await text(page, '#failed')).toBe('0');
  await page.evaluate(() =>
    Reflect.set(globalThis, '__canvas', document.querySelector('effect-three-scene canvas')),
  );
  expect(await canvasPointerListeners(cdp)).toHaveLength(sceneInputTypes.size);
  expect(await readProbe(page)).toMatchObject({ resizeObservers: 1, intersectionObservers: 1 });

  // Animation runs without Foldkit model updates.
  const canvas = page.locator('effect-three-scene canvas');
  const updatesBefore = (await readProbe(page)).updates;
  const firstFrame = await canvas.screenshot();
  await animationFrames(page, 60);
  const laterFrame = await canvas.screenshot();
  expect(laterFrame.equals(firstFrame)).toBe(false);
  expect((await readProbe(page)).updates).toBe(updatesBefore);

  // Pointer interaction dispatches a typed Foldkit Message.
  await canvas.click({ position: { x: 160, y: 120 } });
  await waitForText(page, '#clicks', '1');
  expect(await text(page, '#last-key')).toBe('cube');
  expect(Number(await text(page, '#moves'))).toBeGreaterThan(0);

  // The rest of the pointer vocabulary: double-click, context menu, wheel and misses.
  // A context menu over the mesh keeps the browser menu shut; anywhere else it opens.
  await canvas.dblclick({ position: { x: 160, y: 120 } });
  await canvas.click({ position: { x: 160, y: 120 }, button: 'right' });
  await canvas.hover({ position: { x: 160, y: 120 } });
  await page.mouse.wheel(0, 120);
  await canvas.click({ position: { x: 4, y: 4 } });
  await canvas.click({ position: { x: 4, y: 4 }, button: 'right' });
  await waitForText(
    page,
    '#events',
    'DoubleClick:cube ContextMenu:cube Wheel:cube:1 Missed:0 Missed:2',
  );
  expect(await page.evaluate(() => Reflect.get(globalThis, '__probe').contextMenus)).toEqual([
    true,
    false,
  ]);

  // A press on the mesh captures the pointer: dragging off the canvas and releasing
  // there still ends the drag, with a world-space ray.
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('canvas not visible');
  await page.mouse.move(box.x + 160, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 40, box.y + box.height + 40, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() =>
    (document.querySelector('#events')?.textContent ?? '').endsWith('DragEnd:cube:-1'),
  );

  // A model change updates the existing scene: no remount, no new GPU resources.
  const statsBefore = (await readProbe(page)).stats;
  const red = centreColour(await canvas.screenshot());
  expect(red.r).toBeGreaterThan(red.b);
  await page.click('#colour');
  await animationFrames(page, 2);
  const blue = centreColour(await canvas.screenshot());
  expect(blue.b).toBeGreaterThan(blue.r);
  const afterColour = await readProbe(page);
  expect(await text(page, '#started')).toBe('1');
  expect(afterColour.stats.geometries.created).toBe(statsBefore.geometries.created);
  expect(afterColour.stats.materials.created).toBe(statsBefore.materials.created);
  // onReconciled reports the in-place change as exactly one Update.
  await waitForText(page, '#last-updated', '1');

  // On demand, a scene that holds still stops asking for frames altogether; spinning
  // again resumes them. (Waiting uses timers: the test must not request frames itself.)
  await page.click('#still');
  await page.waitForTimeout(300);
  const idle = (await readProbe(page)).frameRequests;
  await page.waitForTimeout(500);
  expect((await readProbe(page)).frameRequests).toBe(idle);
  await page.click('#still');
  await page.waitForTimeout(300);
  expect((await readProbe(page)).frameRequests).toBeGreaterThan(idle + 5);

  // Unmount releases owned resources, listeners and observers.
  await page.click('#visible');
  await page.waitForFunction(() => document.querySelector('effect-three-scene') === null);
  await page.waitForFunction(releasedScene);
  const unmounted = await readProbe(page);
  expect(unmounted.stats.geometries.live).toBe(0);
  expect(unmounted.stats.materials.live).toBe(0);
  expect(unmounted.intersectionObservers).toBe(0);
  expect(await canvasPointerListeners(cdp)).toEqual([]);

  // Remounting starts a fresh scene.
  await page.click('#visible');
  await waitForText(page, '#started', '2');
  expect((await readProbe(page)).stats.geometries.live).toBe(1);

  expect(errors).toEqual([]);
  await page.close();
}, 60_000);

/** three's GPU memory counters for the scene's renderer. */
function gpuMemory(): { readonly geometries: number; readonly textures: number } {
  return Reflect.get(globalThis, '__probe').rendererMemory();
}

test('assets load into the store, play, pick by part and unload from the GPU', async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(app.url('index.html'));
  await waitForText(page, '#started', '1');
  await page.click('#still');
  await animationFrames(page, 3);
  const before = await page.evaluate(gpuMemory);

  // A glTF model loads through a Foldkit Command and appears through a borrowed node.
  await page.click('#load-model');
  await waitForText(page, '#robot', 'ready:wave,roll');
  await animationFrames(page, 5);
  const loaded = await page.evaluate(gpuMemory);
  expect(loaded.geometries).toBeGreaterThan(before.geometries + 5);

  // The robot sits at (1.4, -0.44) in the world: (250, 148) on the 320 × 240 canvas.
  const canvas = page.locator('effect-three-scene canvas');
  await canvas.click({ position: { x: 250, y: 148 } });
  await waitForText(page, '#last-key', 'robot/body');

  // Its wave clip plays, so the on-demand scene keeps drawing while the cube holds still.
  const idleCheck = (await readProbe(page)).frameRequests;
  await page.waitForTimeout(300);
  expect((await readProbe(page)).frameRequests).toBeGreaterThan(idleCheck + 5);

  // Unloading withdraws the model and frees its GPU geometry.
  await page.click('#unload-model');
  await waitForText(page, '#robot', 'unloaded');
  await animationFrames(page, 3);
  expect((await page.evaluate(gpuMemory)).geometries).toBe(before.geometries);

  // A texture becomes the cube's map.
  await page.click('#load-texture');
  await page.waitForFunction(
    () => Reflect.get(globalThis, '__probe').rendererMemory().textures > 0,
  );

  expect(errors).toEqual([]);
  await page.close();
}, 60_000);

test('post-processing renders through effects and frees its targets when they go', async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(app.url('index.html'));
  await waitForText(page, '#started', '1');
  await page.click('#still');
  await animationFrames(page, 5);
  const canvas = page.locator('effect-three-scene canvas');
  const plainFrame = await canvas.screenshot();
  const before = await page.evaluate(gpuMemory);

  await page.click('#glow');
  await animationFrames(page, 5);
  const glowingFrame = await canvas.screenshot();
  expect(glowingFrame.equals(plainFrame)).toBe(false);
  // The composer's render targets are GPU textures.
  expect((await page.evaluate(gpuMemory)).textures).toBeGreaterThan(before.textures);

  await page.click('#glow');
  await animationFrames(page, 5);
  expect((await page.evaluate(gpuMemory)).textures).toBe(before.textures);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);

test('a render texture draws its own scene into the map that names it', async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(app.url('index.html'));
  await waitForText(page, '#started', '1');
  await page.click('#still');
  await animationFrames(page, 5);
  const canvas = page.locator('effect-three-scene canvas');
  const before = await page.evaluate(gpuMemory);

  await page.click('#screen');
  await animationFrames(page, 5);
  // The cube is white, so its face shows the texture: the little scene's green background.
  const centre = centreColour(await canvas.screenshot());
  expect(centre.g).toBeGreaterThan(centre.r * 1.5);
  expect(centre.g).toBeGreaterThan(centre.b * 1.5);
  // The render target is a GPU texture.
  expect((await page.evaluate(gpuMemory)).textures).toBeGreaterThan(before.textures);

  await page.click('#screen');
  await animationFrames(page, 5);
  expect((await page.evaluate(gpuMemory)).textures).toBe(before.textures);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);

/** Runs in the page: the camera position the app shows, as numbers. */
function cameraPosition(): ReadonlyArray<number> {
  return (document.querySelector('#camera')?.textContent ?? '').split(',').map(Number);
}

/** Runs in the page: true once the shown camera has swung well to the left. */
function swungLeft(): boolean {
  const [x = 0] = (document.querySelector('#camera')?.textContent ?? '').split(',').map(Number);
  return x < -1;
}

/** Runs in the page: true once the shown camera is closer to its target than `distance`. */
function cameraCloserThan(distance: number): boolean {
  const position = (document.querySelector('#camera')?.textContent ?? '').split(',').map(Number);
  return Math.hypot(...position) < distance;
}

test('a scene that claims gestures orbits a Model camera and keeps the page still', async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(app.url('index.html'));
  await waitForText(page, '#started', '1');
  await page.click('#still');
  // A tall page, so a wheel the scene does not claim scrolls it.
  await page.evaluate(() => {
    document.body.style.height = '4000px';
  });
  const canvas = page.locator('effect-three-scene canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no canvas');

  // Unclaimed: the wheel is the page's, and so is touch.
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.wheel(0, 200);
  await page.waitForFunction(() => window.scrollY > 0);
  expect(await canvas.evaluate((element) => element.style.touchAction)).toBe('');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0);

  await page.click('#orbit');
  await waitForText(page, '#camera', '0.000,0.000,4.000');
  expect(await canvas.evaluate((element) => element.style.touchAction)).toBe('none');
  // The camera readout pushed the canvas down: measure it again.
  const orbiting = await canvas.boundingBox();
  if (orbiting === null) throw new Error('no canvas');

  // A left drag across empty space turns the camera round the cube at the same distance.
  await page.mouse.move(orbiting.x + 20, orbiting.y + 20);
  await page.mouse.down();
  await page.mouse.move(orbiting.x + 100, orbiting.y + 20, { steps: 4 });
  await page.mouse.up();
  // Dragging right turns the scene right: the camera swings to the left.
  await page.waitForFunction(swungLeft);
  const turned = await page.evaluate(cameraPosition);
  expect(Math.hypot(...turned)).toBeCloseTo(4, 2);

  // The wheel dollies in, and the page stays where it is.
  await page.mouse.wheel(0, -300);
  await page.waitForFunction(cameraCloserThan, 3.99);
  await animationFrames(page, 3);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Released again, the page has its wheel back.
  await page.click('#orbit');
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.wheel(0, 200);
  await page.waitForFunction(() => window.scrollY > 0);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);

test('an overlay shows Model HTML at a point on a node, and follows it', async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors: Array<string> = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(app.url('index.html'));
  await waitForText(page, '#started', '1');
  await page.click('#still');
  await page.click('#label');
  const label = page.locator('[data-effect-three-overlay="cube-label"]');
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLElement>('[data-effect-three-overlay="cube-label"]')?.style
        .visibility === 'visible',
  );
  const canvas = await page.locator('effect-three-scene canvas').boundingBox();
  const placed = await page.locator('#cube-label').boundingBox();
  if (canvas === null || placed === null) throw new Error('missing boxes');
  // Centred over the cube, a unit above it: in the middle, above the canvas's centre.
  expect(placed.x + placed.width / 2).toBeCloseTo(canvas.x + canvas.width / 2, 0);
  expect(placed.y + placed.height / 2).toBeLessThan(canvas.y + canvas.height / 2 - 20);
  expect(await page.locator('#cube-label').textContent()).toBe('red');

  // The content is the Model's: a new colour re-renders it, still placed.
  await page.click('#colour');
  await waitForText(page, '#cube-label', 'blue');
  expect(await label.evaluate((element) => element.style.visibility)).toBe('visible');

  // A larger cube keeps the label at the same point on the cube's node.
  await page.click('#size');
  await animationFrames(page, 3);
  const after = await page.locator('#cube-label').boundingBox();
  expect(after?.y).toBeCloseTo(placed.y, 0);

  await page.click('#label');
  await page.waitForFunction(() => document.querySelector('#cube-label') === null);
  expect(errors).toEqual([]);
  await page.close();
}, 60_000);

test('repeated mount and unmount releases WebGL contexts and resources', async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const warnings: Array<string> = [];
  page.on('console', (message) => {
    if (message.text().includes('WebGL')) warnings.push(message.text());
  });
  await page.goto(app.url('index.html'));
  await waitForText(page, '#started', '1');
  for (let cycle = 2; cycle <= 21; cycle++) {
    await page.click('#visible');
    await page.waitForFunction(releasedScene);
    await page.click('#visible');
    await waitForText(page, '#started', String(cycle));
  }
  const probe = await readProbe(page);
  expect(probe.stats.geometries.live).toBe(1);
  expect(probe.stats.geometries.created).toBe(21);
  expect(probe.resizeObservers).toBe(1);
  expect(warnings).toEqual([]);
  await page.close();
}, 120_000);
