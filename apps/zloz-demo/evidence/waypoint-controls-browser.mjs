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
        /\.m?js$/u.test(path)
          ? 'text/javascript'
          : path.endsWith('.css')
            ? 'text/css'
            : 'text/html',
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
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(String(error));
    console.error('PAGE ERROR', String(error));
  });
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const exportGraph = async () => {
    await section('Diagram');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export JSON').click(),
    ]);
    const graph = JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    await section('Appearance');
    return graph;
  };
  const bends = (graph) => graph.edges.find((edge) => edge.id === 'draft-review').waypoints;
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('[data-flow-node="review"]').waitFor();
  const hit = page.locator('[data-flow-edge="draft-review"]');
  const selectEdge = async () => {
    const location = await hit.evaluate((path) => {
      const point = path.getPointAtLength(path.getTotalLength() * 0.2);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(location.x, location.y);
  };
  await selectEdge();
  await button('Add bend').click();
  await expect(page.locator('[data-flow-waypoint]')).toHaveCount(1);
  const first = bends(await exportGraph());
  await section('Diagram');
  if ((await button('Snap to grid').getAttribute('aria-pressed')) !== 'true')
    await button('Snap to grid').click();
  await section('Appearance');
  await page.locator('[data-flow-waypoint]').focus();
  await page.keyboard.press('ArrowRight');
  expect(bends(await exportGraph())).not.toEqual(first);
  await section('Diagram');
  await button('Undo').click();
  expect(bends(await exportGraph())).toEqual(first);
  await selectEdge();
  const handle = page.locator('[data-flow-waypoint]');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 83, box.y + box.height / 2 + 57, { steps: 4 });
  await page.keyboard.down('Alt');
  await expect(page.getByText('Free placement', { exact: true })).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up('Alt');
  const moved = bends(await exportGraph());
  expect(moved).not.toEqual(first);
  await section('Diagram');
  await button('Undo').click();
  expect(bends(await exportGraph())).toEqual(first);
  await selectEdge();
  const box2 = await handle.boundingBox();
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width / 2 + 60, box2.y + box2.height / 2 + 40);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(bends(await exportGraph())).toEqual(first);
  await selectEdge();
  await page.getByRole('checkbox', { name: 'Protect bend editing' }).check();
  await expect(handle).toBeDisabled();
  await expect(
    page.getByText(
      'Routing is managed by the architecture team. Disable bend protection to edit.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Protect bend editing' }).uncheck();
  const anchored = async () => {
    const box = await handle.boundingBox();
    const expected = await hit.evaluate((path, position) => {
      const p = new DOMPoint(position.x, position.y).matrixTransform(path.getScreenCTM());
      return { x: p.x, y: p.y };
    }, first[0].position);
    expect(box.x + box.width / 2).toBeCloseTo(expected.x, 0);
    expect(box.y + box.height / 2).toBeCloseTo(expected.y, 0);
  };
  const contained = async (locator) => {
    const panel = await locator.boundingBox();
    const canvas = await page.locator('[data-flow-surface]').boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(canvas.x + 8);
    expect(panel.y).toBeGreaterThanOrEqual(canvas.y + 8);
    expect(panel.x + panel.width).toBeLessThanOrEqual(canvas.x + canvas.width - 8);
    expect(panel.y + panel.height).toBeLessThanOrEqual(canvas.y + canvas.height - 8);
  };
  await anchored();
  await contained(page.locator('[data-flow-waypoint-actions]'));
  await page.screenshot({
    path: fileURLToPath(new URL('waypoint-controls-native.png', import.meta.url)),
  });
  await page.getByRole('combobox', { name: 'Waypoint controls' }).selectOption('custom');
  await expect(page.locator('[data-workbench-bend-studio]')).toBeVisible();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await anchored();
  await contained(page.locator('[data-workbench-bend-studio] > div').last());
  await page.screenshot({
    path: fileURLToPath(new URL('waypoint-controls-light.png', import.meta.url)),
  });
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await page.screenshot({
    path: fileURLToPath(new URL('waypoint-controls-dark.png', import.meta.url)),
  });
  await section('Diagnostics');
  await button('Minimal mode').click();
  await expect(page.locator('[data-flow-waypoint-readout]')).toHaveCount(0);
  await expect(handle).toBeVisible();
  await anchored();
  await page.screenshot({
    path: fileURLToPath(new URL('waypoint-controls-minimal.png', import.meta.url)),
  });
  await section('Appearance');
  await page.getByRole('combobox', { name: 'Waypoint controls' }).selectOption('off');
  await expect(handle).toHaveCount(0);
  // Minimal mode deliberately hides optional diagram/export tools. Restore them for the data check.
  await section('Diagnostics');
  await button('Minimal mode').click();
  expect(bends(await exportGraph())).toEqual(first);
  await selectEdge();
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      browser: browser.version(),
      viewport: '1600x1100',
      checks:
        'keyboard, drag, Alt, cancel, protection, Undo, custom, light/dark/minimal, off preserves data',
      pageErrors: errors,
    }),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
