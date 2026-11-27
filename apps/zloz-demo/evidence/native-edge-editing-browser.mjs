import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, firefox, webkit, expect } = require('@playwright/test');
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  const path = resolve(root, '.' + (route.endsWith('/') ? route + 'index.html' : route));
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  await readFile(path).then(
    (body) => {
      response.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
      );
      response.end(body);
    },
    () => response.writeHead(404).end(),
  );
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const engine = process.env.ZLOZ_BROWSER ?? 'chromium';
async function qualify() {
  const browser = await { chromium, firefox, webkit }[engine].launch();
  await (async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto('http://127.0.0.1:' + server.address().port + '/connections/');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    const button = (name) => page.getByRole('button', { name, exact: true });
    const canvas = page.getByRole('region', { name: 'Strict connection canvas' });
    const path = canvas.locator('[data-flow-edge]');
    const toolbar = canvas.getByRole('group', { name: 'Selected edge actions' });
    await canvas.locator('[data-flow-owner="orders"][data-flow-port="out"]').press('Enter');
    await canvas.locator('[data-flow-owner="billing"][data-flow-port="in"]').press('Space');
    const description = 'orders:out → billing:in';
    await button(description).press('Enter');
    await expect(toolbar.getByRole('button', { name: 'Rename', exact: true })).toBeEnabled();

    const input = canvas.getByRole('textbox', { name: 'Edge label for ' + description });
    const unlabeled = canvas.getByRole('button', { name: 'Add label for ' + description });
    await toolbar.getByRole('button', { name: 'Rename', exact: true }).press('Enter');
    await expect(input).toBeFocused();
    await input.fill('Discard this');
    await input.press('Escape');
    await expect(unlabeled).toBeFocused();
    await expect(button(description)).toBeVisible();
    await unlabeled.press('Enter');
    await expect(input).toBeFocused();
    await input.fill('  Send order  ');
    const screenshot = process.env.ZLOZ_EDGE_SCREENSHOT;
    if (screenshot) await page.screenshot({ path: screenshot });
    await input.press('Enter');
    const named = canvas.getByRole('button', {
      name: 'Edit edge label Send order for ' + description,
    });
    await expect(named).toBeFocused();
    await expect(button('Send order')).toBeVisible();
    await button('Undo').click();
    await expect(button(description)).toBeVisible();
    await button(description).press('Enter');
    const originalPath = await path.getAttribute('d');
    await toolbar.getByRole('combobox', { name: 'Path style' }).selectOption('smooth');
    await expect(path).not.toHaveAttribute('d', originalPath);
    await button('Undo').click();
    await expect(path).toHaveAttribute('d', originalPath);
    await button(description).press('Enter');
    await toolbar.getByRole('button', { name: 'Delete edge', exact: true }).click();
    await expect(path).toHaveCount(0);
    await button('Undo').click();
    await expect(path).toHaveAttribute('d', originalPath);

    await button(description).press('Enter');
    await unlabeled.press('Enter');
    await expect(input).toBeFocused();
    await input.fill('Read-only transition');
    await page.getByRole('checkbox', { name: 'Read-only' }).click();
    await expect(input).toHaveCount(0);
    await expect(toolbar).toHaveCount(0);
    await expect(path).toHaveCount(1);
    await page.getByRole('checkbox', { name: 'Read-only' }).click();
    await expect(input).toHaveCount(0);
    await expect(button(description)).toBeVisible();
    await unlabeled.press('Enter');
    await expect(input).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(async () => {
        const bounds = await canvas.locator('form').boundingBox();
        const surface = await canvas.boundingBox();
        return Math.min(
          bounds.x - surface.x,
          bounds.y - surface.y,
          surface.x + surface.width - (bounds.x + bounds.width),
          surface.y + surface.height - (bounds.y + bounds.height),
        );
      })
      .toBeGreaterThanOrEqual(3);
    await expect(input).toBeFocused();
    const narrow = process.env.ZLOZ_EDGE_NARROW_SCREENSHOT;
    if (narrow) await page.screenshot({ path: narrow });
    await input.press('Escape');
    await expect(input).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      engine +
        ': inline edge focus, Escape, save, path style, deletion, one-step Undo, read-only and narrow resize passed',
    );
  })().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
