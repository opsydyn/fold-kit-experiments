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
    const toggle = page.getByRole('checkbox', {
      name: 'Exclude Review and its incoming connection from selection',
    });
    const review = button('Select Review');
    const draft = button('Select Draft');
    const connection = button('source:out → review:in');
    const surface = page.locator('[data-flow-surface]');
    const preview = surface.locator('[data-flow-selection-preview]');

    await page.goto('http://127.0.0.1:' + server.address().port);
    await review.click();
    await expect(review).toHaveAttribute('aria-pressed', 'true');
    await toggle.check();
    await expect(review).toBeDisabled();
    await expect(review).toHaveAttribute('aria-pressed', 'false');
    await expect(connection).toBeDisabled();
    await expect(surface.locator('[data-flow-edge="draft-review"]')).toBeVisible();

    await page
      .getByRole('combobox', { name: 'Box selection match', exact: true })
      .selectOption('partial');
    await button('Box select').click();
    await surface.scrollIntoViewIfNeeded();
    const box = await surface.boundingBox();
    await page.mouse.move(box.x + 430, box.y + 110);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 200, { steps: 6 });
    await expect(surface.locator('[data-flow-selection-box]')).toBeVisible();
    await expect
      .poll(() => preview.evaluateAll((nodes) => nodes.map((node) => node.dataset.flowNode)))
      .toEqual(['source']);
    await expect(draft).toHaveAttribute('aria-pressed', 'false');
    const switchBox = await toggle.boundingBox();
    await page.screenshot({
      path: '/tmp/foldkit-flow-selection-policy.png',
      clip: {
        x: box.x,
        y: switchBox.y - 8,
        width: box.width,
        height: box.y + box.height - switchBox.y + 8,
      },
    });
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(draft).toHaveAttribute('aria-pressed', 'true');
    await expect(review).toHaveAttribute('aria-pressed', 'false');

    await toggle.uncheck();
    await review.click();
    await expect(review).toHaveAttribute('aria-pressed', 'true');
    await connection.click();
    await expect(connection).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
    console.log(
      'Selection policy preserves visible items and agrees with marquee preview and release',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
