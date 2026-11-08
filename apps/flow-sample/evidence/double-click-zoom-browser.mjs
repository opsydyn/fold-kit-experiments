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
    const level = page.locator('[data-flow-zoom-level]');
    const preference = page.getByRole('checkbox', { name: 'Double-click zoom' });
    const draftLabel = page.getByRole('textbox', { name: 'Label for source' });
    const anchor = { x: 150, y: 52 };
    async function doubleClickBackground() {
      await surface.scrollIntoViewIfNeeded();
      const canvas = await surface.boundingBox();
      await page.mouse.dblclick(canvas.x + anchor.x, canvas.y + anchor.y);
    }
    async function draftPosition() {
      const [canvas, node] = await Promise.all([
        surface.boundingBox(),
        surface.locator('[data-flow-node="source"]').boundingBox(),
      ]);
      return { x: node.x - canvas.x, y: node.y - canvas.y };
    }
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByRole('combobox', { name: 'Wheel navigation' }).selectOption('off');
    await page.getByRole('checkbox', { name: /Constrain camera/ }).check();
    await draftLabel.fill('Draft revised');
    await preference.uncheck();
    await doubleClickBackground();
    await expect(level).toHaveText('100%');

    await preference.check();
    const before = await draftPosition();
    await doubleClickBackground();
    await expect(level).toHaveText('125%');
    await doubleClickBackground();
    await expect(level).toHaveText('130%');
    const after = await draftPosition();
    expect(Math.abs(after.x - (anchor.x + (before.x - anchor.x) * 1.3))).toBeLessThan(2);
    expect(Math.abs(after.y - (anchor.y + (before.y - anchor.y) * 1.3))).toBeLessThan(2);

    const screenshot = process.env.FLOW_DOUBLE_CLICK_ZOOM_SCREENSHOT;
    if (screenshot) {
      const canvas = await surface.boundingBox();
      const help = await page.locator('[data-flow-help]').boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvas.x,
          y: help.y - 4,
          width: canvas.width,
          height: canvas.y + canvas.height - help.y + 4,
        },
      });
    }
    await button('Zoom out').click();
    await expect(level).toHaveText('104%');
    await draftLabel.dblclick();
    await button('Select Draft revised').dblclick();
    await expect(level).toHaveText('104%');
    await button('Box select').click();
    await doubleClickBackground();
    await expect(level).toHaveText('104%');
    await button('Box select').click();
    await button('Zoom to area').click();
    await doubleClickBackground();
    await expect(level).toHaveText('104%');
    await expect(button('Zoom to area')).toHaveAttribute('aria-pressed', 'false');
    await button('Undo').click();
    await expect(draftLabel).toHaveValue('Draft');
    await expect(level).toHaveText('104%');
    expect(errors).toEqual([]);
    console.log(
      'Double-click zoom anchors at the pointer, clamps to the camera limit, and leaves controls and box gestures alone',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
