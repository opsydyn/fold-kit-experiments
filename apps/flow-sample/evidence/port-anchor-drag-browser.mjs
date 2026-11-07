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
    const inspector = page.getByRole('group', { name: 'Ports for Review', exact: true });
    const reason = 'Review input is managed upstream.';
    const handle = () => button('Position Review: in');
    const socket = () => button('Connect to Review: in');
    const center = async () => {
      const box = await socket().boundingBox();
      const canvas = await surface.boundingBox();
      return { x: box.x + box.width / 2 - canvas.x, y: box.y + box.height / 2 - canvas.y };
    };
    const expectCenter = async (expected) => {
      await expect
        .poll(async () => {
          const point = await center();
          return Math.hypot(point.x - expected.x, point.y - expected.y);
        })
        .toBeLessThan(0.1);
    };
    const drag = async (dx, dy) => {
      await handle().scrollIntoViewIfNeeded();
      const box = await handle().boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 8 });
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Review').click();
    await expect(handle()).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Drag port anchors', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await expect(surface.locator('[data-flow-anchor-port]')).toHaveCount(2);
    await button('Zoom out').click();
    await expect(page.locator('[data-flow-zoom-level]')).not.toHaveText('100%');
    const zoom =
      Number((await page.locator('[data-flow-zoom-level]').textContent()).replace('%', '')) / 100;
    const size = await surface
      .locator('[data-flow-node="review"]')
      .evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight }));
    const before = await center();
    await drag((size.width * zoom) / 2, (-size.height * zoom) / 2);
    await expect.poll(async () => (await center()).x).toBeGreaterThan(before.x + 30);
    await page.mouse.up();
    await expect(button('source:out → review:in')).toBeVisible();
    const saved = await center();
    await button('Edit position for in port on Review').click();
    await expect(
      page.getByRole('combobox', { name: 'Position mode for in port on Review', exact: true }),
    ).toHaveValue('anchor');
    expect(
      Number(
        await page
          .getByRole('spinbutton', { name: 'Anchor X for in port on Review', exact: true })
          .inputValue(),
      ),
    ).toBeCloseTo(0.5, 1);
    expect(
      Number(
        await page
          .getByRole('spinbutton', { name: 'Anchor Y for in port on Review', exact: true })
          .inputValue(),
      ),
    ).toBeCloseTo(0, 1);
    await button('Cancel position').click();
    await button('Undo').click();
    await expectCenter(before);
    await button('Redo').click();
    await expectCenter(saved);
    await button('Select Review').click();
    await drag(25, 25);
    await expect.poll(async () => (await center()).x).toBeGreaterThan(saved.x + 10);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(saved);
    await drag(25, 25);
    await surface.dispatchEvent('pointercancel', {
      pointerId: 1,
      pointerType: 'mouse',
      bubbles: true,
    });
    await page.mouse.up();
    await expectCenter(saved);
    await drag(25, 25);
    await button('Protect Review input').evaluate((element) => element.click());
    await page.mouse.move(650, 650);
    await page.mouse.up();
    await expectCenter(saved);
    await expect(handle()).toBeDisabled();
    await expect(handle()).toHaveAccessibleDescription(reason);
    await expect(inspector.getByText(reason, { exact: true })).toHaveCount(1);
    await button('Protect Review input').click();
    await expect(handle()).toBeEnabled();
    await handle().press('ArrowRight');
    await expect.poll(async () => (await center()).x).toBeGreaterThan(saved.x);
    await button('Undo').click();
    await expectCenter(saved);
    await button('Select Review').click();
    await button('Zoom in').click();
    await expect(page.locator('[data-flow-zoom-level]')).toHaveText('100%');
    const screenshot = process.env.FLOW_PORT_ANCHOR_DRAG_SCREENSHOT;
    if (screenshot) {
      await inspector.scrollIntoViewIfNeeded();
      const panel = await inspector.boundingBox();
      const canvas = await surface.boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvas.x,
          y: canvas.y - 4,
          width: canvas.width,
          height: panel.y + panel.height - canvas.y + 8,
        },
      });
    }
    await page.getByRole('checkbox', { name: 'Drag port anchors', exact: true }).uncheck();
    await expect(handle()).toHaveCount(0);
    await expect(button('source:out → review:in')).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      'Opt-in anchor drag retains live previews, zoom, Undo/Redo, Escape, pointer cancellation, policy rollback and keyboard nudges',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
