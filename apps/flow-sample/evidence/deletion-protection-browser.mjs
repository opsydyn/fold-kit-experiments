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
    const page = await browser.newPage({ viewport: { width: 1280, height: 2000 } });
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
    const status = page.locator('[data-flow-status]');
    const toolbar = page.getByRole('group', { name: 'Selected edge actions', exact: true });
    const edgeMenu = page.getByRole('group', { name: 'Edge context actions', exact: true });
    const nodeMenu = page.getByRole('group', { name: 'Node context actions', exact: true });
    const connection = 'source:out → review:in';
    const linkReason = 'This connection is required.';
    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await button('Protect required items').click();
    await button(connection).click();
    await expect(toolbar.getByRole('button', { name: 'Delete edge', exact: true })).toBeDisabled();
    await expect(toolbar).toContainText(linkReason);
    await surface.screenshot({ path: '/tmp/foldkit-flow-protected-edge.png' });
    await surface.press('Delete');
    await expect(status).toHaveText(linkReason);
    expect(await exportGraph()).toEqual(initial);

    await button('More actions for ' + connection).click();
    await expect(edgeMenu.getByRole('button', { name: 'Delete edge', exact: true })).toBeDisabled();
    await expect(edgeMenu).toContainText(linkReason);
    await edgeMenu.getByRole('button', { name: 'Close', exact: true }).click();
    await button('More actions for Draft').click();
    await expect(nodeMenu.getByRole('button', { name: 'Delete node', exact: true })).toBeDisabled();
    await expect(nodeMenu).toContainText(linkReason);
    await nodeMenu.getByRole('button', { name: 'Close', exact: true }).click();
    await surface.press('Delete');
    await expect(status).toHaveText(linkReason);
    expect(await exportGraph()).toEqual(initial);

    await button('More actions for Publish').click();
    await nodeMenu.getByRole('button', { name: 'Delete node', exact: true }).click();
    expect((await exportGraph()).nodes.map((node) => node.id)).toEqual(['source', 'review']);
    await button('Undo').click();
    expect(await exportGraph()).toEqual(initial);

    await button('Open grouped Onion Architecture').click();
    const grouped = await exportGraph();
    await button('Collapse Application core').click();
    await button('More actions for Application core').click();
    await expect(nodeMenu.getByRole('button', { name: 'Delete node', exact: true })).toBeDisabled();
    await expect(nodeMenu).toContainText('Domain model is required.');
    await surface.screenshot({ path: '/tmp/foldkit-flow-protected-group.png' });
    await nodeMenu.getByRole('button', { name: 'Close', exact: true }).click();
    await surface.press('Delete');
    await expect(status).toHaveText('Domain model is required.');
    expect(await exportGraph()).toEqual(grouped);
    expect(errors).toEqual([]);
    console.log(
      'Keyboard, toolbar, and context deletion agree, including protected incident edges and collapsed descendants. Allowed deletion restores with one Undo.',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
