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
const qualify = async () => {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 2000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const surface = page.locator('[data-flow-surface]');
    const marquee = surface.locator('[data-flow-selection-box]');
    const custom = marquee.locator('.hatched-selection-marquee');
    const draw = async (shift = false) => {
      await surface.scrollIntoViewIfNeeded();
      const box = await surface.boundingBox();
      if (shift) await page.keyboard.down('Shift');
      await page.mouse.move(box.x + 580, box.y + 330);
      await page.mouse.down();
      await page.mouse.move(box.x + 18, box.y + 48, { steps: 8 });
      if (shift) await page.keyboard.up('Shift');
    };
    const bounds = () =>
      marquee.evaluate((element) =>
        ['left', 'top', 'width', 'height'].map((key) => element.style[key]),
      );
    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await button('Select Publish').click();
    await draw(true);
    await expect(marquee).toBeVisible();
    await expect(marquee).toHaveCSS('width', '562px');
    const standard = await bounds();
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(marquee).toHaveCount(0);
    await expect(button('Select Publish')).toHaveAttribute('aria-pressed', 'true');

    await page
      .getByRole('combobox', { name: 'Selection marquee', exact: true })
      .selectOption('hatched');
    await button('Box select').click();
    await expect(button('Box select')).toHaveAttribute('aria-pressed', 'true');
    await draw();
    await expect(custom).toBeVisible();
    await expect(marquee).toHaveCSS('width', '562px');
    expect(await bounds()).toEqual(standard);
    await expect(marquee).toHaveAttribute('aria-hidden', 'true');
    await expect(button('Select Publish')).toHaveAttribute('aria-pressed', 'true');
    await surface.screenshot({ path: '/tmp/foldkit-zloz-selection-marquee.png' });
    await page.mouse.up();
    await expect(marquee).toHaveCount(0);
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'true');
    await expect(button('Select Review')).toHaveAttribute('aria-pressed', 'true');
    await expect(button('Select Publish')).toHaveAttribute('aria-pressed', 'false');
    expect(await exportGraph()).toEqual(initial);

    await button('Minimal mode').click();
    await draw();
    await expect(custom).toBeVisible();
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(marquee).toHaveCount(0);
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'true');
    await expect(button('Select Review')).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
    console.log(
      'Reverse bounds match, selection commits on release, Escape preserves selection, and minimal mode keeps the marquee',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
