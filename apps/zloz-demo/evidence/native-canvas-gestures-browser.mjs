import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, firefox, webkit, expect } = require('@playwright/test');
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  const path = resolve(root, '.' + (route.endsWith('/') ? route + 'index.html' : route));
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  await readFile(path).then(
    (body) => {
      response.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
      );
      response.end(body);
    },
    () => response.writeHead(404).end(),
  );
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const engine = process.env.ZLOZ_BROWSER ?? 'chromium';
async function qualify() {
  const browser = await { chromium, firefox, webkit }[engine].launch();
  await (async () => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto('http://127.0.0.1:' + server.address().port + '/history/');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    const surface = page.getByRole('region', { name: 'Working history canvas' });
    const world = surface.locator('.zloz-ui-world');
    const camera = () =>
      world.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
        return { x: matrix.e, y: matrix.f, zoom: matrix.a };
      });
    const canvas = await surface.boundingBox();
    const empty = { x: canvas.x + canvas.width - 80, y: canvas.y + 70 };
    const beforeDoubleClick = await camera();
    await page.mouse.dblclick(empty.x, empty.y);
    await expect.poll(async () => (await camera()).zoom).toBeCloseTo(beforeDoubleClick.zoom * 1.25);

    const controls = page.getByRole('group', { name: 'Canvas camera controls' });
    const button = (name) => controls.getByRole('button', { name, exact: true });
    const box = button('Box select');
    const area = button('Zoom to area');
    const previous = button('Back to previous view');
    const drag = async (start, end, mouseButton = 'left') => {
      await page.mouse.move(start.x, start.y);
      await page.mouse.down({ button: mouseButton });
      await page.mouse.move(end.x, end.y, { steps: 5 });
    };
    const expectPan = async (before, dx, dy) => {
      await expect
        .poll(async () => {
          const next = await camera();
          return Math.max(Math.abs(next.x - before.x - dx), Math.abs(next.y - before.y - dy));
        })
        .toBeLessThan(2);
      expect((await camera()).zoom).toBe(before.zoom);
    };
    const shifted = { x: empty.x - 35, y: empty.y + 42 };
    await box.press('Space');
    await expect(box).toHaveAttribute('aria-pressed', 'true');
    const beforePan = await camera();
    await surface.focus();
    await page.keyboard.down('Space');
    await drag(empty, shifted);
    await page.mouse.up();
    await page.keyboard.up('Space');
    await expectPan(beforePan, -35, 42);
    const beforeMiddle = await camera();
    await drag(shifted, empty, 'middle');
    await page.mouse.up({ button: 'middle' });
    await expectPan(beforeMiddle, 35, -42);
    await expect(box).toHaveAttribute('aria-pressed', 'true');

    const fit = button('Fit view');
    await expect(fit).toBeEnabled();
    const beforeFit = await camera();
    await fit.press('Enter');
    await expect.poll(camera).not.toEqual(beforeFit);
    await expect(previous).toBeEnabled();
    const orders = surface.locator('[data-flow-node="a"]');
    const ordersTitle = surface.getByRole('button', { name: 'Select Orders', exact: true });
    const billing = surface.getByRole('button', { name: 'Select Billing', exact: true });
    const selection = surface.locator('[data-flow-selection-box]');
    const zoomArea = surface.locator('[data-flow-zoom-area-box]');
    const rectangle = await orders.boundingBox();
    const start = { x: rectangle.x + rectangle.width + 20, y: rectangle.y + rectangle.height + 20 };
    const end = { x: rectangle.x - 20, y: rectangle.y - 20 };
    await drag(start, end);
    await expect(selection).toBeVisible();
    await expect(orders).toHaveAttribute('data-selection-preview', 'true');
    await expect(ordersTitle).toHaveAttribute('aria-pressed', 'false');
    await expect(billing).toHaveAttribute('aria-pressed', 'false');
    await expect(zoomArea).toHaveCount(0);
    await page.mouse.up();
    await expect(selection).toHaveCount(0);
    await expect(orders).not.toHaveAttribute('data-selection-preview', 'true');
    await expect(ordersTitle).toHaveAttribute('aria-pressed', 'true');
    await expect(billing).toHaveAttribute('aria-pressed', 'false');

    const beforeArea = await camera();
    await area.press('Enter');
    await expect(area).toHaveAttribute('aria-pressed', 'true');
    await area.press('Escape');
    await expect(area).toHaveAttribute('aria-pressed', 'false');
    await expect(area).toBeFocused();
    await area.press('Enter');
    await drag(start, end);
    await expect(zoomArea).toBeVisible();
    await expect(selection).toHaveCount(0);
    const bounds = await zoomArea.boundingBox();
    expect(Math.abs(bounds.x - end.x)).toBeLessThan(3);
    expect(Math.abs(bounds.y - end.y)).toBeLessThan(3);
    expect(Math.abs(bounds.width - (start.x - end.x))).toBeLessThan(3);
    expect(Math.abs(bounds.height - (start.y - end.y))).toBeLessThan(3);
    const screenshot = process.env.ZLOZ_GESTURE_SCREENSHOT;
    if (screenshot) await page.screenshot({ path: screenshot });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(zoomArea).toHaveCount(0);
    await expect.poll(camera).toEqual(beforeArea);
    await expect(ordersTitle).toHaveAttribute('aria-pressed', 'true');
    await area.press('Enter');
    await drag(start, end);
    await expect(zoomArea).toBeVisible();
    await page.mouse.up();
    await expect(zoomArea).toHaveCount(0);
    await expect.poll(async () => (await camera()).zoom).toBeGreaterThan(beforeArea.zoom);
    await expect(ordersTitle).toHaveAttribute('aria-pressed', 'true');
    await previous.press('Enter');
    await expect.poll(camera).toEqual(beforeArea);
    await expect(box).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Restore / Undo', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Undo working edit', exact: true }),
    ).toBeDisabled();
    expect(errors).toEqual([]);
    console.log(
      engine + ': native camera gestures, drag feedback, cancellation, selection, and Undo passed',
    );
  })().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
