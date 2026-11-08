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
    const list = page.getByRole('group', { name: 'Connections', exact: true });
    const connection = (name) => list.getByRole('button', { name, exact: true });
    const toolbar = page.getByRole('group', { name: 'Selected edge actions', exact: true });
    const menu = page.getByRole('group', { name: 'Edge context actions', exact: true });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await expect(connection('source:out → review:in')).toBeVisible();
    await page.getByRole('combobox', { name: 'Connection list layout' }).selectOption('rows');
    await expect(list.locator('.connection-rows')).toBeVisible();
    const row = connection('Draft → Review');
    await row.press('Enter');
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(row).toHaveAttribute('aria-keyshortcuts', 'ArrowUp');
    await row.press('ArrowUp');
    await expect(toolbar.getByRole('button', { name: 'Rename', exact: true })).toBeFocused();
    await row.press('Shift+F10');
    await expect(menu.getByRole('button', { name: 'Delete edge', exact: true })).toBeFocused();
    await expect(row).not.toHaveAttribute('aria-controls', /edge-actions/);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    const more = connection('More actions for Draft → Review');
    await more.click();
    await expect(menu).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await menu.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(await exportGraph()).toEqual(initial);

    await button('Minimal mode').click();
    const disclosure = button('Connections');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toHaveCount(0);
    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-controls', 'flow-demo-connections');
    await expect(list).toHaveAttribute('data-flow-connections', 'compact');
    await expect(row).toBeVisible();
    await disclosure.click();
    await expect(list).toHaveCount(0);
    await button('Minimal mode').click();

    await button('Open grouped Onion Architecture').click();
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await connection('UI uses application use cases').click();
    await expect(connection('UI uses application use cases')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await list
      .locator('.connection-rows')
      .screenshot({ path: '/tmp/foldkit-zloz-connection-rows.png' });
    await button('Collapse Application core').click();
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(connection('Application uses the domain model')).toHaveCount(0);
    await expect(connection('UI uses application use cases')).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      'Custom rows preserved selection, toolbar focus, context actions, compact disclosure, and collapsed-group filtering',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
