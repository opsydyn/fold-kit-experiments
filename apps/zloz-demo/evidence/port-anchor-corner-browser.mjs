import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { chromium, expect } from '@playwright/test';

const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  await readFile('../zloz-demo/dist' + path)
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
    const bypassOption = page.getByRole('checkbox', {
      name: 'Alt bypasses port snapping',
      exact: true,
    });
    const snapping = page.getByRole('checkbox', {
      name: 'Snap port anchors to edges',
      exact: true,
    });
    const stability = page.getByRole('checkbox', {
      name: 'Stable port anchor snapping',
      exact: true,
    });
    const frame = surface.locator('[data-flow-node="review"]');
    const zoom = async () =>
      Number((await page.locator('[data-flow-zoom-level]').textContent()).replace('%', '')) / 100;
    const center = async () => {
      const port = await socket().boundingBox();
      const canvas = await surface.boundingBox();
      return { x: port.x + port.width / 2 - canvas.x, y: port.y + port.height / 2 - canvas.y };
    };
    const expectCenter = async (expected) => {
      await expect
        .poll(async () => {
          const point = await center();
          return Math.hypot(point.x - expected.x, point.y - expected.y);
        })
        .toBeLessThan(0.1);
    };
    const gap = async (edge) => {
      const node = await frame.boundingBox();
      const port = await socket().boundingBox();
      const scale = await zoom();
      const border = await frame.evaluate((element) => ({
        x: element.clientLeft,
        y: element.clientTop,
      }));
      return edge === 'left'
        ? port.x + port.width / 2 - node.x - border.x * scale
        : port.y + port.height / 2 - node.y - border.y * scale;
    };
    const begin = async () => {
      await inspector.scrollIntoViewIfNeeded();
      await handle().scrollIntoViewIfNeeded();
      const box = await handle().boundingBox();
      const dimensions = await frame.evaluate((element) => ({
        width: element.clientWidth,
        height: element.clientHeight,
      }));
      const scale = await zoom();
      const base = { x: await gap('left'), y: await gap('top') };
      const origin = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(origin.x, origin.y);
      await page.mouse.down();
      return {
        halfX: (dimensions.width * scale) / 2,
        halfY: (dimensions.height * scale) / 2,
        move: async (x, y) =>
          page.mouse.move(origin.x + x - base.x, origin.y + y - base.y, { steps: 6 }),
      };
    };
    const corners = page.getByRole('checkbox', {
      name: 'Snap port anchors to corners',
      exact: true,
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Review').click();
    await page.getByRole('checkbox', { name: 'Drag port anchors', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await expect(corners).not.toBeChecked();
    await expect(snapping).not.toBeChecked();
    const before = await center();
    let grab = await begin();
    await grab.move(6, 8);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-corner');
    await expect.poll(() => gap('left')).toBeGreaterThan(4);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(before);
    await corners.dblclick();
    await expect(corners).not.toBeChecked();
    await corners.check();
    await stability.check();
    await bypassOption.check();
    grab = await begin();
    await expect(corners).toBeDisabled();
    await grab.move(6, 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-left');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    await expect(handle()).toHaveText('◆ Pinned top-left');
    await expect(handle()).toHaveAccessibleDescription(
      'Snapped to top-left corner. Hold Alt to bypass snapping. Escape cancels.',
    );
    await expect.poll(() => gap('left')).toBeLessThan(1);
    await expect.poll(() => gap('top')).toBeLessThan(1);
    await grab.move(15, 0);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-left');
    await page.keyboard.down('Alt');
    await expect(handle()).toHaveAttribute('data-flow-anchor-bypassed', 'true');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-corner');
    await expect.poll(() => gap('left')).toBeGreaterThan(13);
    await page.keyboard.up('Alt');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-corner');
    await grab.move(6, 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-left');
    await page.keyboard.down('Alt');
    await expect.poll(() => gap('top')).toBeGreaterThan(6);
    await page.keyboard.up('Alt');
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-left');
    await grab.move(grab.halfX * 2 - 6, 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-right');
    await grab.move(6, grab.halfY * 2 - 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'bottom-left');
    await grab.move(grab.halfX * 2 - 6, grab.halfY * 2 - 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'bottom-right');
    const screenshot = process.env.FLOW_PORT_ANCHOR_CORNER_SCREENSHOT;
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
    const saved = await center();
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-corner');
    await expect(button('source:out → review:in')).toBeVisible();
    await button('Undo').click();
    await expectCenter(before);
    await button('Redo').click();
    await expectCenter(saved);
    await button('Select Review').click();
    await button('Zoom out').click();
    await expect(page.locator('[data-flow-zoom-level]')).not.toHaveText('100%');
    const atZoom = await center();
    // Corner-only mode at zoom: inside each axis but outside the circular radius.
    grab = await begin();
    await grab.move(10, 10);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-corner');
    await grab.move(6, 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-left');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(atZoom);
    // Bypass held before pointer-down commits the precise position and undoes once.
    await page.keyboard.down('Alt');
    grab = await begin();
    await grab.move(6, 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-bypassed', 'true');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-corner');
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await expect.poll(() => gap('top')).toBeGreaterThan(6);
    await button('Undo').click();
    await expectCenter(atZoom);
    await expect(corners).toBeChecked();
    await expect(snapping).not.toBeChecked();
    // Both modes: radial miss falls back to an edge; a corner takes precedence.
    await button('Select Review').click();
    await snapping.check();
    grab = await begin();
    await grab.move(6, grab.halfY);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    await grab.move(6, 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-left');
    await grab.move(grab.halfX, 6);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-corner');
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'top');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(atZoom);
    expect(errors).toEqual([]);
    console.log(
      'Opt-in circular corner snapping covers all corners, custom feedback, zoom, hysteresis, stationary/held bypass, Undo/Redo, Escape and edge fallback',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
