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
const qualify = async () => {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 2000 } });
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
    const guides = surface.locator('[data-flow-alignment-guide]');
    const horizontal = surface.locator('[data-flow-alignment-guide="y"]');
    const custom = guides.locator('.endpoint-alignment-guide');
    const design = page.getByRole('combobox', { name: 'Alignment guide design', exact: true });
    const node = (graph, id) => graph.nodes.find((item) => item.id === id);
    const zoom = () =>
      surface.evaluate((element) => {
        const layer = [...element.children].find((child) =>
          child.style.transform.startsWith('translate'),
        );
        return new DOMMatrix(getComputedStyle(layer).transform).a;
      });
    const drag = async (control, dx, dy) => {
      await surface.scrollIntoViewIfNeeded();
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 5 });
    };
    const lineCoordinates = (locator) =>
      locator.evaluate((element) =>
        ['x1', 'y1', 'x2', 'y2'].map((name) => element.getAttribute(name)),
      );

    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await drag(button('Select Review'), 0, -77);
    await expect(horizontal).toHaveCount(1);
    const standard = await lineCoordinates(horizontal);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(guides).toHaveCount(0);
    expect(await exportGraph()).toEqual(initial);

    await design.selectOption('endpoints');
    await drag(button('Select Review'), 0, -77);
    const customHorizontal = horizontal.locator('.endpoint-alignment-guide');
    await expect(customHorizontal).toHaveAttribute('data-guide-phase', 'drag');
    expect(await lineCoordinates(customHorizontal.locator('line'))).toEqual(standard);
    await expect(customHorizontal.locator('circle')).toHaveCount(2);
    await surface.screenshot({ path: '/tmp/foldkit-zloz-guide-drag.png' });
    await page.mouse.up();
    await expect(guides).toHaveCount(0);
    const moved = node(await exportGraph(), 'review');
    expect(moved.position.x).toBe(node(initial, 'review').position.x);
    expect(moved.position.y).toBe(node(initial, 'source').position.y);
    await button('Undo').click();
    expect(await exportGraph()).toEqual(initial);

    await button('Diagnostics').click();
    await page.getByRole('checkbox', { name: 'Alignment guides', exact: true }).uncheck();
    await drag(button('Select Review'), 0, -77);
    await expect(guides).toHaveCount(0);
    await page.mouse.up();
    expect(node(await exportGraph(), 'review').position).toEqual(moved.position);
    await button('Undo').click();
    await page.getByRole('checkbox', { name: 'Alignment guides', exact: true }).check();
    await button('Diagnostics').click();

    await button('Open grouped Onion Architecture').click();
    await button('Select Application core').click();
    const grouped = await exportGraph();
    const core = node(grouped, 'core');
    const neighbor = node(grouped, 'ui');
    const target = neighbor.position.x + neighbor.size.width;
    await drag(
      button('Resize Application core from left'),
      (target - core.position.x) * (await zoom()) + 3,
      0,
    );
    await expect(custom).toHaveAttribute('data-guide-phase', 'resize');
    await expect(custom.locator('line')).toHaveAttribute('x1', String(target));
    await surface.screenshot({ path: '/tmp/foldkit-zloz-guide-resize.png' });
    await page.mouse.up();
    await expect(guides).toHaveCount(0);
    expect(node(await exportGraph(), 'core').position.x).toBe(target);
    await button('Undo').click();
    expect(await exportGraph()).toEqual(grouped);
    expect(errors).toEqual([]);
    console.log(
      'Default and custom endpoints match, diagnostics preserve snapping, and drag/resize Undo passed',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
