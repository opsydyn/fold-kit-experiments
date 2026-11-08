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
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const viewport = page.getByRole('group', { name: 'Viewport controls' });
    const draft = surface.locator('[data-flow-node="source"]');
    const marquee = surface.locator('[data-flow-zoom-area-box] .workbench-zoom-area');
    const boxSelect = button('Box select');
    const tool = button('Zoom to area');
    const edge = button('source:out → review:in');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await edge.click();
    await boxSelect.click();
    await expect(boxSelect).toHaveAttribute('aria-pressed', 'true');
    await tool.press('Enter');
    await expect(tool).toHaveAttribute('aria-pressed', 'true');
    await tool.press('Escape');
    await expect(tool).toHaveAttribute('aria-pressed', 'false');

    await tool.click();
    await surface.scrollIntoViewIfNeeded();
    const original = await draft.boundingBox();
    const canvas = await surface.boundingBox();
    const controls = await viewport.boundingBox();
    await page.mouse.move(original.x + original.width + 24, original.y + original.height + 24);
    await page.mouse.down();
    await page.mouse.move(original.x - 24, original.y - 24, { steps: 6 });
    await expect(marquee).toBeVisible();
    await expect(surface.locator('[data-flow-selection-box]')).toHaveCount(0);
    await expect(edge).toHaveAttribute('aria-pressed', 'true');
    const screenshot = process.env.FLOW_ZOOM_AREA_SCREENSHOT;
    if (screenshot) {
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
    await page.mouse.up();
    await expect(marquee).toHaveCount(0);
    await expect(tool).toHaveAttribute('aria-pressed', 'false');
    await expect(boxSelect).toHaveAttribute('aria-pressed', 'true');
    await expect(edge).toHaveAttribute('aria-pressed', 'true');
    async function centerOffset() {
      const frame = await draft.boundingBox();
      const canvas = await surface.boundingBox();
      return Math.hypot(
        frame.x + frame.width / 2 - canvas.x - canvas.width / 2,
        frame.y + frame.height / 2 - canvas.y - canvas.height / 2,
      );
    }
    await expect.poll(centerOffset).toBeLessThan(4);
    expect((await draft.boundingBox()).width).toBeGreaterThan(original.width);

    await page.getByRole('combobox', { name: 'Navigation design' }).selectOption('compact');
    await button('Minimal mode').click();
    await expect(
      page.locator('.compact-navigation').getByRole('button', { name: 'Zoom to area' }),
    ).toBeEnabled();
    const drag = async (distance) => {
      await tool.click();
      await surface.scrollIntoViewIfNeeded();
      const canvas = await surface.boundingBox();
      await page.mouse.move(canvas.x + 15, canvas.y + 15);
      await page.mouse.down();
      await page.mouse.move(canvas.x + 15 + distance, canvas.y + 15 + distance);
    };
    await drag(2);
    const before = await draft.boundingBox();
    await page.mouse.up();
    await expect(tool).toHaveAttribute('aria-pressed', 'false');
    expect(await draft.boundingBox()).toEqual(before);
    await drag(34);
    await expect(marquee).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(marquee).toHaveCount(0);
    await page.mouse.up();
    await expect(tool).toHaveAttribute('aria-pressed', 'false');
    expect(await draft.boundingBox()).toEqual(before);
    await button('Connections').click();
    await expect(button('Draft → Review')).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
    console.log(
      'Zoom to area fits a reverse drag, preserves selection, and cancels in both navigation designs',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
