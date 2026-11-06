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

function cameraTransform(element) {
  const world = [...element.children].find((child) =>
    child.style.transform.startsWith('translate'),
  );
  return world.style.transform;
}

async function qualify() {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const toggle = button('Dark mode');
    const surface = page.locator('[data-flow-surface]');
    const body = page.locator('body');
    const card = surface.locator('[data-flow-node="review"] > div');
    const nativeInput = card.locator('input').first();
    const selection = button('Select Review');
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return readFile(await download.path(), 'utf8');
    };
    const screenshot = async (mode) => {
      await surface.scrollIntoViewIfNeeded();
      const canvas = await surface.boundingBox();
      const control = await toggle.boundingBox();
      await page.screenshot({
        path: `/tmp/foldkit-flow-theme-${mode}.png`,
        clip: {
          x: canvas.x - 12,
          y: control.y - 12,
          width: canvas.width + 24,
          height: canvas.y + canvas.height - control.y + 34,
        },
      });
    };

    await page.goto('http://127.0.0.1:' + server.address().port);
    const graph = await exportGraph();
    await button('World annotation').click();
    await page.getByRole('combobox', { name: 'Node toolbar' }).selectOption('compact');
    await selection.press('Enter');
    await button('Fit view').click();
    await expect(page.getByText('146%', { exact: true })).toBeVisible();
    const camera = await surface.evaluate(cameraTransform);

    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(body).toHaveCSS('background-color', 'rgb(248, 246, 241)');
    await expect(surface).toHaveCSS('background-color', 'rgb(231, 238, 231)');
    await expect(card).toHaveCSS('background-color', 'rgb(253, 254, 251)');
    await expect(nativeInput).toHaveCSS('color-scheme', 'light');
    await screenshot('light');

    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(body).toHaveCSS('background-color', 'rgb(16, 28, 25)');
    await expect(surface).toHaveCSS('background-color', 'rgb(20, 35, 32)');
    await expect(card).toHaveCSS('background-color', 'rgb(33, 52, 45)');
    await expect(card).toHaveCSS('color', 'rgb(229, 243, 235)');
    await expect(nativeInput).toHaveCSS('color-scheme', 'dark');
    await expect(selection).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Actions for Review' })).toBeVisible();
    await expect(button('Inspect Review')).toBeVisible();
    expect(await surface.evaluate(cameraTransform)).toBe(camera);
    await screenshot('dark');
    expect(await exportGraph()).toEqual(graph);

    await toggle.click();
    await expect(surface).toHaveCSS('background-color', 'rgb(231, 238, 231)');
    await expect(body).toHaveCSS('background-color', 'rgb(248, 246, 241)');
    await expect(nativeInput).toHaveCSS('color-scheme', 'light');
    expect(await surface.evaluate(cameraTransform)).toBe(camera);
    expect(errors).toEqual([]);
    console.log(
      'Light and dark modes reached the Astro shell, canvas and native controls while preserving graph, selection and viewport.',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
