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
    const preview = surface.locator('[data-flow-selection-preview]');
    const match = page.getByRole('combobox', { name: 'Box selection match', exact: true });
    const previewIds = () =>
      preview.evaluateAll((nodes) => nodes.map((node) => node.dataset.flowNode));
    const draw = async () => {
      await surface.scrollIntoViewIfNeeded();
      const box = await surface.boundingBox();
      await page.mouse.move(box.x + 430, box.y + 110);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 200, { steps: 6 });
      await expect(surface.locator('[data-flow-selection-box]')).toBeVisible();
      return box;
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await button('Select Publish').click();
    await button('Box select').click();
    await expect(button('Box select')).toHaveAttribute('aria-pressed', 'true');
    await draw();
    await expect(preview).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(button('Select Publish')).toHaveAttribute('aria-pressed', 'true');

    await match.selectOption('partial');
    const box = await draw();
    await expect.poll(previewIds).toEqual(['source', 'review']);
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'false');
    await expect(button('Select Publish')).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(box.x + 382, box.y + 180, { steps: 4 });
    await expect.poll(previewIds).toEqual(['review']);
    await page.mouse.move(box.x + 100, box.y + 200, { steps: 4 });
    await expect.poll(previewIds).toEqual(['source', 'review']);
    await surface.screenshot({ path: '/tmp/foldkit-zloz-selection-preview.png' });
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'true');
    await expect(button('Select Review')).toHaveAttribute('aria-pressed', 'true');
    await expect(button('Select Publish')).toHaveAttribute('aria-pressed', 'false');
    expect(await exportGraph()).toEqual(initial);

    await page.getByRole('combobox', { name: 'Node design', exact: true }).selectOption('orbits');
    await expect(surface.locator('.orbit-node')).toHaveCount(3);
    await button('Select Publish').click();
    await draw();
    await expect.poll(previewIds).toEqual(['source', 'review']);
    await expect(preview.locator('circle[stroke-dasharray="5 3"]')).toHaveCount(2);
    await surface.screenshot({ path: '/tmp/foldkit-zloz-selection-preview-orbits.png' });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(button('Select Publish')).toHaveAttribute('aria-pressed', 'true');
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'false');
    expect(errors).toEqual([]);
    console.log(
      'Live highlights track both match modes, default and custom shells, release, and Escape',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
