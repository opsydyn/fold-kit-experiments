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
    const initial = await graph();
    await section('Appearance');
    await page.getByRole('combobox', { name: 'Edge design', exact: true }).selectOption('raised');
    await section('Inspect');
    const connection = button('source:out → review:in');
    await connection.press('Enter');
    const toolbar = page.getByRole('group', { name: 'Selected edge actions', exact: true });
    const controls = toolbar.locator('[data-architecture-effect-ui="edge-toolbar"]');
    await expect(controls).toBeVisible();
    const source = controls.getByRole('combobox', { name: 'Source port', exact: true });
    const target = controls.getByRole('combobox', { name: 'Target port', exact: true });
    const style = controls.getByRole('combobox', { name: 'Selected edge path style', exact: true });
    const rename = controls.getByRole('button', { name: 'Rename', exact: true });
    const value = (node, port) => JSON.stringify([node, port]);
    await expect(connection).toHaveAttribute('aria-keyshortcuts', 'ArrowUp');
    await connection.press('ArrowUp');
    await expect(rename).toBeFocused();
    const anchor = await toolbar.getAttribute('style');
    await section('Appearance');
    const design = page.getByRole('combobox', { name: 'Edge actions', exact: true });
    await design.selectOption('compact');
    await expect(controls.locator('.compact-edge-actions')).toBeVisible();
    await expect(rename).toHaveCount(0);
    await expect(toolbar).toHaveAttribute('style', anchor);
    await section('Inspect');
    await connection.press('ArrowUp');
    await expect(style).toBeFocused();

    await section('Ports');
    const lock = page.getByRole('combobox', { name: 'Draft to Review reconnection', exact: true });
    await lock.selectOption('source');
    await expect(source).toBeDisabled();
    await expect(source).toHaveAccessibleDescription(/Source reconnection is locked/);
    const publish = page.getByRole('checkbox', { name: 'Lock Publish input', exact: true });
    await publish.check();
    await expect(target.locator('option', { hasText: 'Publish: in' })).toBeDisabled();
    await expect(target).toHaveAccessibleDescription(/Publish input is closed/);
    await publish.uncheck();
    await lock.selectOption('none');
    await expect(source).toBeEnabled();
    await expect(target.locator('option', { hasText: 'Publish: in' })).toBeEnabled();
    await target.focus();
    await target.selectOption(value('publish', 'in'));
    await expect(target).toBeFocused();
    const moved = await graph();
    expect(moved.edges).toEqual([{ ...initial.edges[0], target: { node: 'publish', port: 'in' } }]);
    await button('Undo').click();
    expect(await graph()).toEqual(initial);

    await section('Inspect');
    await connection.press('Enter');
    const surface = page.locator('[data-flow-surface]');
    const handles = surface.locator('[data-flow-reconnect]');
    await expect(handles).toHaveCount(2);
    const targetHandle = handles.filter({ visible: true }).last();
    const box = await targetHandle.boundingBox();
    const targetPort = surface.getByRole('button', { name: 'Connect to Publish: in', exact: true });
    const portBox = await targetPort.boundingBox();
    const overHandle = await targetHandle.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === element;
    });
    expect(overHandle).toBe(true);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(portBox.x + portBox.width / 2, portBox.y + portBox.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    expect((await graph()).edges).toEqual(moved.edges);
    await button('Undo').click();
    await section('Inspect');
    await connection.press('Enter');
    await style.selectOption('stepped');
    expect((await graph()).edges).toEqual([{ ...initial.edges[0], pathStyle: 'stepped' }]);
    await button('Undo').click();
    await section('Inspect');
    await connection.press('Enter');
    await section('Diagram');
    const protection = button('Protect required items');
    const remove = controls.getByRole('button', { name: 'Delete edge', exact: true });
    await protection.click();
    await expect(remove).toBeDisabled();
    await expect(controls.getByText('This connection is required.', { exact: true })).toBeVisible();
    await protection.click();
    await remove.click();
    expect((await graph()).edges).toEqual([]);
    await button('Undo').click();
    expect(await graph()).toEqual(initial);
    await section('Inspect');
    await connection.press('Enter');
    await button('More actions for source:out → review:in').click();
    await expect(toolbar).toHaveCount(0);
    await expect(connection).not.toHaveAttribute('aria-controls', /edge-actions/);
    await page.keyboard.press('Escape');
    await expect(toolbar).toBeVisible();
    await button('Add label for source:out → review:in').click();
    await expect(toolbar).toHaveCount(0);
    await page
      .getByRole('textbox', { name: 'Edge label for source:out → review:in' })
      .press('Escape');
    await expect(toolbar).toBeVisible();
    await section('Diagnostics');
    await button('Minimal mode').click();
    await expect(target).toBeVisible();
    const screenshot = process.env.ZLOZ_TOOLBAR_SCREENSHOT;
    if (screenshot) await surface.screenshot({ path: screenshot });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(async () => {
        const canvas = await surface.boundingBox();
        const frame = await toolbar.boundingBox();
        return Math.min(
          frame.x - canvas.x,
          frame.y - canvas.y,
          canvas.x + canvas.width - frame.x - frame.width,
          canvas.y + canvas.height - frame.y - frame.height,
        );
      })
      .toBeGreaterThanOrEqual(0);
    await expect(target).toBeEnabled();
    expect(errors).toEqual([]);
    console.log(
      engine +
        ': native toolbar modes, keyboard handoff, live policy, drag clearance, context and draft visibility, and Undo passed',
    );
  })().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
