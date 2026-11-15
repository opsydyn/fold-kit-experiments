import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const file = (name) => fileURLToPath(new URL(name, import.meta.url));
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const model = async () => {
    await section('History');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return JSON.parse(await readFile(await download.path(), 'utf8')).document;
  };
  const panel = page.getByRole('region', { name: 'C4 mapping review', exact: true });
  const targets = {
    'node:request': 'Request payment',
    'node:provider': 'Payment provider',
    'edge:provider-handles': 'Handled by',
    'node:retry-question': 'Who owns retries?',
    'node:workshop-lane': 'Payment discovery',
  };
  const select = async (key) => {
    await page.getByRole('combobox', { name: 'Review C4 mapping', exact: true }).selectOption(key);
    await expect(page.getByRole('status', { name: 'C4 mapping target', exact: true })).toHaveText(
      targets[key],
    );
  };
  const role = page.getByRole('combobox', { name: 'C4 role', exact: true });
  const name = page.getByRole('textbox', { name: 'C4 structural name', exact: true });
  const decision = page.getByRole('status', { name: 'C4 mapping decision', exact: true });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open workshop semantics example').click();
  const before = await model();
  await section('C4 mapping review');
  await expect(panel).toContainText('Needs a choice');
  await expect(button('Preview C4 mapping')).toBeDisabled();
  await expect(panel.getByRole('button', { name: /Apply/u })).toHaveCount(0);
  await panel.getByText('C4 source provenance', { exact: true }).click();
  await expect(panel).toContainText('Original model · no fork parent');
  await select('node:request');
  await role.selectOption('container');
  await expect(page.getByRole('textbox', { name: 'C4 technology', exact: true })).toBeVisible();
  await name.fill('Payments API');
  await page.getByRole('textbox', { name: 'C4 technology', exact: true }).fill('HTTP');
  await expect(decision).toHaveText('Unmapped');
  await button('Preview C4 mapping').focus();
  await page.keyboard.press('Enter');
  await expect(button('Preview C4 mapping')).toBeFocused();
  await expect(decision).toHaveText('Explicit proposal');
  await select('node:provider');
  await role.selectOption('software-system');
  const scope = page.getByRole('combobox', { name: 'C4 scope', exact: true });
  await expect(scope).toHaveValue('');
  await scope.selectOption('external');
  await button('Preview C4 mapping').click();
  await select('edge:provider-handles');
  await page
    .getByRole('textbox', { name: 'C4 communication label', exact: true })
    .fill('Requests payment authorization');
  await button('Preview C4 mapping').click();
  await expect(decision).toHaveText('Explicit proposal');
  await select('node:retry-question');
  await role.selectOption('component');
  await button('Preview C4 mapping').click();
  await expect(panel.getByRole('list', { name: 'C4 semantic losses', exact: true })).toContainText(
    'authored open status would be replaced',
  );
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await page.getByRole('heading', { name: 'Workshop → C4', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: file('c4-mapping-light.png') });
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await page.screenshot({ path: file('c4-mapping-dark.png') });
  await panel
    .getByRole('heading', { name: 'Prospective C4 semantic losses', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: file('c4-mapping-losses-dark.png') });
  await select('node:workshop-lane');
  await expect(role.locator('option[value="person"]')).toHaveJSProperty('disabled', true);
  await expect(role.locator('option[value="component"]')).toHaveJSProperty('disabled', true);
  await role.selectOption('software-system');
  await button('Preview C4 mapping').click();
  await expect(panel.getByRole('list', { name: 'C4 semantic losses', exact: true })).toContainText(
    'organizational lane',
  );
  await select('node:retry-question');
  await name.fill('');
  await expect(button('Preview C4 mapping')).toBeDisabled();
  await expect(decision).toHaveText('Unmapped');
  await button('Keep workshop meaning for C4').click();
  await expect(decision).toHaveText('Workshop meaning retained');
  await button('Clear C4 choice').click();
  await expect(decision).toHaveText('Unmapped');
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('C4 mapping review');
  await expect(panel.getByText('C4 source provenance', { exact: true })).toBeVisible();
  await expect(panel.getByText('C4 source identifiers', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('list', { name: 'C4 semantic losses', exact: true })).toBeVisible();
  expect(await model()).toEqual(before);
  await page.getByRole('textbox', { name: 'Edition name', exact: true }).fill('C4 review source');
  await button('Capture edition').click();
  const rewind = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  await expect(rewind.locator('option')).toHaveCount(2);
  await rewind.selectOption(await rewind.locator('option').last().getAttribute('value'));
  await expect(button('Back to present')).toBeVisible();
  await section('C4 mapping review');
  await expect(panel).toContainText('Return to the working model');
  await select('node:provider');
  await expect(role).toBeDisabled();
  await expect(button('Keep workshop meaning for C4')).toBeDisabled();
  await expect(
    page.getByRole('combobox', { name: 'Review C4 mapping', exact: true }),
  ).toBeEnabled();
  await section('History');
  await button('Back to present').click();
  expect((await model()).snapshot.graph).toEqual(before.snapshot.graph);
  await section('C4 mapping review');
  await expect(decision).toHaveText('Needs a choice');
  expect(errors).toEqual([]);
  const result = {
    result: 'passed',
    evidence: [
      'explicit staged node/scope/technology and communication choices',
      'Enter activates Preview with focus retained',
      'kind restrictions, blank name, retention and clearing',
      'hotspot/lane/membership losses visible',
      'light/dark sidebar with persistent canvas',
      'Minimal mode preserves semantic review',
      'source/lineage unchanged before edition capture',
      'historical review protects choices and permits inspection',
      'return to working source clears stale review',
    ],
    pageErrors: errors,
  };
  await writeFile(file('c4-mapping-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
