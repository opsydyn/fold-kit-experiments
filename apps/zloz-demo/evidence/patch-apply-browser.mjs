import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const evidence = (file) =>
  process.env.ZLOZ_CAPTURE_DIR
    ? resolve(process.env.ZLOZ_CAPTURE_DIR, `${engine}-${file}`)
    : fileURLToPath(new URL(file, import.meta.url));
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const acknowledge = () =>
    page.getByRole('checkbox', {
      name: 'I reviewed the proposed changes and accept the disclosed losses.',
      exact: true,
    });
  const apply = () => button('Apply reviewed patch');
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('[data-flow-node="review"]').waitFor();
  const original = await page.locator('[data-flow-node="source"]').innerText();
  await section('Patch review');
  const panel = page.locator('[data-architecture-effect-ui="patch-review"]');
  await panel
    .getByRole('button', { name: 'Prepare label patch from current model', exact: true })
    .click();
  await expect(
    page.getByText('Proposal created from the current source. Working graph unchanged.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(apply()).toBeDisabled();
  await expect(page.getByRole('list', { name: 'Patch findings' })).toContainText(
    'authored-data-loss',
  );
  await acknowledge().focus();
  await acknowledge().press('Space');
  await expect(acknowledge()).toBeChecked();
  await expect(acknowledge()).toBeFocused();
  await expect(apply()).toBeEnabled();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await apply().scrollIntoViewIfNeeded();
  await page.screenshot({ path: evidence('patch-apply-light.png') });
  const [proposalFile] = await Promise.all([
    page.waitForEvent('download'),
    button('Download proposal').click(),
  ]);
  const proposal = JSON.parse(await readFile(await proposalFile.path(), 'utf8'));
  expect(proposal.format).toBe('foldkit-zloz-patch');
  await page
    .getByLabel('Open modelling patch', { exact: true })
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(
    page.getByRole('status').filter({ hasText: 'Previous proposal preserved' }),
  ).toBeVisible();
  await expect(acknowledge()).toBeChecked();
  await expect(apply()).toBeEnabled();
  expect(await page.locator('[data-flow-node="source"]').innerText()).toBe(original);
  await page.getByRole('checkbox', { name: 'Protect patch Apply', exact: true }).check();
  await expect(apply()).toBeDisabled();
  await expect(acknowledge()).toBeChecked();
  await button('Use custom patch controls').click();
  await expect(page.locator('.patch-change-card')).toBeVisible();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await apply().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: evidence('patch-apply-dark-protected.png'),
  });
  await page.getByRole('checkbox', { name: 'Protect patch Apply', exact: true }).uncheck();
  await expect(apply()).toBeEnabled();
  await apply().click();
  await expect(page.locator('[data-flow-node="source"]')).toContainText('reviewed');
  await expect(button('Download patch receipt')).toBeVisible();
  const [receiptFile] = await Promise.all([
    page.waitForEvent('download'),
    button('Download patch receipt').click(),
  ]);
  const receipt = JSON.parse(await readFile(await receiptFile.path(), 'utf8'));
  expect(receipt.format).toBe('foldkit-zloz-patch-receipt');
  expect(receipt.patch).toEqual(proposal);
  expect(receipt.graph.nodes[0].label).toContain('reviewed');
  expect(receipt.patch.source.graph.nodes[0].label).not.toContain('reviewed');
  expect(receipt.revision).toBe(proposal.source.revision + 1);
  expect(receipt.reviewed && receipt.lossesAccepted).toBe(true);
  await writeFile(evidence('patch-applied-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await button('Undo').click();
  await expect(page.getByRole('textbox', { name: 'Label for source', exact: true })).toHaveValue(
    'Draft',
  );
  await expect(button('Download patch receipt')).toBeVisible();
  await button('Prepare label patch from current model').click();
  await expect(acknowledge()).not.toBeChecked();
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('Patch review');
  await expect(page.locator('[data-patch-counts]')).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Patch findings' })).toContainText(
    'authored-data-loss',
  );
  await acknowledge().click();
  await expect(acknowledge()).toBeChecked();
  await expect(apply()).toBeEnabled();
  const canvas = await page.locator('[data-flow-surface]').boundingBox();
  expect(canvas.x).toBeGreaterThan(350);
  expect(canvas.width).toBeGreaterThan(1000);
  await page.screenshot({
    path: evidence('patch-apply-minimal.png'),
  });
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      result: 'passed',
      browser: browser.version(),
      checks:
        'native/custom/light/dark/minimal, keyboard acknowledgement, protected Apply, invalid-file retention, actual proposal/receipt downloads, atomic Apply and one Undo, retained provenance, visible canvas',
      pageErrors: errors,
    }),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
