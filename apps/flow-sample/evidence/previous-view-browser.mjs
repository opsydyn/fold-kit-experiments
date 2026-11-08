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
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const previous = button('Back to previous view');
    const draft = page.getByRole('textbox', { name: 'Label for source', exact: true });
    async function frame(id) {
      const [canvas, node] = await Promise.all([
        surface.boundingBox(),
        surface.locator('[data-flow-node="' + id + '"]').boundingBox(),
      ]);
      return [node.x - canvas.x, node.y - canvas.y, node.width, node.height];
    }
    async function distance(id, origin) {
      const current = await frame(id);
      return Math.hypot(...current.map((value, index) => value - origin[index]));
    }

    await page.goto('http://127.0.0.1:' + server.address().port);
    await expect(previous).toBeDisabled();
    await draft.fill('Draft revised');
    await button('Select Draft revised').click();
    const original = await frame('source');
    await button('Fit selection').click();
    await expect(previous).toBeEnabled();
    await expect.poll(() => distance('source', original)).toBeGreaterThan(60);
    await previous.press('Enter');
    await expect.poll(() => distance('source', original)).toBeLessThan(2);
    await expect(previous).toBeDisabled();
    await expect(button('Select Draft revised')).toHaveAttribute('aria-pressed', 'true');
    await button('Undo').click();
    await expect(draft).toHaveValue('Draft');
    await expect.poll(() => distance('source', original)).toBeLessThan(2);

    await page.getByRole('combobox', { name: 'Navigation design' }).selectOption('compact');
    await button('Open grouped Onion Architecture').click();
    await expect(previous).toBeDisabled();
    await button('Collapse Application core').click();
    const beforeSearch = await frame('ui');
    const search = page.getByRole('searchbox', { name: 'Find a node' });
    await search.fill('domain');
    await button('Reveal Domain model (domain)').click();
    await expect(button('Collapse Application core')).toBeVisible();
    await expect.poll(() => distance('ui', beforeSearch)).toBeGreaterThan(60);
    await expect(
      page.locator('.compact-navigation').getByRole('button', { name: 'Back to previous view' }),
    ).toBeEnabled();
    const screenshot = process.env.FLOW_PREVIOUS_VIEW_SCREENSHOT;
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
          height: canvas.y + canvas.height - form.y + 4,
        },
      });
    }
    await previous.click();
    await expect.poll(() => distance('ui', beforeSearch)).toBeLessThan(2);
    await expect(button('Collapse Application core')).toBeVisible();
    await expect(previous).toBeDisabled();
    expect(errors).toEqual([]);
    console.log(
      'Back restores the camera after Fit selection and search reveal, independently of graph Undo',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
