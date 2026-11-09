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
  const upload = async (buffer, name = 'orders.editions.json') => {
    await section('History');
    await page
      .getByLabel('Import edition archive', { exact: true })
      .setInputFiles({ name, mimeType: 'application/json', buffer });
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open DDD Order aggregate').click();
  await section('History');
  await page.getByRole('textbox', { name: 'Edition name', exact: true }).fill('Working checkpoint');
  await button('Capture edition').click();
  await button('Load Order history example').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    button('Export editions').click(),
  ]);
  const archiveBytes = await readFile(await download.path());
  const archive = parseEditions(archiveBytes.toString('utf8'));
  await page.reload();
  await button('Open DDD Order aggregate').click();
  const original = await snapshot();
  const surface = page.locator('[data-flow-surface]');
  await surface.locator('[data-flow-handle="order"]').press('ArrowRight');
  const working = await snapshot();
  expect(working.graph).not.toEqual(original.graph);
  await upload(archiveBytes);
  const notice = page.locator('.workbench-notice');
  await expect(notice).toContainText('Edition archive imported.');
  const picker = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  await expect(picker.locator('option')).toHaveCount(4);
  expect(await snapshot()).toEqual(working);
  await upload(archiveBytes);
  await expect(notice).toContainText('already available');
  await expect(picker.locator('option')).toHaveCount(4);
  const conflict = {
    format: 'foldkit-zloz-editions',
    version: 1,
    editions: [
      { ...archive[0], id: 'new-before-conflict', name: 'New' },
      { ...archive[0], name: 'Conflicting identity' },
    ],
  };
  await upload(Buffer.from(JSON.stringify(conflict)));
  await expect(notice).toContainText('Conflicting edition ID');
  await expect(picker.locator('option')).toHaveCount(4);
  await expect(picker.locator('option[value="new-before-conflict"]')).toHaveCount(0);
  await upload(Buffer.from([0xff]), 'invalid-utf8.json');
  await expect(notice).toContainText('Invalid or unreadable');
  await upload(Buffer.alloc(5 * 1024 * 1024 + 1, 32), 'oversized.json');
  await expect(notice).toContainText('up to 5 MiB');
  expect(await snapshot()).toEqual(working);
  await section('History');
  await picker.selectOption('order-evolved');
  await button('Preview edition restore').click();
  const preview = page.getByRole('region', { name: 'Edition restore preview', exact: true });
  await expect(preview).toBeVisible();
  await button('Cancel restore').click();
  await expect(preview).toHaveCount(0);
  await button('Back to present').click();
  expect(await snapshot()).toEqual(working);
  await section('History');
  await picker.selectOption('order-evolved');
  await button('Preview edition restore').click();
  await expect(preview).toBeVisible();
  const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
  for (const preference of ['light', 'dark']) {
    await theme.selectOption(preference);
    await preview.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: fileURLToPath(new URL(`edition-restore-${preference}.png`, import.meta.url)),
    });
    await expect(notice).not.toContainText('Return to the present to edit');
  }
  const protection = page.getByRole('checkbox', { name: 'Protect edition restore', exact: true });
  await protection.check();
  await expect(
    preview.getByRole('status', { name: 'Restore protection reason', exact: true }),
  ).toContainText('protected');
  await expect(button('Restore as new change')).toBeDisabled();
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('edition-restore-protected.png', import.meta.url)),
  });
  await protection.uncheck();
  await expect(button('Restore as new change')).toBeEnabled();
  await button('Restore as new change').click();
  await expect(
    page.getByRole('status', { name: 'Historical edition notice', exact: true }),
  ).toHaveCount(0);
  const restored = await snapshot();
  expect(restored.graph).toEqual(
    archive.find((item) => item.id === 'order-evolved').snapshot.graph,
  );
  expect(restored.viewport).toEqual(working.viewport);
  expect(await surface.locator('[data-flow-port]:enabled').count()).toBeGreaterThan(0);
  await button('Undo').click();
  expect(await snapshot()).toEqual(working);
  await button('Undo').click();
  expect((await snapshot()).graph).toEqual(original.graph);
  await button('Redo').click();
  expect((await snapshot()).graph).toEqual(working.graph);
  await button('Redo').click();
  expect((await snapshot()).graph).toEqual(restored.graph);
  await section('History');
  const [afterDownload] = await Promise.all([
    page.waitForEvent('download'),
    button('Export editions').click(),
  ]);
  expect(parseEditions(await readFile(await afterDownload.path(), 'utf8'))).toEqual(archive);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'fresh archive import preserves working graph/camera/Undo',
          'identical import is idempotent',
          'conflict rejects whole batch',
          'invalid UTF-8 and oversized archive preserve state',
          'preview cancellation preserves working graph',
          'live restore veto disables confirmation with a reason',
          'explicit restore preserves camera and enables editing',
          'one Undo recovers working graph and second Undo retains earlier history',
          'Redo recovers restored graph',
          'edition archive remains unchanged',
          'light/dark/protection evidence',
        ],
        pageErrors: errors,
        screenshots: [
          'edition-restore-light.png',
          'edition-restore-dark.png',
          'edition-restore-protected.png',
        ],
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
