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
  const section = async (name) =>
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
  const group = page.getByRole('group', { name: 'DDD audit review', exact: true });
  const baseline = group.getByRole('combobox', { name: 'DDD baseline', exact: true });
  const target = group.getByRole('combobox', { name: 'DDD target', exact: true });
  const findings = group.getByRole('list', { name: 'DDD audit findings', exact: true });
  const rewind = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  const finding = (subject, kind, label, side) =>
    findings.getByRole('button', {
      name: `View ${subject} for ${kind} DDD finding: ${label} in DDD review · ${side}`,
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
  await button('Load DDD audit example').click();
  await expect(group).toBeVisible();
  await expect(page.getByLabel('DDD audit status', { exact: true })).toHaveText(
    '2 introduced, 3 resolved, 1 persisting.',
  );
  await expect(findings.locator('li')).toHaveCount(6);
  await finding('edge', 'introduced', 'Enrichment', 'after').press('Enter');
  await expect(finding('edge', 'introduced', 'Enrichment', 'after')).toBeFocused();
  await expect(rewind).toHaveValue('ddd-after');
  await finding('source', 'resolved', 'Legacy partnership', 'before').click();
  await expect(rewind).toHaveValue('ddd-before');
  await expect(baseline).toHaveValue('ddd-before');
  await expect(target).toHaveValue('ddd-after');
  await finding('target', 'persisting', 'Still outstanding', 'after').click();
  await expect(rewind).toHaveValue('ddd-after');
  const introduced = group.getByRole('checkbox', { name: 'Introduced findings', exact: true });
  await introduced.uncheck();
  await expect(findings.locator('li')).toHaveCount(4);
  await introduced.check();
  await target.selectOption('ddd-before');
  await expect(page.getByLabel('DDD audit status', { exact: true })).toHaveText(
    '0 introduced, 0 resolved, 4 persisting.',
  );
  await target.selectOption('ddd-after');
  await baseline.selectOption('');
  await expect(findings.locator('li')).toHaveCount(3);
  await expect(group.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByLabel('DDD audit status', { exact: true })).toHaveText(
    '3 blocked DDD findings; 1 typed, 0 unrelated.',
  );
  await baseline.selectOption('ddd-before');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('checkbox', { name: 'Enable edition playback', exact: true }).check();
  await button('Play editions').click();
  await finding('edge', 'resolved', 'Legacy partnership', 'before').click();
  await expect(page.getByLabel('Edition playback status', { exact: true })).toContainText('Paused');
  await page.waitForTimeout(2200);
  await expect(rewind).toHaveValue('ddd-before');
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('History');
  await expect(page.getByLabel('DDD audit status', { exact: true })).toHaveCount(0);
  await expect(findings.locator('li')).toHaveCount(6);
  await expect(finding('edge', 'resolved', 'Legacy partnership', 'before')).toBeEnabled();
  await expect(findings).toContainText(
    'A strategic relationship requires two distinct bounded contexts.',
  );
  await section('Diagnostics');
  await button('Minimal mode').click();
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).uncheck();
  await section('History');
  await expect(page.getByLabel('DDD audit status', { exact: true })).toHaveCount(0);
  await expect(introduced).toBeChecked();
  await section('Diagnostics');
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).check();
  await section('History');
  await rewind.selectOption('ddd-after');
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
    await page
      .getByRole('heading', { name: 'DDD findings', exact: true })
      .evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({
      path: fileURLToPath(new URL(`./ddd-audit-${theme}.png`, import.meta.url)),
    });
  }
  expect((await download()).snapshot).toEqual(working.snapshot);
  await baseline.selectOption('');
  await target.selectOption('');
  await expect(findings.locator('li')).toHaveCount(0);
  // Explicit current selection audits working data, independently of the historical camera.
  await expect(rewind).toHaveValue('ddd-after');
  await button('Return to present').click();
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
          'public composable DDD review and custom cards',
          'exact introduced/resolved/persisting counts and same-edition review',
          'edge/source/target navigation selects the correct immutable edition',
          'keyboard Enter retains focus',
          'baseline and target remain independent of displayed camera',
          'single-target current and edition review',
          'filters, minimal mode and global diagnostics retain reasons and functionality',
          'finding focus pauses playback and invalidates queued ticks',
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
