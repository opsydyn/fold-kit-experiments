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
      viewport: { width: 1280, height: 1100 },
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const lock = page.getByRole('checkbox', {
      name: 'Lock Review and Application core dimensions',
    });
    const review = button('Select Review');
    const reviewFrame = surface.locator('[data-flow-node="review"]');
    const publishFrame = surface.locator('[data-flow-node="publish"]');

    await page.goto('http://127.0.0.1:' + server.address().port);
    await lock.check();
    await expect(button('Resize Review')).toHaveCount(0);
    await expect(page.getByRole('slider', { name: 'Width for Review' })).toBeDisabled();
    await review.press('ArrowRight');
    await expect(reviewFrame).toHaveCSS('left', '365px');
    await expect(reviewFrame).toHaveCSS('width', '180px');
    await button('Undo').click();
    await expect(reviewFrame).toHaveCSS('left', '360px');
    await button('Resize Publish').press('ArrowRight');
    await expect(publishFrame).toHaveCSS('width', '185px');
    await button('Undo').click();
    await expect(publishFrame).toHaveCSS('width', '180px');

    await button('Open grouped Onion Architecture').click();
    const core = surface.locator('[data-flow-group="core"]');
    const selectCore = button('Select Application core');
    await selectCore.press('Enter');
    await expect(core.locator('[data-flow-group-resize]')).toHaveCount(0);
    await button('More actions for Application core').click();
    const panel = page.locator('[data-flow-context-panel]');
    const width = panel.getByRole('spinbutton', { name: 'Width of Application core' });
    const height = panel.getByRole('spinbutton', { name: 'Height of Application core' });
    await expect(width).toBeDisabled();
    await expect(height).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Fit group to contents' })).toBeDisabled();
    await expect(panel).toContainText('Application core dimensions are locked.');
    await surface.screenshot({ path: '/tmp/foldkit-flow-node-resize-policy.png' });

    await panel.getByRole('button', { name: 'Close' }).click();
    await lock.uncheck();
    await button('More actions for Application core').click();
    await expect(width).toBeEnabled();
    await expect(height).toBeEnabled();
    await expect(panel.getByRole('button', { name: 'Fit group to contents' })).toBeEnabled();
    expect(errors).toEqual([]);
    console.log('Locked dimensions, independent movement, group controls and Undo passed.');
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
