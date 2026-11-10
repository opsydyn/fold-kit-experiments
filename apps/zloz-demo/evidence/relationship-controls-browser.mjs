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
  const base = await document();
  expect(base.value.snapshot.graph.nodes).toHaveLength(6);
  expect(base.value.snapshot.graph.edges.map((edge) => edge.architecture.role)).toEqual([
    'issues',
    'handles',
    'emits',
    'activates',
    'triggers',
  ]);
  await expect(
    page.getByRole('checkbox', { name: 'Validate causal relationships', exact: true }),
  ).toBeChecked();
  await button('Add delegated command connection').click();
  await expect(page.getByLabel('Relationship edit feedback', { exact: true })).toContainText(
    'not available',
  );
  expect((await document()).value.snapshot.graph).toEqual(base.value.snapshot.graph);
  await page
    .getByRole('checkbox', { name: 'Enable custom Delegates convention', exact: true })
    .check();
  await button('Add delegated command connection').click();
  const custom = await document();
  expect(custom.value.snapshot.graph.edges.at(-1).architecture).toEqual({
    family: 'event-storming',
    role: 'custom',
    name: 'delegates',
  });
  await button('Undo').click();
  expect((await document()).value.snapshot.graph).toEqual(base.value.snapshot.graph);
  await button('Redo').click();
  expect((await document()).value.snapshot.graph).toEqual(custom.value.snapshot.graph);
  await button('Undo').click();
  const inspect = () => page.getByRole('combobox', { name: 'Inspect relationship', exact: true });
  const type = () => page.getByRole('combobox', { name: 'Causal relationship type', exact: true });
  await inspect().selectOption('step:0');
  await expect(type().locator('option[value="emits"]')).toHaveJSProperty('disabled', true);
  await button('Try incompatible relationship').click();
  await expect(page.getByLabel('Relationship edit feedback', { exact: true })).toContainText(
    'does not allow',
  );
  expect((await document()).value.snapshot.graph).toEqual(base.value.snapshot.graph);
  await page
    .getByRole('checkbox', { name: 'Validate causal relationships', exact: true })
    .uncheck();
  await type().selectOption('emits');
  await expect(
    page.getByRole('list', { name: 'Causal relationship report', exact: true }),
  ).toContainText('does not allow');
  expect((await document()).value.snapshot.graph.edges[0].architecture.role).toBe('emits');
  await button('Undo').click();
  await inspect().selectOption('step:0');
  await page.getByRole('checkbox', { name: 'Validate causal relationships', exact: true }).check();
  await type().selectOption('');
  await expect(
    page.getByRole('list', { name: 'Causal relationship report', exact: true }),
  ).toContainText('inferred');
  await button('Apply inferred relationship').click();
  expect((await document()).value.snapshot.graph.edges[0].architecture.role).toBe('issues');
  await button('Add delegated command connection').click();
  const exported = await document();
  const customId = exported.value.snapshot.graph.edges.at(-1).id;
  await inspect().selectOption(customId);
  await expect(
    page.getByRole('group', { name: 'Causal relationship controls', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Causal relationship status', { exact: true })).toContainText(
    'Typed: Delegates',
  );
  await page
    .getByRole('checkbox', { name: 'Enable custom Delegates convention', exact: true })
    .uncheck();
  await expect(type()).toHaveValue('custom:delegates');
  await expect(type().locator('option[value="custom:delegates"]')).toHaveJSProperty(
    'disabled',
    true,
  );
  expect((await document()).value.snapshot.graph).toEqual(exported.value.snapshot.graph);
  await page
    .getByRole('checkbox', { name: 'Validate causal relationships', exact: true })
    .uncheck();
  await type().selectOption('');
  await expect(button('Apply inferred relationship')).toBeDisabled();
  await page
    .getByRole('checkbox', { name: 'Enable custom Delegates convention', exact: true })
    .check();
  await expect(button('Apply inferred relationship')).toBeEnabled();
  await button('Apply inferred relationship').click();
  await expect(page.getByLabel('Causal relationship status', { exact: true })).toContainText(
    'Typed: Delegates',
  );
  await expect(button('Apply inferred relationship')).toBeDisabled();
  await button('Undo').click();
  expect(
    (await document()).value.snapshot.graph.edges.find((edge) => edge.id === customId).architecture,
  ).toBeUndefined();
  await button('Redo').click();
  expect((await document()).value.snapshot.graph).toEqual(exported.value.snapshot.graph);
  await page.getByRole('checkbox', { name: 'Validate causal relationships', exact: true }).check();
  await inspect().selectOption('step:0');
  await expect(page.getByRole('group', { name: 'Selected edge actions', exact: true })).toHaveCount(
    0,
  );
  await button('Open connection tools').click();
  await expect(
    page.getByRole('group', { name: 'Selected edge actions', exact: true }),
  ).toBeVisible();
  await section('Diagram');
  await expect(page.getByRole('group', { name: 'Selected edge actions', exact: true })).toHaveCount(
    0,
  );
  for (const theme of ['Light', 'Dark']) {
    await page
      .getByRole('combobox', { name: 'Theme', exact: true })
      .selectOption(theme.toLowerCase());
    await page
      .getByRole('group', { name: 'Causal relationship controls', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: fileURLToPath(
        new URL(`./relationship-controls-${theme.toLowerCase()}.png`, import.meta.url),
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
          'package controls with custom selector, inference and status rendering',
          'unfamiliar stored keys remain selected without clearing metadata',
          'custom catalogue restoration enables explicit inference',
          'repeated inference is disabled without new Undo entries',
          'inference Undo and Redo preserve custom descriptors',
          'package aggregate process and five typed causal links',
          'opt-in rejection exposes reasons without modifying the model',
          'custom Delegates convention creates a typed relationship',
          'atomic connection Undo and Redo preserve typed metadata',
          'incompatible native options are disabled with validation enabled',
          'validation off permits unresolved drafts with visible diagnostics',
          'inferred legacy meaning can be explicitly applied',
          'exported model retains builtin and named custom descriptors',
          'sidebar inspector keeps the canvas clear; connection tools remain available in Ports',
          'light/dark visual captures',
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
