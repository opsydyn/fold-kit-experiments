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
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1500 },
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const preview = surface.locator('[data-flow-connection-preview]');
    const primary = button('Connect to Publish: Primary');
    const fallback = button('Connect to Publish: Fallback');
    const stable = page.getByRole('checkbox', { name: 'Stable port snapping (12 px)' });
    async function ports() {
      const [first, second] = await Promise.all([primary.boundingBox(), fallback.boundingBox()]);
      return {
        x: first.x + first.width / 2,
        primaryY: first.y + first.height / 2,
        fallbackY: second.y + second.height / 2,
      };
    }
    async function gap() {
      const { primaryY, fallbackY } = await ports();
      return fallbackY - primaryY;
    }
    async function begin(locator) {
      await surface.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    }
    async function hoverGap(offset) {
      const { x, primaryY, fallbackY } = await ports();
      await page.mouse.move(x - 18, (primaryY + fallbackY) / 2 + offset, { steps: 4 });
    }
    async function cancel() {
      await page.keyboard.press('Escape');
      await page.mouse.up();
    }

    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Open port snapping demo').click();
    await button('Snap new connections').click();
    await expect(surface).toHaveAttribute('data-flow-connection-drop-radius', '32');
    for (let count = 0; count < 12; count++) {
      const before = await gap();
      if (before <= 40) break;
      await button('Zoom out').click();
      await expect.poll(gap).toBeLessThan(before - 1);
    }
    expect(await gap()).toBeLessThanOrEqual(40);
    await expect(stable).not.toBeChecked();

    await begin(button('Connect from Draft: out'));
    await hoverGap(-3);
    await expect(primary).not.toHaveCSS('box-shadow', 'none');
    await hoverGap(3);
    await expect(fallback).not.toHaveCSS('box-shadow', 'none');
    await page.mouse.up();
    await expect(button('source:out → publish:fallback')).toBeVisible();
    await button('Undo').click();

    await stable.check();
    await begin(button('Connect from Draft: out'));
    await hoverGap(-3);
    await expect(primary).not.toHaveCSS('box-shadow', 'none');
    await hoverGap(3);
    await expect(primary).not.toHaveCSS('box-shadow', 'none');
    await expect(fallback).toHaveCSS('box-shadow', 'none');
    const screenshot = process.env.FLOW_SNAP_HYSTERESIS_SCREENSHOT;
    if (screenshot) {
      const canvas = await surface.boundingBox();
      const toggle = await stable.boundingBox();
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
    await expect(button('source:out → publish:primary')).toBeVisible();
    await button('Undo').click();

    await page.getByRole('combobox', { name: 'Reconnection snap radius' }).selectOption('wide');
    await expect(surface).toHaveAttribute('data-flow-reconnection-drop-radius', '48');
    await button('review:out → publish:primary').click();
    await begin(
      surface.locator('[data-flow-reconnect="review-publish"][data-flow-edge-end="target"]'),
    );
    const reconnectPorts = await ports();
    await page.mouse.move(reconnectPorts.x, reconnectPorts.fallbackY);
    await hoverGap(3);
    await expect(fallback).not.toHaveCSS('box-shadow', 'none');
    await hoverGap(-3);
    await expect(fallback).not.toHaveCSS('box-shadow', 'none');
    const { x, primaryY, fallbackY } = await ports();
    await page.mouse.move(x - 18, primaryY + 2, { steps: 4 });
    await expect(primary).not.toHaveCSS('box-shadow', 'none');
    await page.mouse.move(x, fallbackY, { steps: 4 });
    await expect(fallback).not.toHaveCSS('box-shadow', 'none');
    await page.mouse.up();
    await expect(button('review:out → publish:fallback')).toBeVisible();
    await button('Undo').click();
    await expect(button('review:out → publish:primary')).toBeVisible();

    await begin(button('Connect from Draft: out'));
    await hoverGap(-3);
    const location = await ports();
    await page.mouse.move(location.x - 65, location.primaryY);
    await expect(preview).toHaveAttribute('data-flow-connection-state', 'free');
    await cancel();
    await expect(button('source:out → publish:primary')).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      'Nearest and stable snapping, margin switching, exact hit priority, radius release, reconnection and Undo passed',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
