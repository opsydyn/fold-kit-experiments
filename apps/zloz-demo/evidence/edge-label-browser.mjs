import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, firefox, webkit, expect } = require('@playwright/test');
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  const path = resolve(root, '.' + (route.endsWith('/') ? route + 'index.html' : route));
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  await readFile(path).then(
    (body) => {
      response.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
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
const qualify = async () => {
  const browser = await { chromium, firefox, webkit }[engine].launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const sections = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
    const section = (name) => sections.getByRole('button', { name, exact: true }).click();
    const exportGraph = async () => {
      await section('Diagram');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const description = 'source:out → review:in';
    const edgeLabels = page.getByRole('combobox', { name: 'Edge labels', exact: true });
    const native = page.locator('[data-architecture-effect-ui="edge-label:draft-review"]');
    const labelFrame = native.locator('..');
    const textbox = page.getByRole('textbox', {
      name: 'Edge label for ' + description,
      exact: true,
    });
    const edit = (label) => button('Edit edge label ' + label + ' for ' + description);
    const surface = page.locator('[data-flow-surface]');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await section('Appearance');
    await page.getByRole('combobox', { name: 'Edge design', exact: true }).selectOption('raised');
    await edgeLabels.selectOption('badge');
    const initial = await exportGraph();
    await section('Inspect');
    await button(description).click();
    await expect(native).toBeVisible();
    const add = button('Add label for ' + description);
    await expect(add).toHaveClass(/custom-edge-badge/);
    const anchor = await labelFrame.getAttribute('style');
    await add.press('Enter');
    await expect(textbox).toBeFocused();
    await expect(textbox.locator('..')).toHaveClass(/custom-edge-editor/);
    await textbox.pressSequentially('  Release approval  ');
    await expect(textbox).toHaveValue('  Release approval  ');
    await expect(labelFrame).toHaveAttribute(
      'style',
      anchor.replace('z-index: auto', 'z-index: 2'),
    );

    await textbox.press('Enter');
    const saved = edit('Release approval');
    await expect(saved).toHaveClass(/custom-edge-badge/);
    await expect(labelFrame).toHaveAttribute('style', anchor);
    await expect(saved).toBeFocused();
    expect(await exportGraph()).toEqual({
      ...initial,
      edges: [{ ...initial.edges[0], label: 'Release approval' }],
    });
    if (process.env.ZLOZ_EDGE_LABEL_SCREENSHOT)
      await surface.screenshot({ path: process.env.ZLOZ_EDGE_LABEL_SCREENSHOT });
    await saved.click();
    await textbox.fill('Discard this draft');
    await textbox.press('Escape');
    await expect(saved).toBeVisible();
    await saved.click();
    await textbox.fill('Discard this too');
    await button('Discard').click();
    await expect(saved).toBeVisible();
    await saved.click();
    await textbox.fill('   ');
    await button('Apply label').click();
    await expect(add).toBeVisible();
    await section('Diagram');
    await button('Undo').click();
    await expect(saved).toBeVisible();
    await button('Undo').click();
    expect(await exportGraph()).toEqual(initial);
    await button('Redo').click();
    await expect(saved).toBeVisible();
    await section('Appearance');
    await edgeLabels.selectOption('standard');
    await expect(native).toHaveCount(0);
    await expect(saved).not.toHaveClass(/custom-edge-badge/);
    await expect(saved.locator('..')).toHaveAttribute('style', anchor);
    expect(errors).toEqual([]);
    console.log(
      engine + ': Effect UI badge preserves anchor, graph, keyboard actions, and Undo/Redo',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
