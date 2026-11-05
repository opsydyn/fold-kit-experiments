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
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
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
    const readout = surface.locator('[data-flow-resize-readout]');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page
      .getByRole('combobox', { name: 'Resize readout', exact: true })
      .selectOption('labeled');
    const initial = await exportGraph();
    await button('Select Draft').click();
    await expect(readout).toHaveCount(0);
    const resize = button('Resize Draft');
    await resize.scrollIntoViewIfNeeded();
    const box = await resize.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2, { steps: 5 });
    await expect(readout.locator('.labeled-resize-readout')).toBeVisible();
    await expect(readout).toHaveAttribute('aria-live', 'polite');
    await expect(readout).toHaveAttribute('aria-label', 'Draft dimensions in graph units');
    const title = await readout.getAttribute('title');
    await surface.screenshot({ path: '/tmp/foldkit-flow-resize-node.png' });
    await page.mouse.up();
    await expect(readout).toHaveCount(0);
    const resized = (await exportGraph()).nodes.find((node) => node.id === 'source');
    expect(title).toBe(
      `Draft: ${Number(resized.size.width.toFixed(2))} × ${Number(resized.size.height.toFixed(2))} graph units`,
    );
    expect(resized.size.width).toBeGreaterThan(initial.nodes[0].size.width);
    await button('Undo').click();
    expect(await exportGraph()).toEqual(initial);

    await button('Open grouped Onion Architecture').click();
    await button('Select Application core').click();
    await expect(readout).toHaveAttribute('title', 'Application core: 500 × 232 graph units');
    await button('Resize Application core from bottom right').press('ArrowRight');
    await expect(readout).toHaveAttribute('title', 'Application core: 505 × 232 graph units');
    await surface.screenshot({ path: '/tmp/foldkit-flow-resize-group.png' });
    await button('Undo').click();
    await button('Select Application core').click();
    await expect(readout).toHaveAttribute('title', 'Application core: 500 × 232 graph units');

    await button('Diagnostics').click();
    const measurements = page.getByRole('checkbox', { name: 'Measurements', exact: true });
    const diagnostics = page.getByRole('checkbox', { name: 'Show diagnostics', exact: true });
    await measurements.uncheck();
    await expect(readout).toHaveCount(0);
    await expect(button('Resize Application core from bottom right')).toBeVisible();
    await measurements.check();
    await expect(readout).toBeVisible();
    await diagnostics.uncheck();
    await expect(readout).toHaveCount(0);
    await diagnostics.check();
    await expect(readout).toBeVisible();
    await button('Minimal mode').click();
    await expect(readout).toHaveCount(0);
    await button('Minimal mode').click();
    await expect(readout).toBeVisible();
    await button('Collapse Application core').click();
    await expect(readout).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      'Custom card and group dimensions, pointer and keyboard resize, Undo, and diagnostics gates passed',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
