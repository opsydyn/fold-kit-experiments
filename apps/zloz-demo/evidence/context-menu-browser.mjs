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
    const surface = page.locator('[data-flow-surface]');
    const nodeMenu = page.getByRole('group', { name: 'Node context actions', exact: true });
    const edgeMenu = page.getByRole('group', { name: 'Edge context actions', exact: true });
    const design = page.getByRole('combobox', { name: 'Context menus', exact: true });
    const description = 'source:out → review:in';
    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await button('Select Draft').press('Shift+F10');
    await expect(nodeMenu.getByRole('button', { name: 'Duplicate node' })).toBeFocused();
    await expect(nodeMenu.getByRole('button', { name: 'Delete node' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(nodeMenu).toHaveCount(0);
    await expect(surface).toBeFocused();

    await design.selectOption('panel');
    await button('Select Draft').click({ button: 'right' });
    await expect(nodeMenu.locator('.custom-context-menu')).toBeVisible();
    await expect(nodeMenu.getByRole('button', { name: 'Duplicate node' })).toBeFocused();
    await expect(nodeMenu.getByRole('button', { name: 'Delete node' })).toHaveCount(0);
    await surface.screenshot({ path: '/tmp/foldkit-zloz-context-node.png' });
    await nodeMenu.getByRole('button', { name: 'Duplicate node' }).click();
    expect((await exportGraph()).nodes).toHaveLength(initial.nodes.length + 1);
    await button('Undo').click();
    expect(await exportGraph()).toEqual(initial);

    await button(description).press('Shift+F10');
    await expect(edgeMenu.getByRole('button', { name: 'Rename' })).toBeFocused();
    await surface.screenshot({ path: '/tmp/foldkit-zloz-context-edge.png' });
    await edgeMenu.getByRole('button', { name: 'Rename' }).click();
    await expect(edgeMenu).toHaveCount(0);
    const label = page.getByRole('textbox', { name: 'Edge label for ' + description });
    await expect(label).toBeFocused();
    await label.press('Escape');
    await button('More actions for ' + description).click();
    await expect(edgeMenu).toBeVisible();
    await surface.click({ position: { x: 1100, y: 300 } });
    await expect(edgeMenu).toHaveCount(0);

    await button('Open grouped Onion Architecture').click();
    const grouped = await exportGraph();
    await button('More actions for Application core').click();
    const width = nodeMenu.getByRole('spinbutton', { name: 'Width of Application core' });
    await expect(width).toBeFocused();
    await surface.screenshot({ path: '/tmp/foldkit-zloz-context-group.png' });
    const oldWidth = grouped.nodes.find((node) => node.id === 'core').size.width;
    await width.fill(String(oldWidth + 40));
    await width.press('Tab');
    await expect(nodeMenu).toBeVisible();
    await expect(width).toHaveValue(String(oldWidth + 40));
    await nodeMenu.getByRole('button', { name: 'Close' }).click();
    await expect(nodeMenu).toHaveCount(0);
    expect((await exportGraph()).nodes.find((node) => node.id === 'core').size.width).toBe(
      oldWidth + 40,
    );
    await button('Undo').click();
    expect(await exportGraph()).toEqual(grouped);

    await button('More actions for Application core').click();
    await expect(width).toBeFocused();
    await button('Zoom in').focus();
    await expect(nodeMenu).toHaveCount(0);
    await button('Collapse Application core').click();
    await button('More actions for Application core').click();
    await expect(width).toBeDisabled();
    await expect(nodeMenu.getByRole('button', { name: 'Fit group to contents' })).toBeFocused();
    expect(errors).toEqual([]);
    console.log(
      'Default and custom entry, Escape, outside click, focusout, node duplicate, edge rename, group sizing, and Undo passed',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
