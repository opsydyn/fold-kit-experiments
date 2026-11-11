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
  const downloadModel = async () => {
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return parseModelDocument(await readFile(await file.path(), 'utf8'));
  };
  const panel = page.getByRole('region', { name: 'Review packet export', exact: true });
  const consent = panel.getByRole('checkbox', {
    name: 'Allow reported projection losses for this packet',
    exact: true,
  });
  const save = panel.getByRole('button', { name: 'Download review packet', exact: true });
  const target = page.getByRole('combobox', { name: 'Audit target', exact: true });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await section('History');
  const original = await downloadModel();
  await expect(save).toBeDisabled();
  await expect(panel).toContainText('Choose an audit baseline');
  await section('Diagram');
  await page.locator('[data-flow-handle="source"]').press('ArrowRight');
  await section('History');
  const working = await downloadModel();
  expect(working.snapshot.graph).not.toEqual(original.snapshot.graph);
  await button('Load causal audit example').click();
  await expect(panel.getByLabel('Review packet scope', { exact: true })).toContainText(
    'Causal review · before → Causal review · after',
  );
  await expect(save).toBeDisabled();
  await panel.getByText('Inspect projection losses', { exact: true }).click();
  await expect(
    panel.getByRole('list', { name: 'Review packet diagnostics', exact: true }),
  ).toBeVisible();
  await consent.focus();
  await consent.press('Space');
  await expect(consent).toBeChecked();
  await expect(save).toBeEnabled();
  const downloadPacket = async () => {
    const [file] = await Promise.all([page.waitForEvent('download'), save.click()]);
    expect(file.suggestedFilename()).toBe('foldkit-zloz.review.json');
    return JSON.parse(await readFile(await file.path(), 'utf8'));
  };
  const packet = await downloadPacket();
  expect(packet.format).toBe('foldkit-zloz-review');
  expect(packet.version).toBe(1);
  expect(packet.baseline.source.id).toBe('audit-before');
  expect(packet.selected.source.id).toBe('audit-after');
  expect(packet.comparison.summary).toEqual({ introduced: 1, resolved: 2, persisting: 1 });
  expect(packet.projections.baseline.source).toContain('flowchart LR');
  expect(packet.projections.selected.source).toContain('flowchart LR');
  expect(packet.diagnostics.some((item) => item.side === 'baseline')).toBe(true);
  expect(packet.diagnostics.some((item) => item.side === 'selected')).toBe(true);
  expect('origin' in packet).toBe(false);
  expect('editions' in packet).toBe(false);
  // A visible rewind does not choose the export source.
  await page
    .getByRole('combobox', { name: 'Rewind to edition', exact: true })
    .selectOption('audit-before');
  await expect(
    page.getByText('Read-only edition: Causal review · before. Working model preserved.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(target).toHaveValue('audit-after');
  await expect(save).toBeEnabled();
  await target.selectOption('');
  await expect(panel.getByLabel('Review packet scope', { exact: true })).toContainText(
    'Current graph',
  );
  await expect(consent).not.toBeChecked();
  await expect(save).toBeDisabled();
  await expect(panel.getByLabel('Review packet scope', { exact: true })).toContainText(
    'Current graph',
  );
  await consent.check();
  const current = await downloadPacket();
  expect(current.selected.source).toEqual({ kind: 'current' });
  expect(current.selected.snapshot).toEqual(working.snapshot);
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('History');
  await expect(panel.getByLabel('Review packet status', { exact: true })).toHaveCount(0);
  await expect(panel.getByLabel('Review packet scope', { exact: true })).toBeVisible();
  await expect(save).toBeEnabled();
  await section('Diagnostics');
  await button('Minimal mode').click();
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).uncheck();
  await section('History');
  await expect(panel.getByLabel('Review packet status', { exact: true })).toHaveCount(0);
  await expect(save).toBeEnabled();
  await section('Diagnostics');
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).check();
  await section('History');
  await target.selectOption('audit-after');
  await page
    .getByRole('combobox', { name: 'Rewind to edition', exact: true })
    .selectOption('audit-after');
  // Source review is overall-framed; controls and canvas stay simultaneously visible.
  await expect(panel.getByLabel('Review packet scope', { exact: true })).toContainText(
    'Causal review · before → Causal review · after',
  );
  await expect(
    page.getByText('Read-only edition: Causal review · after. Working model preserved.', {
      exact: true,
    }),
  ).toBeVisible();
  await consent.check();
  await expect(save).toBeEnabled();
  await panel.getByText('Inspect projection losses', { exact: true }).click();
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
    await expect(save).toBeEnabled();
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: fileURLToPath(new URL(`./review-packet-controls-${theme}.png`, import.meta.url)),
    });
  }
  expect((await downloadModel()).snapshot).toEqual(working.snapshot);
  await button('Return to present').click();
  await section('Diagram');
  await button('Undo').click();
  await section('History');
  expect((await downloadModel()).snapshot.graph).toEqual(original.snapshot.graph);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'native keyboard loss consent and blocked initial download',
          'selected edition packet downloaded and inspected',
          'rewind independent of export sources',
          'selection change invalidates consent',
          'current target preserves full working snapshot/camera',
          'minimal and diagnostics visibility without disabling export',
          'light/dark shared family styles with visible canvas',
          'working graph and prior Undo preserved',
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
