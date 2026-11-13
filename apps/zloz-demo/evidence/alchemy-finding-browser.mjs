import { readFile } from 'node:fs/promises';
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
    viewport: { width: 1600, height: 1300 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const errors = [],
    requests = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => requests.push(request.url()));
  const base = `http://127.0.0.1:${server.address().port}`;
  const section = async (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const panel = page.locator('#workbench-alchemy');
  const close = () =>
    page
      .locator('.alchemy-canvas')
      .getByRole('button', { name: 'Return to working model', exact: true })
      .click();
  const model = async () => {
    await section('History');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export model with lineage', exact: true }).click(),
    ]);
    return JSON.parse(await readFile(await file.path(), 'utf8'));
  };
  await page.goto(base);
  await page.locator('[data-flow-node="review"]').waitFor();
  const original = await model();
  await section('Domain review');
  await panel.getByRole('button', { name: 'Review bank example', exact: true }).focus();
  await panel.getByRole('button', { name: 'Review bank example', exact: true }).press('Enter');
  await expect(panel.getByRole('status')).toContainText('Read-only descriptor review opened');
  await expect(page.locator('.alchemy-canvas [data-flow-node]')).toHaveCount(7);
  await expect(page.locator('.alchemy-canvas [data-flow-group]')).toHaveCount(1);
  await expect(page.locator('.alchemy-canvas [data-flow-ddd-node="read-model"]')).toHaveCount(1);
  await expect(panel).toContainText('example/bank');
  await expect(panel).toContainText('fixture-v1');
  await expect(panel).toContainText('23 source facts');
  await expect(panel.getByRole('list', { name: 'Descriptor findings' }).locator('li')).toHaveCount(
    9,
  );
  const navigation = page.getByRole('navigation', { name: 'Workbench sections' });
  await expect(navigation.getByRole('button', { name: 'Diagram', exact: true })).toBeDisabled();
  // The detached canvas admits selection/viewport navigation, never Delete/edit.
  const revealNode = panel.getByRole('button', { name: 'Reveal Ledger (stream)', exact: true });
  await revealNode.focus();
  await revealNode.press('Enter');
  await expect(revealNode).toBeFocused();
  await expect(panel.getByRole('status')).toContainText('Revealed Ledger (stream)');
  await expect(revealNode.locator('..')).toHaveAttribute('data-alchemy-finding-selected', 'true');
  const selectedNode = page.locator(
    '.alchemy-canvas [data-flow-handle="example%2Fbank/Bank/stream/Ledger"]',
  );
  await selectedNode.click();
  await expect(selectedNode).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('.alchemy-canvas').getByRole('button', { name: 'Collapse', exact: true }),
  ).toHaveCount(0);
  const surface = page.locator('.alchemy-canvas [data-flow-surface]');
  await surface.focus();
  await surface.press('Delete');
  await expect(page.locator('.alchemy-canvas [data-flow-node]')).toHaveCount(7);
  await page.getByRole('button', { name: 'Hide controls', exact: true }).click();
  await page.locator('.workbench-rail-fit').click();
  await page.getByRole('button', { name: 'Show controls', exact: true }).click();
  await page.getByRole('button', { name: 'Fit descriptor diagram', exact: true }).click();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await panel
    .getByRole('heading', { name: 'Source provenance', exact: true })
    .scrollIntoViewIfNeeded();
  await revealNode.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('alchemy-finding-light.png', import.meta.url)),
  });
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await section('Diagnostics');
  await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
  await section('Domain review');
  await expect(panel.getByRole('list', { name: 'Descriptor findings' })).toBeVisible();
  await panel
    .getByRole('heading', { name: 'Losses and unverified meaning', exact: true })
    .scrollIntoViewIfNeeded();
  const revealEdge = panel.getByRole('button', {
    name: 'Reveal entry-type: MoneyDeposited → Ledger',
    exact: true,
  });
  await revealEdge.focus();
  await revealEdge.press('Enter');
  await expect(revealEdge).toBeFocused();
  await expect(revealEdge.locator('..')).toHaveAttribute('data-alchemy-finding-selected', 'true');
  await expect(revealNode.locator('..')).toHaveAttribute('data-alchemy-finding-selected', 'false');
  await expect(selectedNode).toHaveAttribute('aria-pressed', 'false');
  await expect(panel.getByRole('status')).toContainText(
    'Revealed entry-type: MoneyDeposited → Ledger',
  );
  await page.screenshot({
    path: fileURLToPath(new URL('alchemy-finding-dark.png', import.meta.url)),
  });
  const sample = await readFile(
    new URL('../src/editor/alchemy-example.json', import.meta.url),
    'utf8',
  );
  const upload = () => panel.getByRole('textbox', { name: 'Descriptor JSON', exact: true });
  const previousDraft = await upload().inputValue();
  await upload().fill(' '.repeat(1_048_577));
  await expect(panel.getByRole('status')).toContainText('Rejected');
  await expect(upload()).toHaveValue(previousDraft);
  await upload().fill(sample.replace('"version": 1', '"version": 1, "\\u0076ersion": 1'));
  await panel.getByRole('button', { name: 'Review descriptor', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Duplicate decoded JSON property');
  await expect(page.locator('.alchemy-canvas [data-flow-node]')).toHaveCount(7);
  await revealNode.click();
  await expect(revealNode.locator('..')).toHaveAttribute('data-alchemy-finding-selected', 'true');
  await panel.getByRole('button', { name: 'Review bank example', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('opened');
  await panel.getByLabel('Open descriptor file', { exact: true }).setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from([0xff]),
  });
  await expect(panel.getByRole('status')).toContainText('Rejected');
  await expect(page.locator('.alchemy-canvas [data-flow-node]')).toHaveCount(7);
  await panel.getByLabel('Open descriptor file', { exact: true }).setInputFiles({
    name: 'next.json',
    mimeType: 'application/json',
    buffer: Buffer.from(sample.replace('fixture-v1', 'fixture-v2')),
  });
  await expect(page.locator('.alchemy-canvas .receipt-canvas-banner')).toContainText('fixture-v2');
  await close();
  expect(await model()).toEqual(original);
  await expect(page.locator('.alchemy-canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(requests.filter((url) => !url.startsWith(base) && !url.startsWith('data:'))).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'keyboard example opening and finding reveal without stealing focus',
          'node and relation selection feedback, with exactly one target selected',
          'finding navigation survives rejected descriptor replacement',
          'detached native read-model and all 23 source facts',
          'nine visible loss/unverified findings and host provenance',
          'editing unavailable, selected node survives Delete, unsupported collapse control omitted',
          'collapsed rail Fit targets detached canvas',
          'light/dark and Minimal mode retain findings',
          'oversized paste restores previous bounded draft and review',
          'escaped duplicate keys rejected without replacing preview',
          'invalid UTF-8 preserves preview; valid file replaces revision',
          'working model and lineage unchanged after close',
          'no page errors or external network requests',
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
