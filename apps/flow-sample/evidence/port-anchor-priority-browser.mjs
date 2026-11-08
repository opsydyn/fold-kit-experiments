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
    let target = { node: 'review', label: 'Review', port: 'in', direction: 'to' };
    const select = async (node, label, port, direction = 'to') => {
      target = { node, label, port, direction };
      await button('Select ' + label).click();
    };
    const inspector = () =>
      page.getByRole('group', { name: 'Ports for ' + target.label, exact: true });
    const handle = () => button('Position ' + target.label + ': ' + target.port);
    const socket = () =>
      button('Connect ' + target.direction + ' ' + target.label + ': ' + target.port);
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
    const frame = () => surface.locator('[data-flow-node="' + target.node + '"]');
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
      const node = await frame().boundingBox();
      const port = await socket().boundingBox();
      const scale = await zoom();
      const border = await frame().evaluate((element) => ({
        x: element.clientLeft,
        y: element.clientTop,
      }));
      return edge === 'left'
        ? port.x + port.width / 2 - node.x - border.x * scale
        : port.y + port.height / 2 - node.y - border.y * scale;
    };
    const begin = async () => {
      await inspector().scrollIntoViewIfNeeded();
      await handle().scrollIntoViewIfNeeded();
      const box = await handle().boundingBox();
      const dimensions = await frame().evaluate((element) => ({
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
    const priority = page.getByRole('combobox', { name: 'Port snap priority', exact: true });
    const overlap = page.getByRole('checkbox', {
      name: 'Overlapping port snap zones',
      exact: true,
    });
    const layer = page.locator('[data-flow-anchor-guides]');
    const activeGuide = page.locator('[data-flow-anchor-guide-active="true"]');
    const cancel = async () => {
      await page.keyboard.press('Escape');
      await page.mouse.up();
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await select('review', 'Review', 'in');
    await page.getByRole('checkbox', { name: 'Drag port anchors', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Port snap guides', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom snap guides', exact: true }).check();
    await bypassOption.check();
    await expect(priority).toHaveValue('corners-first');
    await expect(overlap).not.toBeChecked();
    await overlap.check();
    const before = await center();
    let grab = await begin();
    await expect(priority).toBeDisabled();
    await expect(overlap).toBeDisabled();
    await grab.move(15, grab.halfY / 2);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-left');
    await expect(activeGuide).toHaveAttribute('data-flow-anchor-guide', 'corner');
    await page.mouse.up();
    await expect(layer).toHaveCount(0);
    const cornerSaved = await center();
    await button('Undo').click();
    await expectCenter(before);
    await button('Redo').click();
    await expectCenter(cornerSaved);
    await select('review', 'Review', 'in');
    await priority.selectOption('midpoints-first');
    grab = await begin();
    await grab.move(15, grab.halfY / 2);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await expect(handle()).not.toHaveAttribute('data-flow-anchor-corner');
    await expect(page.locator('[data-flow-anchor-guide]')).toHaveCount(2);
    await expect(activeGuide).toHaveAttribute('data-flow-anchor-guide', 'midpoint');
    const screenshot = process.env.FLOW_PORT_ANCHOR_PRIORITY_SCREENSHOT;
    if (screenshot) {
      const panel = await inspector().boundingBox();
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
    await page.keyboard.down('Alt');
    await expect(layer).toHaveCount(0);
    await expect(handle()).toHaveAttribute('data-flow-anchor-bypassed', 'true');
    await expect.poll(() => gap('left')).toBeGreaterThan(13);
    await page.keyboard.up('Alt');
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await expect(activeGuide).toHaveAttribute('data-flow-anchor-guide', 'midpoint');
    await page.mouse.up();
    const midpointSaved = await center();
    await button('Undo').click();
    await expectCenter(cornerSaved);
    await expect(priority).toHaveValue('midpoints-first');
    await button('Redo').click();
    await expectCenter(midpointSaved);
    // A second port explicitly keeps corners first under the midpoint-first editor preference.
    await select('review', 'Review', 'out', 'from');
    const outputBefore = await center();
    grab = await begin();
    await grab.move(grab.halfX * 2 - 15, grab.halfY / 2);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-right');
    await expect(activeGuide).toHaveAttribute('data-flow-anchor-guide', 'corner');
    await page.mouse.up();
    const outputSaved = await center();
    await button('Undo').click();
    await expectCenter(outputBefore);
    await button('Redo').click();
    await expectCenter(outputSaved);
    await select('review', 'Review', 'in');
    await button('Zoom out').click();
    await expect(page.locator('[data-flow-zoom-level]')).not.toHaveText('100%');
    const atZoom = await center();
    grab = await begin();
    await grab.move(15, grab.halfY / 2);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await cancel();
    await expectCenter(atZoom);
    await page.keyboard.down('Alt');
    grab = await begin();
    await grab.move(15, grab.halfY / 2);
    await expect(handle()).toHaveAttribute('data-flow-anchor-bypassed', 'true');
    await expect(layer).toHaveCount(0);
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await button('Undo').click();
    await expectCenter(atZoom);
    await select('review', 'Review', 'in');
    await button('Protect Review input').click();
    await expect(handle()).toBeDisabled();
    await expect(handle()).toHaveAccessibleDescription('Review input is managed upstream.');
    await button('Protect Review input').click();
    // The preference persists across examples and still falls back when no midpoint mode is enabled.
    await overlap.uncheck();
    await page.getByRole('checkbox', { name: 'Snap port anchors to corners', exact: true }).check();
    await button('Open release workflow').click();
    await expect(priority).toHaveValue('midpoints-first');
    await select('review', 'Review', 'in');
    await overlap.check();
    grab = await begin();
    await grab.move(15, grab.halfY / 2);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await cancel();
    await overlap.uncheck();
    grab = await begin();
    await grab.move(6, 8);
    await expect(handle()).toHaveAttribute('data-flow-anchor-corner', 'top-left');
    await cancel();
    await expect(button('source:out → review:in')).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      'Corner/midpoint priority changes an overlapping winner, supports per-port precedence, captured bypass, guides, zoom, protection, example persistence, fallback and one-step Undo/Redo',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
