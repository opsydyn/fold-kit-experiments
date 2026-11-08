import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { chromium, expect } from '@playwright/test';
const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  await readFile('../zloz-demo/dist' + path)
    .then((body) => {
      res.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
      );
      res.end(body);
    })
    .catch(() => res.writeHead(404).end());
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const qualify = async () => {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const description = 'source:out → review:in';
    const edgeLabels = page.getByRole('combobox', { name: 'Edge labels', exact: true });
    const textbox = page.getByRole('textbox', {
      name: 'Edge label for ' + description,
      exact: true,
    });
    const edit = (label) => button('Edit edge label ' + label + ' for ' + description);
    const surface = page.locator('[data-flow-surface]');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByRole('combobox', { name: 'Edge design', exact: true }).selectOption('raised');
    await edgeLabels.selectOption('badge');
    const initial = await exportGraph();
    await button(description).click();
    const add = button('Add label for ' + description);
    await expect(add).toHaveClass('custom-edge-badge');
    const anchor = await add.locator('..').getAttribute('style');
    await add.press('Enter');
    await expect(textbox).toBeFocused();
    await expect(textbox.locator('..')).toHaveClass('custom-edge-editor');
    await textbox.fill('  Release approval  ');
    await expect(textbox.locator('../..')).toHaveAttribute(
      'style',
      anchor.replace('z-index: auto', 'z-index: 2'),
    );
    await surface.screenshot({ path: '/tmp/foldkit-zloz-custom-edge-editor.png' });
    await textbox.press('Enter');
    const saved = edit('Release approval');
    await expect(saved).toHaveClass('custom-edge-badge');
    await expect(saved.locator('..')).toHaveAttribute('style', anchor);
    expect(await exportGraph()).toEqual({
      ...initial,
      edges: [{ ...initial.edges[0], label: 'Release approval' }],
    });
    await surface.screenshot({ path: '/tmp/foldkit-zloz-custom-edge-badge.png' });
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
    await button('Undo').click();
    await expect(saved).toBeVisible();
    await button('Undo').click();
    expect(await exportGraph()).toEqual(initial);
    await button('Redo').click();
    await expect(saved).toBeVisible();
    await edgeLabels.selectOption('standard');
    await expect(saved).not.toHaveClass('custom-edge-badge');
    await expect(saved.locator('..')).toHaveAttribute('style', anchor);
    expect(errors).toEqual([]);
    console.log(
      'Custom badge and inline editor preserved anchor, graph, keyboard actions, and Undo/Redo',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
