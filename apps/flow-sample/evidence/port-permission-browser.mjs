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
    const locks = page.getByRole('group', { name: 'Port connections' });
    const draftLock = locks.getByRole('checkbox', { name: 'Lock Draft output' });
    const publishLock = locks.getByRole('checkbox', { name: 'Lock Publish input' });
    const draft = button('Connect from Draft: out');
    const review = button('Connect from Review: out');
    const publish = button('Connect to Publish: in');
    const surface = page.locator('[data-flow-surface]');
    const preview = surface.locator('[data-flow-connection-preview]');
    const center = async (locator) => {
      const box = await locator.boundingBox();
      return [box.x + box.width / 2, box.y + box.height / 2];
    };

    await page.goto('http://127.0.0.1:' + server.address().port);
    await draftLock.check();
    await expect(draft).toBeDisabled();
    await expect(review).toBeEnabled();
    await expect(publish).toBeEnabled();
    await expect(surface.locator('[data-flow-edge="draft-review"]')).toBeVisible();
    await publishLock.check();
    await expect(publish).toBeDisabled();
    await expect(publish).toHaveAttribute('title', 'Publish input is closed to new connections.');
    await expect(button('Connect to Review: in')).toBeEnabled();

    await surface.scrollIntoViewIfNeeded();
    const destination = await center(publish);
    await page.mouse.move(...(await center(draft)));
    await page.mouse.down();
    await page.mouse.move(...destination, { steps: 8 });
    await expect(preview).toHaveCount(0);
    await page.mouse.up();

    await page.mouse.move(...(await center(review)));
    await page.mouse.down();
    await page.mouse.move(...destination, { steps: 8 });
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'invalid');
    const status = page.locator('[data-flow-status]');
    await expect(status).toBeVisible();
    await expect(status).toHaveText('Publish input is closed to new connections.');
    const box = await surface.boundingBox();
    const controls = await locks.boundingBox();
    const notice = await status.boundingBox();
    await page.screenshot({
      path: '/tmp/foldkit-flow-port-permission.png',
      clip: {
        x: box.x,
        y: controls.y,
        width: box.width,
        height: notice.y + notice.height + 4 - controls.y,
      },
    });
    await page.mouse.up();
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(1);

    const design = page.getByRole('combobox', { name: 'Node design' });
    await design.selectOption('orbits');
    await expect(surface.locator('.orbit-node')).toHaveCount(3);
    await expect(draft).toBeDisabled();
    await expect(publish).toBeDisabled();
    await publishLock.uncheck();
    await expect(publish).toBeEnabled();
    await review.press('Enter');
    await publish.press('Enter');
    await expect(button('review:out → publish:in')).toBeVisible();

    await button('source:out → review:in').click();
    await page
      .getByRole('combobox', { name: 'Target port' })
      .selectOption({ label: 'Publish: in' });
    await expect(button('source:out → publish:in')).toBeVisible();
    await expect(draft).toBeDisabled();
    expect(errors).toEqual([]);
    console.log(
      'Per-port locks preserve existing wires, reject pointer drops, and support composed controls and reconnection',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
