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
    const sockets = surface.locator('.workbench-socket');
    const preview = surface.locator('[data-flow-connection-preview]');
    async function begin(locator) {
      await surface.scrollIntoViewIfNeeded();
      const frame = await locator.boundingBox();
      await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
      await page.mouse.down();
    }
    async function hover(locator, offset = 0) {
      const frame = await locator.boundingBox();
      await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2 - offset, {
        steps: 6,
      });
    }

    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Retain node views').click();
    await expect(sockets).toHaveCount(0);
    const preference = page.getByRole('checkbox', { name: 'Custom port sockets' });
    await preference.check();
    await expect(sockets).toHaveCount(4);
    const source = button('Connect from Draft: out');
    const review = button('Connect from Review: out');
    const publish = button('Connect to Publish: in');
    await page.getByRole('checkbox', { name: 'Lock Draft output' }).check();
    await expect(source).toBeDisabled();
    await expect(source).toHaveAttribute('data-flow-port-locked', '');
    await page.getByRole('checkbox', { name: 'Lock Draft output' }).uncheck();
    await expect(source).toBeEnabled();
    await button('Snap new connections').click();
    await expect(surface).toHaveAttribute('data-flow-connection-drop-radius', '32');
    await begin(review);
    await hover(publish, 25);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'valid');
    await expect(publish).not.toHaveCSS('box-shadow', 'none');
    await page.mouse.up();
    await expect(button('review:out → publish:in')).toBeVisible();
    await button('Undo').click();

    await button('source:out → review:in').click();
    await begin(
      surface.locator('[data-flow-reconnect="draft-review"][data-flow-edge-end="target"]'),
    );
    await hover(publish);
    await page.mouse.up();
    await expect(button('source:out → publish:in')).toBeVisible();
    await button('Undo').click();
    await expect(button('source:out → review:in')).toBeVisible();
    await review.press('Enter');
    await publish.press('Enter');
    await expect(button('review:out → publish:in')).toBeVisible();
    await button('Undo').click();

    await button('Open port snapping demo').click();
    await page.getByRole('checkbox', { name: 'Port labels' }).check();
    await expect(surface.locator('.workbench-port-label')).toHaveCount(4);
    await expect(sockets).toHaveCount(4);
    await button('Fit view').click();
    const screenshot = process.env.FLOW_PORT_SOCKETS_SCREENSHOT;
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
    await page.getByRole('combobox', { name: 'Node design' }).selectOption('orbits');
    await button('Fit view').click();
    await expect(sockets).toHaveCount(4);
    await begin(button('Connect from Draft: out'));
    await hover(button('Connect to Publish: Fallback'));
    await page.mouse.up();
    await expect(button('source:out → publish:fallback')).toBeVisible();
    await button('Undo').click();
    await button('Minimal mode').click();
    await expect(sockets).toHaveCount(4);
    await preference.uncheck();
    await expect(sockets).toHaveCount(0);
    await expect(button('Connect to Publish: Primary')).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      'Custom sockets retain locks, pointer and keyboard wiring, reconnection, Undo, labels, and circular shells',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
