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
    const match = page.getByRole('combobox', { name: 'Box selection match', exact: true });
    const draw = async () => {
      await surface.scrollIntoViewIfNeeded();
      const box = await surface.boundingBox();
      await page.mouse.move(box.x + 430, box.y + 110);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 200, { steps: 6 });
      await expect(marquee).toBeVisible();
    };
    const bounds = () =>
      marquee.evaluate((element) =>
        ['left', 'top', 'width', 'height'].map((key) => element.style[key]),
      );
    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await expect(match).toHaveValue('full');
    await button('Box select').click();
    await expect(button('Box select')).toHaveAttribute('aria-pressed', 'true');
    await draw();
    const fullBounds = await bounds();
    await expect(match).toBeDisabled();
    await page.mouse.up();
    await expect(page.locator('[data-flow-status]')).toHaveText('0 selected');

    await match.selectOption('partial');
    await draw();
    expect(await bounds()).toEqual(fullBounds);
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.up();
    await expect(page.locator('[data-flow-status]')).toHaveText('2 selected');
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'true');
    await expect(button('Select Review')).toHaveAttribute('aria-pressed', 'true');
    await expect(button('Select Publish')).toHaveAttribute('aria-pressed', 'false');
    await page
      .locator('#flow-demo')
      .screenshot({ path: '/tmp/foldkit-zloz-partial-selection.png' });
    expect(await exportGraph()).toEqual(initial);
    await draw();
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(marquee).toHaveCount(0);
    await expect(button('Select Review')).toHaveAttribute('aria-pressed', 'true');
    await button('Open grouped Onion Architecture').click();
    await expect(match).toHaveValue('partial');
    expect(errors).toEqual([]);
    console.log(
      'Identical bounds selected zero or two nodes by match mode, with Escape and graph preservation',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
