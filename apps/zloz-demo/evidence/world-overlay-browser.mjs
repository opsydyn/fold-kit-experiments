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
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const layer = surface.locator('[data-flow-world-overlay]');
    const leader = layer.locator('[data-release-gate-leader]');
    const annotation = layer.getByRole('button', { name: 'Inspect Review' });
    const review = surface.locator('[data-flow-node="review"]');
    const position = async () => {
      const [item, node] = await Promise.all([annotation.boundingBox(), review.boundingBox()]);
      return {
        width: item.width,
        nodeWidth: node.width,
        x: node.x,
        y: node.y,
        gap: node.y - (item.y + item.height),
        center: item.x + item.width / 2 - (node.x + node.width / 2),
      };
    };

    await page.goto('http://127.0.0.1:' + server.address().port);
    await expect(layer).toHaveCount(0);
    await button('World annotation').click();
    await expect(annotation).toBeVisible();
    await annotation.press('Enter');
    await expect(button('Select Review')).toHaveAttribute('aria-pressed', 'true');
    await annotation.press('Delete');
    await expect(surface.locator('[data-flow-node]')).toHaveCount(3);
    const start = await position();
    expect(start.center).toBeCloseTo(0, 0);
    expect(start.gap).toBeCloseTo(14, 0);

    await button('Zoom in').click();
    await expect.poll(async () => (await position()).nodeWidth).toBeGreaterThan(start.nodeWidth);
    const zoomed = await position();
    const factor = zoomed.nodeWidth / start.nodeWidth;
    expect(zoomed.width).toBeCloseTo(start.width * factor, 1);
    expect(zoomed.gap).toBeCloseTo(start.gap * factor, 0);
    expect(zoomed.center).toBeCloseTo(0, 0);

    await page.getByRole('combobox', { name: 'Wheel navigation' }).selectOption('pan');
    await leader.scrollIntoViewIfNeeded();
    const line = await leader.boundingBox();
    await page.mouse.move(line.x + line.width / 2, line.y + line.height / 2);
    await page.mouse.wheel(-120, -20);
    await expect.poll(async () => (await position()).x).toBeGreaterThan(zoomed.x);
    const panned = await position();
    expect(panned.width).toBeCloseTo(zoomed.width, 1);
    expect(panned.gap).toBeCloseTo(zoomed.gap, 0);
    expect(panned.center).toBeCloseTo(0, 0);

    const handle = await button('Select Review').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 45, handle.y + handle.height / 2 + 24, {
      steps: 6,
    });
    await page.mouse.up();
    await expect.poll(async () => (await position()).x).toBeGreaterThan(panned.x + 20);
    const moved = await position();
    expect(moved.gap).toBeCloseTo(panned.gap, 0);
    expect(moved.center).toBeCloseTo(0, 0);

    await surface.screenshot({ path: '/tmp/foldkit-zloz-world-overlay.png' });
    await button('Minimal mode').click();
    await expect(annotation).toBeVisible();
    await button('World annotation').click();
    await expect(layer).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      'World overlay followed zoom, pan and node movement. Host input and visibility passed.',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
