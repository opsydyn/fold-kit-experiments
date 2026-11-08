import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { chromium, expect } from '@playwright/test';

const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  await readFile('../flow-sample/dist' + path)
    .then((body) => {
      res.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
      );
      res.end(body);
    })
    .catch(() => res.writeHead(404).end());
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);

async function qualify() {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1500 },
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const inspector = page.getByRole('group', { name: 'Ports for Review', exact: true });
    const handle = () => button('Position Review: in');
    const socket = () => button('Connect to Review: in');
    const preference = page.getByRole('checkbox', {
      name: 'Stable port anchor snapping',
      exact: true,
    });
    const snapping = page.getByRole('checkbox', {
      name: 'Snap port anchors to edges',
      exact: true,
    });
    const frame = surface.locator('[data-flow-node="review"]');
    const zoom = async () =>
      Number((await page.locator('[data-flow-zoom-level]').textContent()).replace('%', '')) / 100;
    const center = async () => {
      const box = await socket().boundingBox();
      const canvas = await surface.boundingBox();
      return { x: box.x + box.width / 2 - canvas.x, y: box.y + box.height / 2 - canvas.y };
    };
    const expectCenter = async (expected) => {
      await expect
        .poll(async () => {
          const point = await center();
          return Math.hypot(point.x - expected.x, point.y - expected.y);
        })
        .toBeLessThan(0.1);
    };
    const begin = async () => {
      await inspector.scrollIntoViewIfNeeded();
      await handle().scrollIntoViewIfNeeded();
      const node = await frame.boundingBox();
      const port = await socket().boundingBox();
      const box = await handle().boundingBox();
      const dimensions = await frame.evaluate((element) => ({
        height: element.clientHeight,
        left: element.clientLeft,
        top: element.clientTop,
      }));
      const scale = await zoom();
      const base = {
        x: port.x + port.width / 2 - node.x - dimensions.left * scale,
        y: port.y + port.height / 2 - node.y - dimensions.top * scale,
      };
      const origin = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(origin.x, origin.y);
      await page.mouse.down();
      return {
        half: (dimensions.height * scale) / 2,
        move: async (x, y) =>
          page.mouse.move(origin.x + x - base.x, origin.y + y - base.y, { steps: 5 }),
      };
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Review').click();
    await page.getByRole('checkbox', { name: 'Drag port anchors', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await snapping.check();
    await expect(preference).not.toBeChecked();
    await preference.dblclick();
    await expect(preference).not.toBeChecked();
    await preference.check();
    const before = await center();
    let grab = await begin();
    await grab.move(6, grab.half);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    await grab.move(15, grab.half);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    await grab.move(17, grab.half);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    await grab.move(15, grab.half);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    await grab.move(6, grab.half);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    await grab.move(15, grab.half - 20);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    const screenshot = process.env.FLOW_PORT_ANCHOR_HYSTERESIS_SCREENSHOT;
    if (screenshot) {
      const panel = await inspector.boundingBox();
      const canvas = await surface.boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvas.x,
          y: canvas.y - 4,
          width: canvas.width,
          height: panel.y + panel.height - canvas.y + 8,
        },
      });
    }
    await page.mouse.up();
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    const saved = await center();
    await expect(button('source:out → review:in')).toBeVisible();
    await button('Undo').click();
    await expectCenter(before);
    await button('Redo').click();
    await expectCenter(saved);
    await button('Select Review').click();
    grab = await begin();
    await grab.move(6, grab.half);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    await grab.move(13, 10);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    await grab.move(15, 10);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'top');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(saved);
    await preference.uncheck();
    grab = await begin();
    await grab.move(6, grab.half);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    await grab.move(15, grab.half);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(saved);
    await preference.check();
    await button('Zoom out').click();
    await expect(page.locator('[data-flow-zoom-level]')).not.toHaveText('100%');
    const atZoom = await center();
    grab = await begin();
    await grab.move(6, grab.half);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    await grab.move(15, grab.half);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    await grab.move(17, grab.half);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(atZoom);
    await snapping.uncheck();
    grab = await begin();
    await grab.move(6, grab.half);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await snapping.check();
    await button('Open port snapping demo').click();
    await expect(preference).toBeChecked();
    await expect(snapping).toBeChecked();
    expect(errors).toEqual([]);
    console.log(
      'Anchor hysteresis retains acquired edges, releases and switches with margin at zoom, preserves Undo/cancel and remains opt-in',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
