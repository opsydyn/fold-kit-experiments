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
    const preference = page.getByRole('checkbox', {
      name: 'Snap port anchors to edges',
      exact: true,
    });
    const frame = surface.locator('[data-flow-node="review"]');
    const size = () =>
      frame.evaluate((element) => ({
        width: element.clientWidth,
        height: element.clientHeight,
        border: element.clientTop,
      }));
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
    const gap = async (edge) => {
      const node = await frame.boundingBox();
      const port = await socket().boundingBox();
      const dimensions = await size();
      const scale = await zoom();
      const top = node.y + dimensions.border * scale;
      const point = port.y + port.height / 2;
      return edge === 'top' ? point - top : top + dimensions.height * scale - point;
    };
    const drag = async (dx, dy) => {
      await inspector.scrollIntoViewIfNeeded();
      await handle().scrollIntoViewIfNeeded();
      const box = await handle().boundingBox();
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
      return start;
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Review').click();
    await page.getByRole('checkbox', { name: 'Drag port anchors', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await expect(preference).not.toBeChecked();
    await preference.dblclick();
    await expect(preference).not.toBeChecked();
    const dimensions = await size();
    const before = await center();
    const dx = dimensions.width / 2;
    const dy = -dimensions.height / 2 + 7;
    await drag(dx, dy);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    await expect.poll(() => gap('top')).toBeGreaterThan(3);
    await page.mouse.up();
    await button('Undo').click();
    await expectCenter(before);
    await button('Select Review').click();
    await preference.check();
    const origin = await drag(dx, dy);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'top');
    await expect.poll(() => gap('top')).toBeLessThan(1);
    await page.mouse.move(origin.x + dx, origin.y + dy + 20, { steps: 5 });
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    await expect.poll(() => gap('top')).toBeGreaterThan(15);
    await page.mouse.move(origin.x + dx, origin.y + dy, { steps: 5 });
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'top');
    await expect(handle()).toHaveAccessibleDescription('Snapped to top edge. Escape cancels.');
    const screenshot = process.env.FLOW_PORT_EDGE_SNAP_SCREENSHOT;
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
    await button('Zoom out').click();
    await expect(page.locator('[data-flow-zoom-level]')).not.toHaveText('100%');
    const scale = await zoom();
    const topAtZoom = await center();
    await drag(0, dimensions.height * scale - 7);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'bottom');
    await expect.poll(() => gap('bottom')).toBeLessThan(1);
    await page.mouse.up();
    await button('Undo').click();
    await expectCenter(topAtZoom);
    await button('Select Review').click();
    await preference.uncheck();
    await drag(0, dimensions.height * scale - 7);
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-snapped');
    await expect.poll(() => gap('bottom')).toBeGreaterThan(3);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(topAtZoom);
    await preference.check();
    await drag(0, dimensions.height * scale - 7);
    await expect(handle()).toHaveAttribute('data-flow-anchor-snapped', 'bottom');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(topAtZoom);
    await button('Open port snapping demo').click();
    await expect(preference).toBeChecked();
    expect(errors).toEqual([]);
    console.log(
      'Opt-in edge attraction retains free placement, fixed screen radius at zoom, visible feedback, release, Undo/Redo, Escape and session preference',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
