import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseModelDocument } from '../../../packages/foldkit-zloz/dist/index.mjs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, firefox, webkit, expect } = require('@playwright/test');
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
const engine = process.env.ZLOZ_BROWSER ?? 'chromium';
const browser = await { chromium, firefox, webkit }[engine].launch();
const screenshotPath = (theme) =>
  process.env.ZLOZ_CAPTURE_DIR
    ? resolve(process.env.ZLOZ_CAPTURE_DIR, `context-map-${engine}-${theme}.png`)
    : fileURLToPath(new URL(`./context-map-${theme}.png`, import.meta.url));
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections', exact: true })
      .getByRole('button', { name, exact: true })
      .click();
  const modelDownload = async () => {
    await section('History');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return parseModelDocument(await readFile(await file.path(), 'utf8'));
  };
  const label = (id) => page.locator(`[data-zloz-context-map-label="${id}"]`);
  const connector = (id) => page.locator(`[data-zloz-context-map-edge="${id}"]`);
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open DDD context map').click();
  await expect(label('orders-billing')).toBeVisible();
  await expect(connector('orders-billing')).toHaveAttribute('marker-end', /url/u);
  await expect(connector('orders-catalog')).not.toHaveAttribute('marker-end');
  await expect(connector('catalog-inventory')).not.toHaveAttribute('marker-end');
  await expect(label('orders-billing').getByLabel('Open host service', { exact: true })).toHaveText(
    'OHS',
  );
  await expect(label('orders-billing')).toHaveAccessibleName(
    /Open host service.*Published language.*Anti-corruption layer/u,
  );
  const initial = await modelDownload();
  expect(initial.snapshot.graph.nodes.length).toBe(4);
  expect(initial.snapshot.graph.edges.length).toBe(4);
  await section('Diagram');
  // Selection remains on the core transparent hit target, independent of decorative paths.
  const hitTarget = page.locator('[data-flow-edge="orders-billing"]').first();
  await hitTarget.dispatchEvent('click');
  await expect(hitTarget).toHaveAttribute('data-selected', 'true');
  await label('orders-billing').focus();
  await expect(label('orders-billing')).toBeFocused();
  await page.keyboard.press('Enter');
  const input = page.getByRole('textbox', { name: /Edge label for orders:out-right/u });
  await expect(input).toHaveValue('Order facts');
  await input.fill('Order contract');
  await page.getByRole('button', { name: 'Save label', exact: true }).click();
  await expect(label('orders-billing')).toContainText('Order contract');
  await button('Undo').click();
  await expect(label('orders-billing')).toContainText('Order facts');
  await section('Appearance');
  const toggle = page.getByRole('checkbox', { name: 'Context-map presentation', exact: true });
  await toggle.uncheck();
  await expect(page.locator('[data-zloz-context-map-label]')).toHaveCount(0);
  expect((await modelDownload()).snapshot).toEqual(initial.snapshot);
  await section('Appearance');
  await toggle.check();
  await expect(page.locator('[data-zloz-context-map-label]')).toHaveCount(4);
  await section('Diagnostics');
  await button('Minimal mode').click();
  await expect(page.locator('[data-zloz-context-map-label]')).toHaveCount(4);
  await expect(label('orders-billing').getByLabel('Open host service', { exact: true })).toHaveText(
    'OHS',
  );
  await button('Minimal mode').click();
  await section('History');
  const editionName = page.getByRole('textbox', { name: 'Edition name', exact: true });
  await editionName.fill('Context review');
  await button('Capture edition').click();
  const rewind = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  const editionChoice = rewind.getByRole('option', { name: 'Context review', exact: true });
  await expect(editionChoice).toHaveCount(1);
  const editionId = await editionChoice.getAttribute('value');
  await rewind.selectOption(editionId);
  await expect(
    page.getByText('Read-only edition: Context review. Working model preserved.', { exact: true }),
  ).toBeVisible();
  await expect(label('orders-billing')).not.toHaveJSProperty('tagName', 'BUTTON');
  await expect(label('orders-billing')).toHaveAccessibleName(/Open host service/u);
  await button('Return to present').click();
  await expect(label('orders-billing')).toHaveJSProperty('tagName', 'BUTTON');
  await section('Diagram');
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
    await expect(label('orders-billing')).toBeVisible();
    await page.screenshot({
      path: screenshotPath(theme),
    });
  }
  expect((await modelDownload()).snapshot).toEqual(initial.snapshot);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'four strategic patterns from package starter',
          'canonical hit target and directed/symmetric markers',
          'full side-role accessible names',
          'native keyboard label edit with Undo',
          'presentation toggle preserves model and camera',
          'minimal mode preserves semantic badges',
          'read-only history keeps non-editable semantic labels',
          'light/dark family themes and visible canvas',
          'canonical model unchanged after presentation/review',
        ],
        pageErrors: errors,
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
