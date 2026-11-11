import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseModelDocument } from '../../../packages/foldkit-zloz/dist/index.mjs';
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
  const controls = page.getByRole('group', { name: 'DDD relationship controls', exact: true });
  const pattern = controls.getByRole('combobox', { name: 'DDD relationship pattern', exact: true });
  const downstream = controls.getByRole('combobox', { name: 'Downstream role', exact: true });
  const ohs = controls.getByRole('checkbox', { name: 'Open host service', exact: true });
  const pl = controls.getByRole('checkbox', { name: 'Published language', exact: true });
  const inspect = page.getByRole('combobox', { name: 'Inspect DDD relationship', exact: true });
  const protect = page.getByRole('checkbox', {
    name: 'Protect Orders–Billing meaning edits',
    exact: true,
  });
  const label = page.locator('[data-zloz-context-map-label="orders-billing"]');
  const connector = page.locator('[data-zloz-context-map-edge="orders-billing"]');
  const download = async () => {
    await section('History');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return parseModelDocument(await readFile(await file.path(), 'utf8'));
  };
  const undo = async () => {
    await section('Diagram');
    await button('Undo').click();
    await section('Inspect');
    await inspect.selectOption('orders-billing');
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open DDD context map').click();
  await expect(label).toBeVisible();
  const initial = await download();
  await section('Inspect');
  await inspect.selectOption('orders-billing');
  await expect(pattern).toHaveValue('strategic:upstream-downstream');
  await expect(ohs).toBeChecked();
  await expect(pl).toBeChecked();
  await expect(downstream).toHaveValue('anti-corruption-layer');
  await downstream.focus();
  await downstream.selectOption('conformist');
  await expect(label.getByLabel('Conformist', { exact: true })).toHaveText('CF');
  await undo();
  await expect(downstream).toHaveValue('anti-corruption-layer');
  await section('Diagram');
  await button('Redo').click();
  await section('Inspect');
  await inspect.selectOption('orders-billing');
  await expect(downstream).toHaveValue('conformist');
  await undo();
  await expect(downstream).toHaveValue('anti-corruption-layer');
  await ohs.focus();
  await ohs.press('Space');
  await expect(ohs).not.toBeChecked();
  await expect(label.getByLabel('Open host service', { exact: true })).toHaveCount(0);
  await pl.uncheck();
  await expect(pl).not.toBeChecked();
  await expect(label.getByLabel('Published language', { exact: true })).toHaveCount(0);
  await downstream.selectOption('');
  await expect(downstream).toHaveValue('');
  await expect(label.getByLabel('Anti-corruption layer', { exact: true })).toHaveCount(0);
  const stripped = await download(),
    meaning = stripped.snapshot.graph.edges.find(
      (edge) => edge.id === 'orders-billing',
    ).architecture;
  expect('upstream' in meaning).toBe(false);
  expect('downstream' in meaning).toBe(false);
  await undo();
  await undo();
  await undo();
  await expect(ohs).toBeChecked();
  await expect(pl).toBeChecked();
  await expect(downstream).toHaveValue('anti-corruption-layer');
  await pattern.selectOption('strategic:partnership');
  await expect(downstream).toHaveCount(0);
  await expect(ohs).toHaveCount(0);
  await expect(connector).not.toHaveAttribute('marker-end');
  await undo();
  await expect(pattern).toHaveValue('strategic:upstream-downstream');
  await expect(downstream).toHaveValue('anti-corruption-layer');
  await pattern.selectOption('strategic:customer-supplier');
  await expect(ohs).toBeChecked();
  await expect(downstream).toHaveValue('anti-corruption-layer');
  await expect(label).toContainText('Supplier');
  await undo();
  await expect(pattern).toHaveValue('strategic:upstream-downstream');
  await protect.check();
  await expect(pattern).toBeDisabled();
  await expect(ohs).toBeDisabled();
  await expect(downstream).toBeDisabled();
  await expect(controls.getByLabel('DDD protection reason', { exact: true })).toContainText(
    'managed by the architecture team',
  );
  await expect(downstream).toHaveAttribute('aria-description', /managed/u);
  await expect(page.locator('#flow-demo-edge-actions')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide controls', exact: true }).click();
  await expect(page.locator('#flow-demo-edge-actions')).toBeVisible();
  await page.getByRole('button', { name: 'Show controls', exact: true }).click();
  await expect(page.locator('#flow-demo-edge-actions')).toHaveCount(0);
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
    await controls.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: fileURLToPath(new URL(`./ddd-relationship-controls-${theme}.png`, import.meta.url)),
    });
  }
  await protect.uncheck();
  await expect(pattern).toBeEnabled();
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('Inspect');
  await expect(controls.getByLabel('DDD relationship status', { exact: true })).toHaveCount(0);
  await expect(downstream).toBeEnabled();
  await section('Diagnostics');
  await button('Minimal mode').click();
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).uncheck();
  await section('Inspect');
  await expect(controls.getByLabel('DDD relationship status', { exact: true })).toHaveCount(0);
  await expect(ohs).toBeChecked();
  await section('Diagnostics');
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).check();
  expect((await download()).snapshot).toEqual(initial.snapshot);
  await page
    .getByRole('textbox', { name: 'Edition name', exact: true })
    .fill('DDD controls review');
  await button('Capture edition').click();
  const rewind = page.getByRole('combobox', { name: 'Rewind to edition', exact: true }),
    choice = rewind.getByRole('option', { name: 'DDD controls review', exact: true });
  await expect(choice).toHaveCount(1);
  await rewind.selectOption(await choice.getAttribute('value'));
  await expect(
    page.getByText('Read-only edition: DDD controls review. Working model preserved.', {
      exact: true,
    }),
  ).toBeVisible();
  await section('Inspect');
  await inspect.selectOption('orders-billing');
  await expect(pattern).toBeDisabled();
  await expect(downstream).toBeDisabled();
  await expect(controls.getByLabel('DDD protection reason', { exact: true })).toContainText(
    'Return to the working model',
  );
  expect((await download()).snapshot).toEqual(initial.snapshot);
  await button('Return to present').click();
  await section('Inspect');
  await expect(pattern).toBeEnabled();
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'public custom-composed inspector controls',
          'downstream selection and Undo/Redo',
          'native keyboard upstream toggle',
          'empty role fields omitted from canonical JSON',
          'explicit symmetric transition removes side fields in one Undo',
          'directional transitions preserve authored roles',
          'owner policy disables fields with visible/accessible reasons',
          'light/dark protection captures with persistent canvas',
          'floating toolbar suppressed in inspector and restored when collapsed',
          'minimal/global diagnostic independence',
          'historical inspection stays read-only and working snapshot preserved',
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
