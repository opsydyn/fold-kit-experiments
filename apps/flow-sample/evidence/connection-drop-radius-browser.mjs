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
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const preview = surface.locator('[data-flow-connection-preview]');
    const publish = button('Connect to Publish: in');
    const reconnectionRadius = page.getByRole('combobox', { name: 'Reconnection snap radius' });
    const nearPort = async (locator, offset) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - offset, { steps: 6 });
    };
    const begin = async (locator) => {
      await surface.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    };
    const handle = (end) =>
      surface.locator(`[data-flow-reconnect="draft-review"][data-flow-edge-end="${end}"]`);

    await page.goto('http://127.0.0.1:' + server.address().port);
    await expect(surface).toHaveAttribute('data-flow-connection-drop-radius', '0');
    await expect(surface).toHaveAttribute('data-flow-reconnection-drop-radius', '0');
    await begin(button('Connect from Review: out'));
    await nearPort(publish, 24);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'free');
    await page.mouse.up();
    await expect(button('review:out → publish:in')).toHaveCount(0);

    const snap = button('Snap new connections');
    await snap.click();
    await expect(surface).toHaveAttribute('data-flow-connection-drop-radius', '32');
    await expect(surface).toHaveAttribute('data-flow-reconnection-drop-radius', '32');
    await button('Zoom in').click();
    await expect(page.getByText('125%', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Wheel navigation' }).selectOption('pan');
    await surface.scrollIntoViewIfNeeded();
    const canvas = await surface.boundingBox();
    const draft = button('Select Draft');
    const beforePan = await draft.boundingBox();
    await page.mouse.move(canvas.x + 60, canvas.y + 350);
    await page.mouse.wheel(-130, 0);
    await expect.poll(async () => (await draft.boundingBox()).x).toBeGreaterThan(beforePan.x + 100);
    await begin(button('Connect from Review: out'));
    await nearPort(publish, 38);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'free');
    await nearPort(publish, 24);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'valid');
    const box = await surface.boundingBox();
    const toggle = await snap.boundingBox();
    await page.screenshot({
      path: '/tmp/foldkit-flow-connection-drop-radius.png',
      clip: {
        x: box.x - 12,
        y: toggle.y - 12,
        width: box.width + 24,
        height: box.y + box.height - toggle.y + 34,
      },
    });
    await page.mouse.up();
    await expect(button('review:out → publish:in')).toBeVisible();
    await button('Undo').click();
    await expect(button('review:out → publish:in')).toHaveCount(0);

    await button('source:out → review:in').click();
    await begin(handle('target'));
    await nearPort(publish, 24);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'valid');
    await page.mouse.up();
    await expect(button('source:out → publish:in')).toBeVisible();

    await begin(handle('source'));
    await nearPort(button('Connect from Review: out'), 24);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'valid');
    await page.mouse.up();
    await expect(button('review:out → publish:in')).toBeVisible();
    await button('Undo').click();
    await expect(button('source:out → publish:in')).toBeVisible();
    await button('Undo').click();
    await expect(button('source:out → review:in')).toBeVisible();

    await reconnectionRadius.selectOption('exact');
    await expect(surface).toHaveAttribute('data-flow-reconnection-drop-radius', '0');
    await expect(surface).toHaveAttribute('data-flow-connection-drop-radius', '32');
    await button('source:out → review:in').click();
    await begin(handle('target'));
    await nearPort(publish, 24);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'free');
    await page.mouse.up();
    await expect(button('source:out → review:in')).toBeVisible();
    await begin(handle('target'));
    await nearPort(publish, 0);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'valid');
    await page.mouse.up();
    await expect(button('source:out → publish:in')).toBeVisible();
    await button('Undo').click();

    await snap.click();
    await reconnectionRadius.selectOption('wide');
    await expect(surface).toHaveAttribute('data-flow-connection-drop-radius', '0');
    await expect(surface).toHaveAttribute('data-flow-reconnection-drop-radius', '48');
    await begin(button('Connect from Review: out'));
    await nearPort(publish, 24);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'free');
    await page.mouse.up();
    await expect(button('review:out → publish:in')).toHaveCount(0);
    await button('source:out → review:in').click();
    await begin(handle('target'));
    await nearPort(publish, 50);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'free');
    await nearPort(publish, 42);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'valid');
    const screenshot = process.env.FLOW_RECONNECTION_DROP_RADIUS_SCREENSHOT;
    if (screenshot) {
      const canvas = await surface.boundingBox();
      const toggle = await snap.boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvas.x,
          y: toggle.y - 6,
          width: canvas.width,
          height: canvas.y + canvas.height - toggle.y + 6,
        },
      });
    }
    await page.mouse.up();
    await expect(button('source:out → publish:in')).toBeVisible();
    await button('Undo').click();
    await expect(button('source:out → review:in')).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      'Inherited, exact-only and independent reconnection radii passed at 125% zoom, including both ends and Undo.',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
