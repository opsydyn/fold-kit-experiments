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
    const midpoints = page.getByRole('checkbox', {
      name: 'Snap port anchors to midpoints',
      exact: true,
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Review').click();
    await page.getByRole('checkbox', { name: 'Drag port anchors', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await expect(midpoints).not.toBeChecked();
    await expect(corners).not.toBeChecked();
    await expect(snapping).not.toBeChecked();
    const before = await center();
    let grab = await begin();
    await grab.move(6, grab.halfY + 8);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-midpoint');
    await expect.poll(() => gap('left')).toBeGreaterThan(4);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(before);
    await midpoints.dblclick();
    await expect(midpoints).not.toBeChecked();
    await midpoints.check();
    await stability.check();
    await bypassOption.check();
    grab = await begin();
    await expect(midpoints).toBeDisabled();
    await grab.move(6, grab.halfY + 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-corner');
    await expect(handle()).toHaveText('⊙ Centered left');
    await expect(handle()).toHaveAccessibleDescription(
      'Snapped to left midpoint. Hold Alt to bypass snapping. Escape cancels.',
    );
    await expect.poll(() => gap('left')).toBeLessThan(1);
    await expect.poll(() => gap('top')).toBeCloseTo(grab.halfY, 0);
    await grab.move(15, grab.halfY);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await page.keyboard.down('Alt');
    await expect(handle()).toHaveAttribute('data-flow-anchor-bypassed', 'true');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-midpoint');
    await expect.poll(() => gap('left')).toBeGreaterThan(13);
    await page.keyboard.up('Alt');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-midpoint');
    await grab.move(6, grab.halfY + 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await page.keyboard.down('Alt');
    await expect.poll(() => gap('left')).toBeGreaterThan(4);
    await page.keyboard.up('Alt');
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await grab.move(grab.halfX * 2 - 6, grab.halfY + 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'right');
    await grab.move(grab.halfX + 8, 6);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'top');
    await grab.move(grab.halfX + 8, grab.halfY * 2 - 6);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'bottom');
    const screenshot = process.env.FLOW_PORT_ANCHOR_MIDPOINT_SCREENSHOT;
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
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-midpoint');
    await expect(button('source:out → review:in')).toBeVisible();
    await button('Undo').click();
    await expectCenter(before);
    await button('Redo').click();
    await expectCenter(saved);
    await button('Select Review').click();
    await button('Zoom out').click();
    await expect(page.locator('[data-flow-zoom-level]')).not.toHaveText('100%');
    const atZoom = await center();
    // Midpoint-only at zoom: each axis is close but the diagonal is outside 12px.
    grab = await begin();
    await grab.move(10, grab.halfY + 10);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-midpoint');
    await grab.move(6, grab.halfY + 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(atZoom);
    await page.keyboard.down('Alt');
    grab = await begin();
    await grab.move(6, grab.halfY + 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-bypassed', 'true');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-midpoint');
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await expect.poll(() => gap('left')).toBeGreaterThan(4);
    await button('Undo').click();
    await expectCenter(atZoom);
    await expect(midpoints).toBeChecked();
    await expect(corners).not.toBeChecked();
    await expect(snapping).not.toBeChecked();
    // All modes share one drag, with distinct feedback and precedence.
    await button('Select Review').click();
    await corners.check();
    await snapping.check();
    grab = await begin();
    await grab.move(6, 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-left');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-midpoint');
    await grab.move(6, grab.halfY + 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-corner');
    await grab.move(6, grab.halfY + 30);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-midpoint');
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'left');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(atZoom);
    expect(errors).toEqual([]);
    console.log(
      'Opt-in midpoint snapping covers four centers, custom feedback, circular zoom thresholds, hysteresis, stationary/held bypass, Undo/Redo, Escape and corner/edge priority',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
