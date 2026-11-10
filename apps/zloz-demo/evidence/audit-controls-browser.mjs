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
    viewport: { width: 1600, height: 1360 },
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
  const download = async () => {
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return parseModelDocument(await readFile(await file.path(), 'utf8'));
  };
  const group = page.getByRole('group', { name: 'Causal audit comparison', exact: true });
  const rewind = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  const target = page.getByRole('combobox', { name: 'Audit target', exact: true });
  const findings = page.getByRole('list', { name: 'Causal audit findings', exact: true });
  const filter = (name) => page.getByRole('checkbox', { name: `${name} findings`, exact: true });
  const finding = (kind, label, side) =>
    findings.getByRole('button', {
      name: `View ${kind} finding: ${label} in Causal review · ${side}`,
      exact: true,
    });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await section('History');
  const original = await download();
  await section('Diagram');
  await page.locator('[data-flow-handle="source"]').press('ArrowRight');
  await section('History');
  const working = await download();
  expect(working.snapshot.graph).not.toEqual(original.snapshot.graph);
  await button('Load causal audit example').click();
  await expect(group).toBeVisible();
  await expect(page.getByLabel('Audit comparison status', { exact: true })).toHaveText(
    '1 introduced, 2 resolved, 1 persisting.',
  );
  await expect(findings.locator('li')).toHaveCount(4);
  await expect(rewind).toHaveValue('audit-after');
  await finding('introduced', 'Handles', 'after').press('Enter');
  await expect(finding('introduced', 'Handles', 'after')).toBeFocused();
  await expect(rewind).toHaveValue('audit-after');
  await finding('resolved', 'Legacy', 'before').press('Enter');
  await expect(finding('resolved', 'Legacy', 'before')).toBeFocused();
  await expect(rewind).toHaveValue('audit-before');
  await expect(target).toHaveValue('audit-after');
  // The edge hit path is transparent and horizontal (zero-height SVG bounds).
  // Check its identity/path, then qualify the reveal using real endpoint geometry.
  await expect(page.locator('[data-flow-edge="audit-removed"]').first()).toHaveAttribute(
    'd',
    /M.+L/u,
  );
  const canvas = await page.locator('#flow-demo-surface').boundingBox();
  expect(canvas).not.toBeNull();
  for (const name of ['Select Place order', 'Select Order aggregate']) {
    const node = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(node).not.toBeNull();
    expect(node.x + node.width / 2).toBeGreaterThan(canvas.x);
    expect(node.x + node.width / 2).toBeLessThan(canvas.x + canvas.width);
    expect(node.y + node.height / 2).toBeGreaterThan(canvas.y);
    expect(node.y + node.height / 2).toBeLessThan(canvas.y + canvas.height);
  }
  await expect(page.locator('[data-flow-edge="audit-added"]')).toHaveCount(0);
  await finding('persisting', 'Outstanding submission', 'after').click();
  await expect(rewind).toHaveValue('audit-after');
  await filter('Introduced').uncheck();
  await expect(findings.locator('li')).toHaveCount(3);
  await filter('Resolved').uncheck();
  await filter('Persisting').uncheck();
  await expect(findings.locator('li')).toHaveCount(0);
  await expect(page.getByLabel('Audit comparison status', { exact: true })).toHaveText(
    'No findings match these filters.',
  );
  await filter('Introduced').check();
  await filter('Resolved').check();
  await filter('Persisting').check();
  await target.selectOption('');
  await expect(findings.getByRole('button', { name: /View introduced/ })).toHaveCount(0);
  await expect(findings.locator('li')).toHaveCount(3);
  await finding('resolved', 'Legacy', 'before').click();
  await expect(rewind).toHaveValue('audit-before');
  await expect(target).toHaveValue('');
  await target.selectOption('audit-after');
  const loaded = await download();
  expect(loaded.snapshot).toEqual(working.snapshot);
  expect(loaded.editions).toHaveLength(2);
  // Manual navigation remains usable with reduced motion; explicit focus pauses timed playback.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('checkbox', { name: 'Enable edition playback', exact: true }).check();
  await button('Play editions').click();
  await expect(page.getByLabel('Edition playback status', { exact: true })).toContainText(
    'Playing',
  );
  await filter('Resolved').uncheck();
  await expect(page.getByLabel('Edition playback status', { exact: true })).toContainText(
    'Playing',
  );
  await filter('Resolved').check();
  await finding('introduced', 'Handles', 'after').click();
  await expect(page.getByLabel('Edition playback status', { exact: true })).toContainText('Paused');
  await page.waitForTimeout(2200);
  await expect(rewind).toHaveValue('audit-after');
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('History');
  await expect(page.getByLabel('Audit comparison status', { exact: true })).toHaveCount(0);
  await expect(filter('Resolved')).toBeChecked();
  await expect(findings.locator('li')).toHaveCount(4);
  await expect(finding('resolved', 'Legacy', 'before')).toBeEnabled();
  await section('Diagnostics');
  await button('Minimal mode').click();
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).uncheck();
  await section('History');
  await expect(page.getByLabel('Audit comparison status', { exact: true })).toHaveCount(0);
  await expect(group).not.toContainText(' · 1');
  await finding('resolved', 'Legacy', 'before').press('Enter');
  await expect(rewind).toHaveValue('audit-before');
  await section('Diagnostics');
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).check();
  await section('History');
  await finding('introduced', 'Handles', 'after').click();
  // Reopen the edition for its overall frame after qualifying the focused edge.
  await rewind.selectOption('audit-before');
  await rewind.selectOption('audit-after');
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: fileURLToPath(new URL(`./audit-controls-${theme}.png`, import.meta.url)),
    });
  }
  expect((await download()).snapshot).toEqual(working.snapshot);
  await button('Return to present').click();
  await expect(rewind).toHaveValue('');
  expect((await download()).snapshot).toEqual(working.snapshot);
  await section('Diagram');
  await button('Undo').click();
  await section('History');
  expect((await download()).snapshot.graph).toEqual(original.snapshot.graph);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'public controls with custom cards in the left sidebar',
          'independent baseline and target identity',
          'resolved finding reveals an existing baseline-only edge',
          'introduced/persisting findings open target edition',
          'native Enter retains keyboard focus',
          'filter subsets and empty status',
          'explicit current target remains independent of review camera',
          'focus pauses playback and old ticks do not advance review',
          'reduced-motion manual navigation',
          'minimal and diagnostics settings hide counts without disabling controls',
          'working snapshot and existing Undo preserved',
          'light/dark screenshots',
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
