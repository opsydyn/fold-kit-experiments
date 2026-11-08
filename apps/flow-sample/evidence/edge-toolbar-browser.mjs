import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { chromium, expect } from '@playwright/test';
const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  await readFile('../flow-sample/dist' + path)
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
    const connection = button(description);
    const toolbar = page.getByRole('group', { name: 'Selected edge actions', exact: true });
    const style = toolbar.getByRole('combobox', { name: 'Selected edge path style' });
    const design = page.getByRole('combobox', { name: 'Edge actions', exact: true });
    const surface = page.locator('[data-flow-surface]');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByRole('combobox', { name: 'Edge design', exact: true }).selectOption('raised');
    const initial = await exportGraph();
    await connection.click();
    await expect(connection).toHaveAttribute('aria-keyshortcuts', 'ArrowUp');
    await expect(toolbar).toBeVisible();
    await connection.press('ArrowUp');
    await expect(toolbar.getByRole('button', { name: 'Rename', exact: true })).toBeFocused();
    const anchor = await toolbar.getAttribute('style');
    await design.selectOption('compact');
    await expect(toolbar.locator('.compact-edge-actions')).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Rename', exact: true })).toHaveCount(0);
    await expect(toolbar).toHaveAttribute('style', anchor);
    await connection.press('ArrowUp');
    await expect(style).toBeFocused();
    await surface.screenshot({ path: '/tmp/foldkit-flow-edge-toolbar-compact.png' });

    await button('More actions for ' + description).click();
    await expect(toolbar).toHaveCount(0);
    await expect(connection).not.toHaveAttribute('aria-controls', /edge-actions/);
    await page.keyboard.press('Escape');
    await connection.click();

    await style.selectOption('stepped');
    expect(await exportGraph()).toEqual({
      ...initial,
      edges: [{ ...initial.edges[0], pathStyle: 'stepped' }],
    });
    await toolbar.getByRole('button', { name: 'Delete edge', exact: true }).click();
    expect(await exportGraph()).toEqual({ ...initial, edges: [] });
    await button('Undo').click();
    await connection.click();
    await expect(style).toHaveValue('stepped');
    await button('Undo').click();
    expect(await exportGraph()).toEqual(initial);

    await connection.click();
    await button('Add label for ' + description).click();
    await expect(toolbar).toHaveCount(0);
    await expect(
      page.getByRole('textbox', { name: 'Edge label for ' + description }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(toolbar).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      'Default and compact focus, shared anchor, context and draft visibility, path style, delete, and Undo passed',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
