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
const qualify = async () => {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const surface = page.locator('[data-flow-surface]');
    const mode = page.getByRole('combobox', { name: 'Wheel navigation', exact: true });
    const camera = () =>
      surface.evaluate((element) => {
        const world = [...element.children].find((child) =>
          child.style.transform.startsWith('translate'),
        );
        const matrix = new DOMMatrix(getComputedStyle(world).transform);
        return { x: matrix.e, y: matrix.f, zoom: matrix.a };
      });
    const moveToCanvas = async () => {
      await surface.scrollIntoViewIfNeeded();
      const box = await surface.boundingBox();
      await page.mouse.move(Math.round(box.x + 500), Math.round(box.y + 75));
      return { x: Math.round(box.x + 500) - box.x, y: Math.round(box.y + 75) - box.y };
    };
    const worldPoint = (point, viewport) => ({
      x: (point.x - viewport.x) / viewport.zoom,
      y: (point.y - viewport.y) / viewport.zoom,
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await expect(mode).toHaveValue('zoom');
    await moveToCanvas();
    await page.mouse.wheel(0, -80);
    await expect.poll(async () => (await camera()).zoom).toBeGreaterThan(1);
    await page.reload();
    await mode.selectOption('pan');
    await expect(surface).toHaveAttribute('data-flow-wheel-navigation', 'pan');
    await expect(surface).toHaveAccessibleDescription(/Scroll to pan.*Ctrl or Command/);
    const cursor = await moveToCanvas();
    await page.mouse.wheel(-40, -60);
    await expect.poll(camera).toEqual({ x: 40, y: 60, zoom: 1 });
    const before = worldPoint(cursor, await camera());
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -80);
    await page.keyboard.up('Control');
    await expect.poll(async () => (await camera()).zoom).toBeGreaterThan(1);
    const after = worldPoint(cursor, await camera());
    expect(after.x).toBeCloseTo(before.x, 2);
    expect(after.y).toBeCloseTo(before.y, 2);
    await page.locator('#flow-demo').screenshot({ path: '/tmp/foldkit-flow-wheel-navigation.png' });
    expect(await exportGraph()).toEqual(initial);

    await mode.selectOption('off');
    await expect(surface).toHaveAttribute('data-flow-wheel-navigation', 'off');
    await expect(surface).not.toHaveAccessibleDescription(/Scroll to (pan|zoom)/);
    await moveToCanvas();
    const frozen = await camera();
    const scroll = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, -140);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(scroll);
    expect(await camera()).toEqual(frozen);
    expect(errors).toEqual([]);
    console.log(
      'Default zoom, two-axis pan, cursor-anchored modifier zoom, and page scrolling passed',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
