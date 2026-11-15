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
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const panel = page.getByRole('region', { name: 'Workshop mapping preview' });
  const item = panel.getByRole('combobox', { name: 'Review mapping', exact: true });
  const choice = panel.getByRole('combobox', { name: 'Preview choice', exact: true });
  const decision = panel.getByLabel('Mapping decision', { exact: true });
  const download = async () => {
    await section('History');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return parseModelDocument(await readFile(await file.path(), 'utf8'));
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open event-storming example').click();
  await expect(page.locator('[data-zloz-event-storming-type="command"]')).toHaveCount(2);
  const original = await download();
  await section('Mapping review');
  await expect(item).toHaveValue('node:note:1');
  await expect(decision).toHaveAttribute('data-mapping-state', 'ambiguous');
  await expect(decision).toContainText('A command is intent');
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await expect(page.locator('[data-flow-workbench-color-scheme="light"]')).toHaveCount(1);
  await page.screenshot({ path: new URL('mapping-review-light.png', import.meta.url).pathname });
  await choice.selectOption('domain-service');
  await expect(decision).toHaveAttribute('data-mapping-state', 'proposed');
  await expect(decision).toContainText('domain-service (explicit)');
  expect((await download()).snapshot.graph).toEqual(original.snapshot.graph);
  await section('Diagram');
  await expect(button('Undo')).toBeDisabled();
  await section('Mapping review');
  await item.selectOption('node:note:4');
  await expect(decision).toHaveAttribute('data-mapping-state', 'ambiguous');
  await expect(decision).toContainText('single candidate requires an explicit choice');
  await item.selectOption('node:note:0');
  await expect(decision).toHaveAttribute('data-mapping-state', 'unmapped');
  await choice.focus();
  await choice.press('k');
  await choice.press('Tab');
  await expect(decision).toHaveAttribute('data-mapping-state', 'retained');
  await expect(choice).toHaveValue('retain');
  await item.selectOption('edge:step:2');
  await choice.selectOption('tactical:uses');
  await expect(decision).toHaveAttribute('data-mapping-state', 'blocked');
  await expect(decision).toContainText('does not allow tactical:uses');
  await choice.selectOption('');
  await expect(decision).toHaveAttribute('data-mapping-state', 'proposed');
  await expect(panel.getByLabel('Selected mapping loss', { exact: true })).toContainText(
    'not a lossless semantic equivalence',
  );
  await item.selectOption('node:note:3');
  await expect(decision).toHaveAttribute('data-mapping-state', 'proposed');
  await expect(panel.getByLabel('Selected mapping loss', { exact: true })).toContainText(
    'replace the reserved EventStorming node descriptor',
  );
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await expect(page.locator('[data-flow-workbench-color-scheme="dark"]')).toHaveCount(1);
  await page.screenshot({ path: new URL('mapping-review-dark.png', import.meta.url).pathname });
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('Mapping review');
  await expect(panel.getByLabel('Mapping summary', { exact: true })).toHaveCount(0);
  await expect(panel.getByLabel('Selected mapping loss', { exact: true })).toBeVisible();
  await choice.selectOption('retain');
  await expect(decision).toHaveAttribute('data-mapping-state', 'retained');
  await section('Diagnostics');
  await button('Minimal mode').click();
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).uncheck();
  await section('Mapping review');
  await expect(panel.getByLabel('Mapping summary', { exact: true })).toHaveCount(0);
  await choice.selectOption('');
  await expect(decision).toHaveAttribute('data-mapping-state', 'proposed');
  await panel.getByRole('button', { name: 'Reset preview choices', exact: true }).click();
  await item.selectOption('node:note:1');
  await expect(decision).toHaveAttribute('data-mapping-state', 'ambiguous');
  expect((await download()).snapshot.graph).toEqual(original.snapshot.graph);
  await page
    .getByRole('textbox', { name: 'Edition name', exact: true })
    .fill('Mapping review source');
  await button('Capture edition').click();
  const edition = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  await expect(edition.locator('option', { hasText: 'Mapping review source' })).toHaveCount(1);
  const id = await edition
    .locator('option', { hasText: 'Mapping review source' })
    .getAttribute('value');
  await edition.selectOption(id);
  await section('Mapping review');
  await expect(choice).toBeDisabled();
  await expect(decision).toContainText('Return to the working model');
  await item.selectOption('edge:step:2');
  await expect(decision).toContainText('not a lossless semantic equivalence');
  expect((await download()).snapshot.graph).toEqual(original.snapshot.graph);
  await button('Return to present').click();
  await section('Mapping review');
  await expect(choice).toBeEnabled();
  await section('Diagram');
  await button('Open release workflow').click();
  await section('Mapping review');
  await expect(panel).toContainText('No EventStorming notes in this source');
  await panel.getByRole('button', { name: 'Open event-storming example', exact: true }).click();
  await expect(decision).toHaveAttribute('data-mapping-state', 'ambiguous');
  await expect(choice).toHaveValue('');
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'package-backed ambiguity and loss rendering',
          'explicit node choice and keyboard retention',
          'incompatible edge choice and compatibility reason',
          'reset and source replacement',
          'unchanged exported graph and unavailable Undo',
          'minimal/global diagnostics independence',
          'historical inspection with protected choices',
          'light/dark canvas evidence',
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
