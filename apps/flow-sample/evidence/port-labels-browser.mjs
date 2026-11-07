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
    const surface = page.locator('[data-flow-surface]');
    const labels = surface.locator('[data-flow-port-label]');
    const primary = button('Connect to Publish: Primary');
    const badge = surface.locator('[data-flow-port-label="primary"][data-flow-owner="publish"]');
    const preference = page.getByRole('checkbox', { name: 'Port labels' });
    async function alignmentError() {
      const [port, label] = await Promise.all([primary.boundingBox(), badge.boundingBox()]);
      const zoom =
        Number((await page.locator('[data-flow-zoom-level]').textContent()).replace('%', '')) / 100;
      return Math.abs(port.x + port.width / 2 - label.x - label.width - 22 * zoom);
    }

    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Open port snapping demo').click();
    await expect(labels).toHaveCount(0);
    await preference.check();
    await expect(labels).toHaveCount(4);
    await expect(badge).toHaveText('Primary');
    await expect(badge).toHaveAttribute('aria-hidden', 'true');
    await expect(badge).toHaveCSS('pointer-events', 'none');
    await expect(primary).toHaveCount(1);
    await button('Fit view').click();
    await expect.poll(alignmentError).toBeLessThan(2);
    await button('Zoom out').click();
    await expect.poll(alignmentError).toBeLessThan(2);

    await button('Snap new connections').click();
    await expect(surface).toHaveAttribute('data-flow-connection-drop-radius', '32');
    await surface.scrollIntoViewIfNeeded();
    const output = await button('Connect from Draft: out').boundingBox();
    const label = await badge.boundingBox();
    await page.mouse.move(output.x + output.width / 2, output.y + output.height / 2);
    await page.mouse.down();
    await page.mouse.move(label.x + label.width - 3, label.y + label.height / 2, { steps: 6 });
    await expect(surface.locator('[data-flow-connection-preview]')).toHaveAttribute(
      'data-flow-connection-state',
      'valid',
    );
    await page.mouse.up();
    await expect(button('source:out → publish:primary')).toBeVisible();
    await button('Undo').click();

    const screenshot = process.env.FLOW_PORT_LABELS_SCREENSHOT;
    if (screenshot) {
      await surface.scrollIntoViewIfNeeded();
      const canvas = await surface.boundingBox();
      const controls = await page.getByRole('group', { name: 'Viewport controls' }).boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvas.x,
          y: controls.y - 4,
          width: canvas.width,
          height: canvas.y + canvas.height - controls.y + 4,
        },
      });
    }
    await surface.scrollIntoViewIfNeeded();
    const before = await badge.boundingBox();
    const title = await button('Select Publish').boundingBox();
    await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2);
    await page.mouse.down();
    await page.mouse.move(title.x + title.width / 2 + 40, title.y + title.height / 2 + 25, {
      steps: 6,
    });
    await page.mouse.up();
    await expect.poll(async () => (await badge.boundingBox()).x).toBeGreaterThan(before.x + 30);
    await expect.poll(alignmentError).toBeLessThan(2);
    await button('Undo').click();

    await page.getByRole('combobox', { name: 'Node design' }).selectOption('orbits');
    await button('Fit view').click();
    await expect(labels).toHaveCount(4);
    await expect.poll(alignmentError).toBeLessThan(2);
    await button('Connect from Draft: out').press('Enter');
    await primary.press('Enter');
    await expect(button('source:out → publish:primary')).toBeVisible();
    await button('Undo').click();
    await page.getByRole('checkbox', { name: 'Hide Review node' }).check();
    await expect(surface.locator('[data-flow-port-label][data-flow-owner="review"]')).toHaveCount(
      0,
    );
    await button('Minimal mode').click();
    await expect(badge).toBeVisible();
    await preference.uncheck();
    await expect(labels).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      'Custom port labels track zoom and drag, pass wiring input through, and work with circular shells and minimal mode',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
