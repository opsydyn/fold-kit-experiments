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
    const path = await file.path();
    const value = parseModelDocument(await readFile(path, 'utf8'));
    await section('Diagram');
    return { path, value };
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open event-storming example').click();
  await expect(page.locator('[data-zloz-event-storming-node]')).toHaveCount(5);
  const base = await document();
  await page.getByLabel('Protect pattern insertion', { exact: true }).check();
  await expect(button('Insert event-storming pattern')).toBeDisabled();
  await page.getByLabel('Protect pattern insertion', { exact: true }).uncheck();
  await button('Insert event-storming pattern').click();
  const added = await document();
  expect(added.value.snapshot.graph.nodes).toHaveLength(10);
  expect(added.value.snapshot.graph.edges).toHaveLength(8);
  expect(added.value.snapshot.graph.nodes.slice(0, 5)).toEqual(base.value.snapshot.graph.nodes);
  await button('Undo').click();
  expect((await document()).value.snapshot.graph).toEqual(base.value.snapshot.graph);
  await button('Redo').click();
  expect((await document()).value.snapshot.graph).toEqual(added.value.snapshot.graph);
  await button('Undo').click();
  await section('History');
  await page.getByRole('textbox', { name: 'Edition name', exact: true }).fill('Ordering workshop');
  await button('Capture edition').click();
  const exported = await document();
  expect(exported.value.editions).toHaveLength(1);
  await page.reload();
  await button('Open event-storming example').waitFor();
  await section('History');
  await page.getByLabel('Open model JSON', { exact: true }).setInputFiles(exported.path);
  await expect(page.locator('[data-zloz-event-storming-node]')).toHaveCount(5);
  expect((await document()).value).toEqual(exported.value);
  await section('Appearance');
  await expect(page.getByLabel('Event-storming role legend', { exact: true })).toContainText(
    'Actor · Command · Domain Event · Policy',
  );
  await section('Navigation');
  await button('Fit view').click();
  await section('Diagram');
  for (const theme of ['Light', 'Dark']) {
    await page
      .getByRole('combobox', { name: 'Theme', exact: true })
      .selectOption(theme.toLowerCase());
    await page.screenshot({
      path: fileURLToPath(new URL(`./event-storming-${theme.toLowerCase()}.png`, import.meta.url)),
    });
  }
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'all four roles render with explicit text',
          'live insertion protection',
          'additive insertion preserves original nodes',
          'one Undo/Redo per process insertion',
          'edition capture and portable model reopen preserve semantic notes',
          'import selects package note renderer',
          'visible role legend and light/dark screenshots',
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
