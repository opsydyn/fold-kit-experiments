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
};

/** Runs in the page: a serialisable copy of `window.__probe`. */
function probeSnapshot(): Probe {
  const probe = Reflect.get(globalThis, '__probe');
  return {
    updates: probe.updates,
    resizeObservers: probe.resizeObservers,
    intersectionObservers: probe.intersectionObservers,
    stats: probe.stats(),
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
