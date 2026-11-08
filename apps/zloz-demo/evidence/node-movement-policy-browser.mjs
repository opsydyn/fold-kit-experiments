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
    const status = page.locator('[data-flow-status]');
    const lock = page.getByRole('checkbox', { name: 'Lock Review and Domain model' });
    const review = button('Select Review');
    const reviewFrame = surface.locator('[data-flow-node="review"]');
    const publishFrame = surface.locator('[data-flow-node="publish"]');
    const drag = async (handle) => {
      await handle.scrollIntoViewIfNeeded();
      const bounds = await handle.boundingBox();
      const x = bounds.x + bounds.width / 2;
      const y = bounds.y + bounds.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 45, y + 20, { steps: 6 });
      await page.mouse.up();
    };

    await page.goto('http://127.0.0.1:' + server.address().port);
    await lock.check();
    await expect(review).toHaveAttribute('data-flow-move-locked', '');
    await expect(review).toHaveAttribute('title', 'Review is locked in place.');
    await expect(review).toBeEnabled();
    await button('Fit view').click();
    await drag(review);
    await expect(review).toHaveAttribute('aria-pressed', 'true');
    await expect(status).toHaveText('Review is locked in place.');
    await expect(reviewFrame).toHaveCSS('left', '360px');
    await expect(reviewFrame).toHaveCSS('top', '150px');
    await review.press('ArrowRight');
    await expect(reviewFrame).toHaveCSS('left', '360px');

    await status.scrollIntoViewIfNeeded();
    const canvas = await surface.boundingBox();
    const control = await lock.boundingBox();
    await page.screenshot({
      path: '/tmp/foldkit-zloz-node-movement-policy.png',
      clip: {
        x: canvas.x - 12,
        y: control.y - 18,
        width: canvas.width + 24,
        height: canvas.y + canvas.height - control.y + 40,
      },
    });

    await button('Select Publish').press('ArrowRight');
    await expect(publishFrame).toHaveCSS('left', '645px');
    await button('Undo').click();
    await expect(publishFrame).toHaveCSS('left', '640px');

    await button('Open grouped Onion Architecture').click();
    await button('Collapse Application core').click();
    await expect(button('Select Domain model')).toHaveCount(0);
    const group = button('Select Application core');
    const groupFrame = surface.locator('[data-flow-group="core"]');
    await expect(group).toHaveAttribute('title', 'Domain model is locked in place.');
    await drag(group);
    await expect(status).toHaveText('Domain model is locked in place.');
    await expect(groupFrame).toHaveCSS('left', '255px');
    await group.press('ArrowRight');
    await expect(groupFrame).toHaveCSS('left', '255px');
    await lock.uncheck();
    await expect(group).not.toHaveAttribute('data-flow-move-locked', '');
    await group.press('ArrowRight');
    await expect(groupFrame).toHaveCSS('left', '260px');
    expect(errors).toEqual([]);
    console.log('Locked drag, keyboard movement, collapsed group and allowed Undo passed.');
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
