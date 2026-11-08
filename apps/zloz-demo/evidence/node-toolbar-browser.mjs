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
    const design = page.getByRole('combobox', { name: 'Node toolbar', exact: true });
    const surface = page.locator('[data-flow-surface]');
    const toolbar = surface.locator('[data-flow-node-toolbar]');
    const review = surface.locator('[data-flow-node="review"]');
    const nodes = surface.locator('[data-flow-node]');
    const position = async () => {
      const [bar, node] = await Promise.all([toolbar.boundingBox(), review.boundingBox()]);
      return {
        width: bar.width,
        height: bar.height,
        nodeWidth: node.width,
        nodeX: node.x,
        gap: bar.y - (node.y + node.height),
        center: bar.x + bar.width / 2 - (node.x + node.width / 2),
      };
    };

    await page.goto('http://127.0.0.1:' + server.address().port);
    await design.selectOption('standard');
    await button('Select Review').press('Enter');
    await expect(toolbar).toHaveAttribute('data-flow-node-toolbar', 'review');
    await expect(toolbar.getByRole('button', { name: 'Duplicate node' })).toBeVisible();
    await design.selectOption('compact');
    await expect(toolbar.locator('.compact-node-actions')).toBeVisible();

    const start = await position();
    await button('Zoom in').click();
    await expect.poll(async () => (await position()).nodeWidth).toBeGreaterThan(start.nodeWidth);
    const zoomed = await position();
    expect(zoomed.width).toBeCloseTo(start.width, 1);
    expect(zoomed.height).toBeCloseTo(start.height, 1);
    expect(zoomed.gap).toBeCloseTo(12, 0);
    expect(zoomed.center).toBeCloseTo(0, 0);

    await surface.scrollIntoViewIfNeeded();
    await page.getByRole('combobox', { name: 'Wheel navigation' }).selectOption('pan');
    const canvas = await surface.boundingBox();
    await page.mouse.move(canvas.x + 60, canvas.y + 365);
    await page.mouse.wheel(-35, -20);
    await expect.poll(async () => (await position()).nodeX).toBeGreaterThan(zoomed.nodeX);
    const panned = await position();
    expect(panned.width).toBeCloseTo(start.width, 1);
    expect(panned.height).toBeCloseTo(start.height, 1);
    expect(panned.gap).toBeCloseTo(12, 0);
    expect(panned.center).toBeCloseTo(0, 0);

    await button('Protect required items').click();
    const deleteNode = toolbar.getByRole('button', { name: 'Delete node' });
    await expect(deleteNode).toBeDisabled();
    await expect(deleteNode).toHaveAttribute('title', 'This connection is required.');
    await button('Protect required items').click();
    await expect(deleteNode).toBeEnabled();
    await button('Zoom out').click();
    await expect.poll(async () => (await position()).nodeWidth).toBeLessThan(panned.nodeWidth);
    await surface.screenshot({ path: '/tmp/foldkit-zloz-node-toolbar.png' });

    await toolbar.getByRole('button', { name: 'Duplicate node' }).click();
    await expect(nodes).toHaveCount(4);
    await button('Undo').click();
    await expect(nodes).toHaveCount(3);
    await button('Select Review').press('Enter');
    await deleteNode.click();
    await expect(nodes).toHaveCount(2);
    await expect(toolbar).toHaveCount(0);
    await button('Undo').click();
    await expect(nodes).toHaveCount(3);

    await button('Select Review').press('Enter');
    await button('Select Draft').press('Shift+Enter');
    await expect(toolbar).toHaveCount(0);
    await button('Select Review').press('Enter');
    await expect(toolbar).toHaveCount(1);
    await design.selectOption('off');
    await expect(toolbar).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      'Node toolbar kept its size and 12px gap through zoom and pan. Policy, undo and visibility passed.',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
