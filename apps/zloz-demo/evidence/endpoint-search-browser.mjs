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
async function qualify() {
  const browser = await { chromium, firefox, webkit }[engine].launch();
  await (async () => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto('http://127.0.0.1:' + server.address().port);
    const sections = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
    const section = (name) => sections.getByRole('button', { name, exact: true }).click();
    const button = (name) => page.getByRole('button', { name, exact: true });
    const graph = async () => {
      await section('Diagram');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const baseline = await graph();
    await section('Ports');
    const panel = page
      .locator('[data-architecture-effect-ui="connection-creation"]')
      .getByRole('group', { name: 'Create a connection', exact: true });
    const source = panel.getByRole('combobox', { name: 'New connection source', exact: true });
    const target = panel.getByRole('combobox', { name: 'New connection target', exact: true });
    const sourceSearch = panel.getByRole('searchbox', { name: 'Search new connection sources' });
    const targetSearch = panel.getByRole('searchbox', { name: 'Search new connection targets' });
    const value = (node, port) => JSON.stringify([node, port]);
    await expect(sourceSearch).toBeVisible();
    await sourceSearch.pressSequentially('REVIEW out');
    await expect(sourceSearch).toHaveValue('REVIEW out');
    await expect(sourceSearch).toBeFocused();
    await expect(source.locator('optgroup')).toHaveCount(1);
    await expect(source.locator('optgroup')).toHaveAttribute('label', 'Review');
    await source.selectOption(value('review', 'out'));
    await expect(source).toHaveValue(value('review', 'out'));
    await targetSearch.fill('nothing-matches');
    await expect(targetSearch).toHaveAccessibleDescription('No ports match this search.');
    await targetSearch.press('Escape');
    await expect(targetSearch).toHaveValue('');
    await expect(targetSearch).toBeFocused();
    await expect(source).toHaveValue(value('review', 'out'));
    await source.press('Escape');
    await expect(source).toBeFocused();
    await expect(source).toHaveValue('');
    await section('Diagram');
    await section('Ports');
    await expect(sourceSearch).toHaveValue('REVIEW out');
    await source.selectOption(value('review', 'out'));
    const lockPublish = page.getByRole('checkbox', { name: 'Lock Publish input', exact: true });
    await lockPublish.check();
    await expect(source).toHaveValue('');
    await source.selectOption(value('review', 'out'));
    await targetSearch.fill('publish');
    await expect(target.locator('option', { hasText: 'Publish: in' })).toBeDisabled();
    await expect(target).toHaveAccessibleDescription(/Publish input is closed/);
    await sourceSearch.fill('nothing-matches');
    await expect(sourceSearch).toHaveAccessibleDescription(
      'No ports match this search. Current selection is retained.',
    );
    await expect(source).toHaveValue(value('review', 'out'));
    const clear = button('Clear search new connection sources');
    await clear.press('Enter');
    await expect(clear).toBeFocused();
    await expect(sourceSearch).toHaveValue('');
    await lockPublish.uncheck();
    await expect(source).toHaveValue('');
    await source.selectOption(value('review', 'out'));
    await expect(target.locator('option', { hasText: 'Publish: in' })).toBeEnabled();
    await target.focus();
    await target.selectOption(value('publish', 'in'));
    await expect(target).toHaveValue('');
    await expect(target).toBeFocused();
    const created = await graph();
    expect(created.edges).toHaveLength(baseline.edges.length + 1);
    expect(created.edges).toContainEqual(
      expect.objectContaining({
        source: { node: 'review', port: 'out' },
        target: { node: 'publish', port: 'in' },
      }),
    );
    await button('Undo').click();
    expect(await graph()).toEqual(baseline);

    await section('Inspect');
    await button('source:out → review:in').press('Enter');
    const inspector = page.locator('[data-architecture-effect-ui="connection-endpoints"]');
    const reconnect = inspector.getByRole('combobox', { name: 'Target port', exact: true });
    const reconnectSearch = inspector.getByRole('searchbox', {
      name: 'Search reconnection targets',
    });
    await reconnectSearch.fill('nothing-matches');
    await expect(reconnect.locator('optgroup')).toHaveCount(1);
    await expect(reconnect).toHaveValue(value('review', 'in'));
    await section('Ports');
    const lock = page.getByRole('combobox', { name: 'Draft to Review reconnection', exact: true });
    await lock.selectOption('target');
    await section('Inspect');
    await expect(reconnect).toBeDisabled();
    await expect(reconnect).toHaveAccessibleDescription(/Target reconnection is locked/);
    await expect(reconnectSearch).toHaveValue('nothing-matches');
    await reconnectSearch.press('Escape');
    await expect(reconnectSearch).toBeFocused();
    await expect(reconnectSearch).toHaveValue('');
    await section('Ports');
    await lock.selectOption('none');
    await section('Inspect');
    await expect(reconnect).toBeEnabled();
    await reconnectSearch.fill('publish');
    await expect(reconnect.locator('optgroup')).toHaveCount(2);
    await reconnect.focus();
    await reconnect.selectOption(value('publish', 'in'));
    await expect(reconnect).toHaveValue(value('publish', 'in'));
    await expect(reconnect).toBeFocused();
    const screenshot = process.env.ZLOZ_ENDPOINT_SCREENSHOT;
    if (screenshot) await inspector.screenshot({ path: screenshot });
    const moved = await graph();
    expect(moved.edges).toHaveLength(baseline.edges.length);
    expect(moved.edges).toContainEqual(
      expect.objectContaining({
        source: { node: 'source', port: 'out' },
        target: { node: 'publish', port: 'in' },
      }),
    );
    await button('Undo').click();
    expect(await graph()).toEqual(baseline);
    await section('Diagnostics');
    await button('Minimal mode').click();
    await section('Ports');
    await sourceSearch.fill('nothing-matches');
    await expect(sourceSearch).toHaveAccessibleDescription('No ports match this search.');
    expect(errors).toEqual([]);
    console.log(
      engine +
        ': native endpoint search, live protection, focus, creation, reconnection and exact Undo passed',
    );
  })().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
