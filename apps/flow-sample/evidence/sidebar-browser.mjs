import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const browser = await chromium.launch();
const run = async () => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const errors = [],
    externalRequests = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:')) externalRequests.push(request.url());
  });
  const nav = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
  const section = async (name) => {
    await nav.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('region', { name: name + ' settings', exact: true })).toBeVisible();
  };
  const button = (name) => page.getByRole('button', { name, exact: true });
  const snapshot = async () => {
    await section('Diagram');
    await page.getByRole('checkbox', { name: 'Include camera', exact: true }).check();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export JSON').click(),
    ]);
    return JSON.parse(await readFile(await download.path(), 'utf8'));
  };
  const surface = page.locator('[data-flow-surface]');
  const scroll = page.locator('.workbench-sidebar-scroll');
  const bounds = async () => surface.boundingBox();
  const assertVisibleCanvas = async (minWidth) => {
    const box = await bounds();
    expect(box.width).toBeGreaterThan(minWidth);
    expect(box.y).toBeGreaterThanOrEqual(48);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      page.viewportSize().height,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize().width,
    );
    return box;
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open nested C4 container view').click();
  await expect(surface.locator('[data-flow-c4-node]')).toHaveCount(4);
  const nativeSurface = await surface.elementHandle();
  await page.getByRole('link', { name: 'Skip to canvas', exact: true }).focus();
  await page.getByRole('link', { name: 'Skip to canvas', exact: true }).press('Enter');
  await expect(surface).toBeFocused();
  const before = await snapshot();
  const desktop = await assertVisibleCanvas(900);
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
  expect(await bounds()).toEqual(desktop);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await scroll.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await page.screenshot({ path: fileURLToPath(new URL('./sidebar-light.png', import.meta.url)) });

  await section('Navigation');
  const overview = page
    .getByRole('complementary', { name: 'Workbench controls' })
    .getByRole('button', { name: 'Diagram overview', exact: true });
  await expect(overview).toBeVisible();
  expect(await surface.locator('[data-flow-minimap]').count()).toBe(0);
  const plane = overview.locator('svg');
  const planeBox = await plane.boundingBox();
  await plane.click({ position: { x: planeBox.width * 0.2, y: planeBox.height * 0.7 } });
  const clicked = await snapshot();
  expect(clicked.viewport).not.toEqual(before.viewport);
  expect(clicked.graph).toEqual(before.graph);
  await section('Navigation');
  await overview.focus();
  await overview.press('ArrowRight');
  const nudged = await snapshot();
  expect(nudged.viewport.x).toBeCloseTo(clicked.viewport.x - 20, 4);
  expect(nudged.graph).toEqual(before.graph);
  await section('Navigation');
  await button('Fit view').click();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await page.screenshot({ path: fileURLToPath(new URL('./sidebar-dark.png', import.meta.url)) });

  const beforeEdit = await snapshot();
  const handle = surface.locator('[data-flow-handle="orders-api"]');
  const frame = surface.locator('[data-flow-node="orders-api"]');
  await handle.click();
  const previousStyle = await frame.getAttribute('style');
  await handle.press('ArrowRight');
  await expect.poll(() => frame.getAttribute('style')).not.toBe(previousStyle);
  const edited = await snapshot();
  expect(edited.graph).not.toEqual(beforeEdit.graph);
  await button('Undo').click();
  expect((await snapshot()).graph).toEqual(beforeEdit.graph);

  await handle.click();
  await section('Inspect');
  const inspector = page.locator('[data-flow-port-inspector-demo]');
  await expect(inspector).toBeVisible();
  await inspector
    .getByRole('button', { name: 'Edit label for in port on Order API', exact: true })
    .first()
    .click();
  await inspector
    .getByRole('textbox', { name: 'Label for in port on Order API', exact: true })
    .fill('Inbound orders');
  await inspector.getByRole('button', { name: 'Save port label', exact: true }).click();
  const portEdit = await snapshot();
  expect(
    portEdit.graph.nodes
      .find((node) => node.id === 'orders-api')
      .ports.find((port) => port.id === 'in').label,
  ).toBe('Inbound orders');
  await button('Undo').click();
  expect((await snapshot()).graph).toEqual(beforeEdit.graph);

  await section('Diagnostics');
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).uncheck();
  await section('Navigation');
  await expect(page.locator('[data-flow-zoom-level]')).toHaveCount(0);
  await assertVisibleCanvas(900);
  await section('Mermaid export');
  const preview = page.getByRole('region', { name: 'Mermaid export preview', exact: true });
  const download = preview.getByRole('button', { name: 'Download Mermaid bundle', exact: true });
  await expect(download).toBeDisabled();
  await preview
    .getByRole('checkbox', {
      name: 'Allow reported conversion losses for this revision',
      exact: true,
    })
    .check();
  await expect(download).toBeEnabled();
  await expect(preview).toContainText('architecture');
  await expect(preview.getByLabel('Mermaid source', { exact: true })).toContainText('subgraph');
  const [bundleDownload] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const bundle = JSON.parse(await readFile(await bundleDownload.path(), 'utf8'));
  expect(bundle.identity.nodes.filter((node) => node.kind === 'group')).toHaveLength(2);
  expect(bundle.identity.nodes.find((node) => node.flowId === 'orders-db').parentId).toBe(
    'storage-boundary',
  );
  expect((await snapshot()).graph).toEqual(beforeEdit.graph);
  expect(
    await nativeSurface.evaluate(
      (element) => element === document.querySelector('[data-flow-surface]'),
    ),
  ).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrowExpanded = await assertVisibleCanvas(150);
  await button('Hide controls').click();
  await expect(button('Show controls')).toBeVisible();
  await expect.poll(async () => (await bounds()).width).toBeGreaterThan(narrowExpanded.width);
  await button('Fit view').click();
  const narrow = await assertVisibleCanvas(300);
  await page.screenshot({ path: fileURLToPath(new URL('./sidebar-narrow.png', import.meta.url)) });
  await button('Show controls').click();
  await expect(nav).toBeVisible();
  await section('Appearance');
  await page.getByRole('combobox', { name: 'Node design', exact: true }).focus();
  await expect(page.getByRole('combobox', { name: 'Node design', exact: true })).toBeFocused();
  await assertVisibleCanvas(150);
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  console.log(
    JSON.stringify(
      {
        chromium: browser.version(),
        desktop,
        narrowExpanded,
        narrow,
        independentSidebarScroll: true,
        persistentCanvasElement: true,
        externalMinimapPointerAndKeyboard: true,
        editUndoPreserved: true,
        portInspectorEditing: true,
        nativeSkipLink: true,
        diagnosticsAndNestedBundle: true,
        screenshots: ['sidebar-light.png', 'sidebar-dark.png', 'sidebar-narrow.png'],
        errors,
        externalRequests,
      },
      null,
      2,
    ),
  );
};
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
