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
    viewport: { width: 1600, height: 1100 },
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
  const document = async () => {
    await section('History');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return parseModelDocument(await readFile(await download.path(), 'utf8'));
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open DDD Order aggregate').click();
  const initial = await document();
  const handle = () => page.locator('[data-flow-handle="order"]');
  await handle().press('ArrowRight');
  await section('History');
  await button('Load Order history example').click();
  const original = await document();
  expect(original.snapshot.graph).not.toEqual(initial.snapshot.graph);
  await page
    .getByRole('combobox', { name: 'Rewind to edition', exact: true })
    .selectOption('order-start');
  await page
    .getByRole('textbox', { name: 'New model name', exact: true })
    .fill('Alternative ordering');
  const protect = page.getByRole('checkbox', { name: 'Protect edition forking', exact: true });
  await protect.check();
  await expect(button('Fork edition')).toBeDisabled();
  await expect(
    page.getByText('Edition forking is protected in this workspace.', { exact: true }),
  ).toBeVisible();
  await protect.uncheck();
  await button('Fork edition').click();
  const fork = await document();
  expect(fork.id).not.toBe(original.id);
  expect(fork.origin).toEqual({
    modelId: original.id,
    modelName: original.name,
    edition: original.editions.find((item) => item.id === 'order-start'),
  });
  expect(fork.editions).toEqual([]);
  expect(fork.snapshot.graph.nodes.map((node) => node.id)).toEqual(
    fork.origin.edition.snapshot.graph.nodes.map((node) => node.id),
  );
  await expect(page.getByLabel('Model lineage', { exact: true })).toContainText(
    'Ordering · original',
  );
  await section('Diagram');
  await expect(button('Undo')).toBeDisabled();
  await handle().press('ArrowRight');
  const edited = await document();
  expect(edited.snapshot.graph).not.toEqual(fork.snapshot.graph);
  await section('Diagram');
  await button('Undo').click();
  expect((await document()).snapshot.graph).toEqual(fork.snapshot.graph);
  await section('Diagram');
  await button('Redo').click();
  expect((await document()).snapshot.graph).toEqual(edited.snapshot.graph);
  await page
    .getByRole('combobox', { name: 'Working model', exact: true })
    .selectOption(original.id);
  const returned = await document();
  expect(returned).toEqual(original);
  await section('Diagram');
  await button('Undo').click();
  expect((await document()).snapshot.graph).toEqual(initial.snapshot.graph);
  await section('Diagram');
  await button('Redo').click();
  expect((await document()).snapshot.graph).toEqual(original.snapshot.graph);
  await page.getByRole('combobox', { name: 'Working model', exact: true }).selectOption(fork.id);
  expect((await document()).snapshot.graph).toEqual(edited.snapshot.graph);
  const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
  for (const preference of ['light', 'dark']) {
    await theme.selectOption(preference);
    await page.locator('.workbench-sidebar-scroll').evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({
      path: fileURLToPath(new URL(`model-forks-${preference}.png`, import.meta.url)),
    });
  }
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'policy-controlled fork',
          'portable pinned immediate origin',
          'local diagram IDs preserved',
          'fresh independent Undo',
          'fork Undo/Redo',
          'source graph/editions preserved',
          'source Undo/Redo preserved',
          'switching preserves fork edits',
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
