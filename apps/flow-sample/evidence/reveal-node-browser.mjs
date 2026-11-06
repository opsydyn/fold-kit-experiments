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
      viewport: { width: 1280, height: 1500 },
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const search = page.getByRole('searchbox', { name: 'Find a node' });
    const surface = page.locator('[data-flow-surface]');
    const node = (id) => surface.locator('[data-flow-node="' + id + '"]');
    const centerOffset = async (id) => {
      const [canvas, frame] = await Promise.all([surface.boundingBox(), node(id).boundingBox()]);
      return Math.hypot(
        frame.x + frame.width / 2 - canvas.x - canvas.width / 2,
        frame.y + frame.height / 2 - canvas.y - canvas.height / 2,
      );
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Draft').click();
    await search.fill(' PuBLish ');
    await expect(button('Reveal Publish (publish)')).toBeVisible();
    await search.press('Enter');
    await expect.poll(() => centerOffset('publish')).toBeLessThan(3);
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('checkbox', { name: 'Hide Review node' }).check();
    await search.fill('review');
    await expect(page.getByText('No matching nodes', { exact: true })).toBeVisible();
    await expect(button('Reveal first match')).toBeDisabled();

    await button('Open grouped Onion Architecture').click();
    await button('Collapse Application core').click();
    await button('Collapse Release system').click();
    await expect(node('domain')).toHaveCount(0);
    await search.fill('DOMAIN');
    await button('Reveal Domain model (domain)').click();
    await expect(button('Collapse Release system')).toBeVisible();
    await expect(button('Collapse Application core')).toBeVisible();
    await expect.poll(() => centerOffset('domain')).toBeLessThan(3);
    const screenshot = process.env.FLOW_REVEAL_SCREENSHOT;
    if (screenshot) {
      await surface.scrollIntoViewIfNeeded();
      const canvas = await surface.boundingBox();
      const form = await page.getByRole('search', { name: 'Diagram nodes' }).boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvas.x,
          y: form.y - 4,
          width: canvas.width,
          height: canvas.y + canvas.height - form.y + 31,
        },
      });
    }
    expect(errors).toEqual([]);
    console.log(
      'Reveal search centers nodes, preserves selection, excludes hidden nodes, and opens collapsed ancestors',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
