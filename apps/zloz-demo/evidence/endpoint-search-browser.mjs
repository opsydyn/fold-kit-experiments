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

async function qualify() {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const panel = page.getByRole('group', { name: 'Create a connection', exact: true });
    const source = panel.getByRole('combobox', { name: 'New connection source', exact: true });
    const target = panel.getByRole('combobox', { name: 'New connection target', exact: true });
    const sourceSearch = page.getByRole('searchbox', {
      name: 'Search new connection sources',
      exact: true,
    });
    const targetSearch = page.getByRole('searchbox', {
      name: 'Search new connection targets',
      exact: true,
    });
    const clearSource = button('Clear search new connection sources');
    const value = (node, port) => JSON.stringify([node, port]);
    const original = () => button('source:out → review:in');
    const created = () => button('review:out → publish:in');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await sourceSearch.fill('REVIEW out');
    await expect(sourceSearch).toBeFocused();
    await expect(source.locator('optgroup')).toHaveCount(1);
    await expect(source.locator('optgroup')).toHaveAttribute('label', 'Review');
    await expect(source).toHaveValue('');
    await source.focus();
    await source.press('r');
    await expect(panel.getByRole('button', { name: 'Cancel choice', exact: true })).toBeEnabled();
    await expect(source).toHaveValue(value('review', 'out'));
    await targetSearch.fill('nothing-matches');
    await expect(target.locator('option')).toHaveCount(1);
    await expect(targetSearch).toHaveAccessibleDescription('No ports match this search.');
    await targetSearch.press('Escape');
    await expect(targetSearch).toHaveValue('');
    await expect(targetSearch).toBeFocused();
    await expect(source).toHaveValue(value('review', 'out'));
    await button('Undo').press('Enter');
    await expect(source).toHaveValue(value('review', 'out'));
    await expect(original()).toBeVisible();

    await page.getByRole('checkbox', { name: 'Lock Publish input', exact: true }).check();
    await expect(source).toHaveValue('');
    await source.focus();
    await source.press('r');
    await expect(panel.getByRole('button', { name: 'Cancel choice', exact: true })).toBeEnabled();
    await targetSearch.fill('publish');
    await expect(target.locator('optgroup')).toHaveCount(1);
    await expect(target.locator('option', { hasText: 'Publish: in' })).toBeDisabled();
    await expect(target).toHaveAccessibleDescription(/Publish input is closed/);
    await sourceSearch.fill('nothing-matches');
    await expect(sourceSearch).toHaveAccessibleDescription(
      'No ports match this search. Current selection is retained.',
    );
    await expect(source.locator('optgroup')).toHaveCount(1);
    await expect(source).toHaveValue(value('review', 'out'));
    await panel.screenshot({ path: '../zloz-demo/evidence/endpoint-search-creation.png' });
    await clearSource.press('Enter');
    await expect(sourceSearch).toHaveValue('');
    await expect(clearSource).toBeFocused();
    await expect(source).toHaveValue(value('review', 'out'));
    await page.getByRole('checkbox', { name: 'Lock Publish input', exact: true }).uncheck();
    await expect(source).toHaveValue('');
    await source.focus();
    await source.press('r');
    await expect(target.locator('option', { hasText: 'Publish: in' })).toBeEnabled();
    await target.focus();
    await target.press('p');
    await expect(created()).toBeVisible();
    await expect(target).toHaveValue('');
    await expect(target).toBeFocused();
    await button('Undo').press('Enter');
    await expect(created()).toHaveCount(0);
    await button('Redo').press('Enter');
    await expect(created()).toBeVisible();
    await button('Undo').press('Enter');
    await expect(created()).toHaveCount(0);

    await original().press('Enter');
    const inspector = page.getByRole('group', { name: 'Selected connection', exact: true });
    const reconnect = inspector.getByRole('combobox', { name: 'Target port', exact: true });
    const reconnectSearch = page.getByRole('searchbox', {
      name: 'Search reconnection targets',
      exact: true,
    });
    await reconnectSearch.fill('publish');
    await expect(reconnect.locator('optgroup')).toHaveCount(2);
    await expect(reconnect).toHaveValue(value('review', 'in'));
    await reconnectSearch.fill('nothing-matches');
    await expect(reconnect.locator('optgroup')).toHaveCount(1);
    await expect(reconnect).toHaveValue(value('review', 'in'));
    const lock = page.getByRole('combobox', { name: 'Draft to Review reconnection', exact: true });
    await lock.selectOption('target');
    await expect(reconnect).toBeDisabled();
    await expect(reconnect).toHaveAccessibleDescription(/Target reconnection is locked/);
    await inspector.screenshot({
      path: '../zloz-demo/evidence/endpoint-search-reconnection.png',
    });
    await reconnectSearch.focus();
    await reconnectSearch.press('Escape');
    await expect(reconnectSearch).toHaveValue('');
    await expect(reconnectSearch).toBeFocused();
    await expect(reconnect).toBeDisabled();
    await lock.selectOption('none');
    await expect(reconnect).toBeEnabled();
    await reconnectSearch.fill('publish');
    await expect(reconnect.locator('optgroup')).toHaveCount(2);
    await reconnect.focus();
    await reconnect.press('p');
    await expect(button('source:out → publish:in')).toHaveAttribute('aria-pressed', 'true');
    await expect(reconnect).toHaveValue(value('publish', 'in'));
    await expect(reconnect).toBeFocused();
    await button('Undo').press('Enter');
    await expect(original()).toBeVisible();
    await original().press('Enter');
    await expect(reconnectSearch).toHaveValue('publish');
    await expect(reconnect).toHaveValue(value('review', 'in'));
    await button('Clear search reconnection targets').press('Enter');
    await expect(reconnectSearch).toHaveValue('');
    await expect(button('Clear search reconnection targets')).toBeFocused();
    await button('Minimal mode').press('Enter');
    await sourceSearch.fill('nothing-matches');
    await expect(panel).toBeVisible();
    await expect(sourceSearch).toHaveAccessibleDescription('No ports match this search.');
    await clearSource.press('Enter');
    await expect(sourceSearch).toHaveValue('');
    await expect(clearSource).toBeFocused();
    expect(errors).toEqual([]);
    console.log(
      'Search/grouping, retained selections, protected choices, query-only Escape/Clear, keyboard commits, focus, Undo/Redo and minimal mode passed.',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
