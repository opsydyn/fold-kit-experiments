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
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    const value = parseModelDocument(await readFile(await file.path(), 'utf8'));
    await section('Diagram');
    return value;
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open C4 system context').click();
  const before = await document();
  await page.getByLabel('Protect pattern insertion', { exact: true }).check();
  await expect(button('Insert DDD aggregate pattern')).toBeDisabled();
  await expect(page.getByLabel('Pattern insertion protection reason', { exact: true })).toHaveText(
    'Pattern insertion is protected in this workspace.',
  );
  expect((await document()).snapshot.graph).toEqual(before.snapshot.graph);
  await page.getByLabel('Protect pattern insertion', { exact: true }).uncheck();
  await button('Insert DDD aggregate pattern').click();
  const inserted = await document();
  expect(inserted.id).toBe(before.id);
  expect(inserted.editions).toEqual(before.editions);
  expect(inserted.snapshot.graph.nodes).toHaveLength(before.snapshot.graph.nodes.length + 3);
  expect(inserted.snapshot.graph.edges).toHaveLength(before.snapshot.graph.edges.length + 1);
  expect(inserted.snapshot.graph.nodes.slice(0, before.snapshot.graph.nodes.length)).toEqual(
    before.snapshot.graph.nodes,
  );
  await button('Undo').click();
  expect((await document()).snapshot.graph).toEqual(before.snapshot.graph);
  await button('Redo').click();
  expect((await document()).snapshot.graph).toEqual(inserted.snapshot.graph);
  await button('Insert C4 context pattern').click();
  expect((await document()).snapshot.graph.nodes).toHaveLength(
    inserted.snapshot.graph.nodes.length + 2,
  );
  await button('Undo').click();
  expect((await document()).snapshot.graph).toEqual(inserted.snapshot.graph);
  await section('Navigation');
  await button('Fit view').click();
  await section('Diagram');
  for (const theme of ['Light', 'Dark']) {
    await page
      .getByRole('combobox', { name: 'Theme', exact: true })
      .selectOption(theme.toLowerCase());
    await page.screenshot({
      path: fileURLToPath(
        new URL(`./pattern-insertion-${theme.toLowerCase()}.png`, import.meta.url),
      ),
    });
  }
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'live protection and visible reason',
          'additive DDD insertion preserves existing graph and model identity',
          'one Undo removes complete grouped fragment',
          'Redo restores exact insertion',
          'C4 insertion and independent Undo',
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
