import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseEditions } from '../../../packages/foldkit-zloz/dist/index.mjs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  const path = resolve(root, '.' + (route === '/' ? '/index.html' : route));
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  await readFile(path).then(
    (body) => {
      response.setHeader(
        'Content-Type',
        /\.m?js$/u.test(path)
          ? 'text/javascript'
          : path.endsWith('.css')
            ? 'text/css'
            : 'text/html',
      );
      response.end(body);
    },
    () => response.writeHead(404).end(),
  );
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const browser = await chromium.launch();
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = async (name) => {
    await page
      .getByRole('navigation', { name: 'Workbench sections', exact: true })
      .getByRole('button', { name, exact: true })
      .click();
  };
  const snapshot = async () => {
    await section('Diagram');
    await page.getByRole('checkbox', { name: 'Include camera', exact: true }).check();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export JSON').click(),
    ]);
    return JSON.parse(await readFile(await download.path(), 'utf8'));
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open DDD Order aggregate').click();
  const original = await snapshot();
  const surface = page.locator('[data-flow-surface]');
  await surface.locator('[data-flow-handle="order"]').press('ArrowRight');
  const working = await snapshot();
  expect(working.graph).not.toEqual(original.graph);
  await section('History');
  await page.getByRole('textbox', { name: 'Edition name', exact: true }).fill('Working checkpoint');
  await button('Capture edition').click();
  await button('Load Order history example').click();
  const picker = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  await expect(picker.locator('option')).toHaveCount(4);
  await picker.selectOption('order-evolved');
  await expect(page.getByRole('status', { name: 'History mode', exact: true })).toContainText(
    'Read-only edition',
  );
  await expect(
    page.getByRole('status', { name: 'Historical edition notice', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'History comparison baseline', exact: true }),
  ).toHaveValue('order-start');
  await expect(surface.locator('[data-zloz-history-ghosts]')).toHaveCount(0);
  const ghosts = page.getByRole('checkbox', { name: 'Show comparison ghosts', exact: true });
  await ghosts.check();
  await expect(surface.locator('[data-zloz-history-node]')).toHaveCount(5);
  await expect(surface.locator('[data-zloz-history-node="removed"]')).toHaveCount(1);
  await expect(surface.locator('[data-zloz-history-node="added"]')).toHaveCount(1);
  await expect(surface.locator('[data-zloz-history-movement]')).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'History changes', exact: true })).toContainText(
    'removed: Pricing policy',
  );
  expect(
    await surface
      .locator(
        '[data-zloz-history-ghosts] button, [data-zloz-history-ghosts] [data-flow-port], [data-zloz-history-ghosts] [tabindex]',
      )
      .count(),
  ).toBe(0);
  for (const [name, selector] of [
    ['Node ghosts', '[data-zloz-history-node]'],
    ['Edge ghosts', '[data-zloz-history-edge]'],
    ['Movement connectors', '[data-zloz-history-movement]'],
  ]) {
    const toggle = page.getByRole('checkbox', { name, exact: true });
    await toggle.uncheck();
    await expect(surface.locator(selector)).toHaveCount(0);
    await toggle.check();
    await expect(surface.locator(selector)).not.toHaveCount(0);
  }
  const handle = surface.locator('[data-flow-handle="order"]');
  const frame = surface.locator('[data-flow-node="order"]');
  const before = await frame.getAttribute('style');
  await handle.press('Delete');
  await handle.press('ArrowRight');
  await expect(frame).toHaveAttribute('style', before);
  await expect(frame).toContainText('Sales order');
  expect(await surface.locator('[data-flow-port]:enabled').count()).toBe(0);
  await section('Navigation');
  await button('Fit view').click();
  const box = await surface.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -120);
  await button('Fit view').click();
  await section('History');
  const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
  for (const preference of ['light', 'dark']) {
    await theme.selectOption(preference);
    await page.locator('.workbench-sidebar-scroll').evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({
      path: fileURLToPath(new URL(`history-${preference}.png`, import.meta.url)),
    });
  }
  await section('Diagnostics');
  await button('Minimal mode').click();
  await expect(surface.locator('[data-zloz-history-ghosts]')).toHaveCount(0);
  await button('Minimal mode').click();
  await expect(surface.locator('[data-zloz-history-ghosts]')).toHaveCount(1);
  await section('Navigation');
  const cameraBefore = await frame.boundingBox();
  await button('Zoom in').click();
  await expect.poll(() => frame.boundingBox()).not.toEqual(cameraBefore);
  await button('Back to present').click();
  expect(await snapshot()).toEqual(working);
  await button('Undo').click();
  expect((await snapshot()).graph).toEqual(original.graph);
  await section('History');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    button('Export editions').click(),
  ]);
  expect(download.suggestedFilename()).toBe('foldkit-zloz.editions.json');
  const archive = parseEditions(await readFile(await download.path(), 'utf8'));
  expect(archive).toHaveLength(3);
  expect(archive[0].snapshot.graph).toEqual(working.graph);
  await picker.selectOption('order-evolved');
  await page.setViewportSize({ width: 390, height: 844 });
  await button('Hide controls').click();
  await expect
    .poll(async () => {
      await button('Fit view').click();
      const canvas = await surface.boundingBox();
      const bounds = await surface.locator('[data-flow-node]').evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        }),
      );
      return bounds.every(
        (box) =>
          box.left >= canvas.x - 1 &&
          box.right <= canvas.x + canvas.width + 1 &&
          box.top >= canvas.y - 1 &&
          box.bottom <= canvas.y + canvas.height + 1,
      );
    })
    .toBe(true);
  await expect(button('Back to present')).toBeVisible();
  await page.screenshot({ path: fileURLToPath(new URL('history-mobile.png', import.meta.url)) });
  await button('Back to present').click();
  await expect(
    page.getByRole('status', { name: 'Historical edition notice', exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        editions: archive.map((item) => ({ id: item.id, name: item.name })),
        checks: [
          'named capture and example append',
          'read-only rewind with unchanged present document/camera/Undo',
          'blocked Delete and keyboard movement',
          'baseline comparison and opt-in ghosts',
          'added/removed/moved nodes and changed edges',
          'independent ghost switches and Minimal masking',
          'noninteractive ghost SVG and textual legend',
          'light/dark and narrow history notice',
          'canonical archive download/reopen',
        ],
        pageErrors: errors,
        screenshots: ['history-light.png', 'history-dark.png', 'history-mobile.png'],
      },
      null,
      2,
    ),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
