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
      viewport: { width: 1280, height: 2000 },
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const controls = page.getByRole('group', { name: 'Item visibility' });
    const hideNode = controls.getByRole('checkbox', { name: 'Hide Review node' });
    const hideEdge = controls.getByRole('checkbox', { name: 'Hide Draft → Review edge' });
    const surface = page.locator('[data-flow-surface]');
    const status = page.locator('[data-flow-status]');
    const review = surface.locator('[data-flow-node="review"]');
    const edge = surface.locator('[data-flow-edge="draft-review"]');
    const minimapNodes = surface.locator(
      '[data-flow-minimap] rect:not([data-flow-minimap-viewport])',
    );
    const connection = page
      .getByRole('group', { name: 'Connections', exact: true })
      .getByRole('button', { name: 'source:out → review:in', exact: true });
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };

    await page.goto('http://127.0.0.1:' + server.address().port);
    await expect(minimapNodes).toHaveCount(3);
    const original = await exportGraph();
    await connection.click();
    await expect(connection).toHaveAttribute('aria-pressed', 'true');
    await hideEdge.check();
    await expect(edge).toHaveCount(0);
    await expect(connection).toHaveCount(0);
    await expect(review).toBeVisible();
    await expect(minimapNodes).toHaveCount(3);
    await hideEdge.uncheck();
    await expect(connection).toHaveAttribute('aria-pressed', 'false');
    await expect(edge).toBeVisible();

    await button('Select Review').click();
    await hideNode.check();
    await expect(review).toHaveCount(0);
    await expect(minimapNodes).toHaveCount(2);
    await expect(edge).toHaveCount(0);
    await expect(connection).toHaveCount(0);
    await expect(status).toHaveText('2 nodes, 0 connections');
    expect(await exportGraph()).toEqual(original);

    await page
      .getByRole('combobox', { name: 'Box selection match', exact: true })
      .selectOption('partial');
    await button('Box select').click();
    await surface.scrollIntoViewIfNeeded();
    const box = await surface.boundingBox();
    await page.mouse.move(box.x + 430, box.y + 110);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 200, { steps: 6 });
    await expect(surface.locator('[data-flow-selection-preview]')).toHaveAttribute(
      'data-flow-node',
      'source',
    );
    await page.mouse.up();
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await button('Fit view').click();

    const filter = await controls.boundingBox();
    const notice = await status.boundingBox();
    await page.screenshot({
      path: '/tmp/foldkit-flow-item-visibility.png',
      clip: {
        x: box.x,
        y: filter.y,
        width: box.width,
        height: notice.y + notice.height + 4 - filter.y,
      },
    });

    await hideEdge.check();
    await hideNode.uncheck();
    await expect(review).toBeVisible();
    await expect(button('Select Review')).toHaveAttribute('aria-pressed', 'false');
    await expect(minimapNodes).toHaveCount(3);
    await expect(connection).toHaveCount(0);
    await hideEdge.uncheck();
    await expect(edge).toBeVisible();
    await expect(connection).toBeVisible();
    expect(await exportGraph()).toEqual(original);
    expect(errors).toEqual([]);
    console.log(
      'Visibility synchronizes canvas, minimap, connections and marquee while preserving graph export',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
