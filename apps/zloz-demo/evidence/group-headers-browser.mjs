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
    viewport: { width: 1600, height: 1300 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const errors = [],
    requests = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => requests.push(request.url()));
  const base = `http://127.0.0.1:${server.address().port}`;
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const model = async () => {
    await section('History');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export model with lineage', exact: true }).click(),
    ]);
    return JSON.parse(await readFile(await file.path(), 'utf8'));
  };
  await page.goto(base);
  await page.locator('[data-flow-node="review"]').waitFor();
  const original = await model();
  await section('Domain review');
  const panel = page.locator('#workbench-alchemy');
  await panel.getByRole('button', { name: 'Review bank example', exact: true }).click();
  const positions = () =>
    page
      .locator('.alchemy-canvas [data-flow-node]')
      .evaluateAll((nodes) =>
        nodes.map((n) => [
          n.getAttribute('data-flow-node'),
          n.getAttribute('data-flow-x'),
          n.getAttribute('data-flow-y'),
        ]),
      );
  await expect(page.locator('.alchemy-canvas [data-flow-node]')).toHaveCount(7);
  const before = await positions();
  await expect(page.locator('.alchemy-canvas [data-zloz-group-header]')).toHaveCount(0);
  const select = panel.getByRole('combobox', { name: 'Group heading', exact: true });
  await select.selectOption('expanded');
  expect(await positions()).toEqual(before);
  await expect(page.locator('.alchemy-canvas [data-zloz-group-header]')).toHaveCount(1);
  await expect(page.locator('[data-alchemy-group-heading]')).toContainText(
    'Source identity retained',
  );
  const arrange = () =>
    panel.getByRole('button', { name: 'Arrange preview with ELK', exact: true });
  const mode = panel.getByLabel('Preview layout mode', { exact: true });
  await arrange().focus();
  await arrange().press('Enter');
  await expect(mode).toHaveText('ELK preview geometry', { timeout: 30000 });
  await expect(arrange()).toBeFocused();
  expect(await positions()).not.toEqual(before);
  const geometry = () =>
    page.locator('.alchemy-canvas [data-flow-surface]').evaluate((surface) => {
      const rect = (element) => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const world = [...surface.children].find(
        (element) => getComputedStyle(element).transform !== 'none',
      );
      const zoom = new DOMMatrix(getComputedStyle(world).transform).a;
      return {
        zoom,
        group: rect(surface.querySelector('[data-flow-group]')),
        header: rect(surface.querySelector('[data-zloz-group-header]')),
        body: rect(surface.querySelector('[data-alchemy-group-heading]')),
        nodes: [...surface.querySelectorAll('[data-flow-node]')].map(rect),
      };
    });
  const check = async () => {
    const g = await geometry();
    expect(g.zoom).toBeGreaterThan(0);
    expect(g.header.width / g.zoom).toBeCloseTo(640, 1);
    expect(g.header.height / g.zoom).toBeCloseTo(112, 1);
    expect((g.header.x - g.group.x) / g.zoom).toBeCloseTo(24, 1);
    expect((g.header.y - g.group.y) / g.zoom).toBeCloseTo(24, 1);
    expect(g.body.width / g.zoom).toBeCloseTo(640, 1);
    expect(g.body.height / g.zoom).toBeCloseTo(112, 1);
    for (const node of g.nodes)
      expect((node.y - g.header.y - g.header.height) / g.zoom).toBeGreaterThanOrEqual(23.9);
    expect(g.group.width / g.zoom).toBeGreaterThanOrEqual(687.9);
  };
  await check();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await page.getByRole('button', { name: 'Fit descriptor diagram', exact: true }).click();
  await panel
    .getByRole('region', { name: 'Descriptor preview layout', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('group-headers-light.png', import.meta.url)),
  });
  await panel.getByRole('combobox', { name: 'Layout direction', exact: true }).selectOption('DOWN');
  await arrange().click();
  await expect(arrange()).toBeVisible({ timeout: 30000 });
  await expect(mode).toHaveText('ELK preview geometry', { timeout: 30000 });
  await check();
  // Exercise measured edge envelopes together with declared group headings.
  await panel.getByRole('combobox', { name: 'Label sizing', exact: true }).selectOption('measured');
  await panel.getByRole('button', { name: 'Measure label bounds', exact: true }).click();
  await expect(panel.getByLabel('Label measurement status', { exact: true })).toContainText(
    'Measured 8 rendered labels',
  );
  await arrange().click();
  await expect(panel.getByLabel('Label measurement status', { exact: true })).toContainText(
    'Measure again before arranging',
  );
  await check();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await section('Diagnostics');
  await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
  await section('Domain review');
  await panel
    .getByRole('region', { name: 'Descriptor preview layout', exact: true })
    .scrollIntoViewIfNeeded();
  await check();
  await page.screenshot({
    path: fileURLToPath(new URL('group-headers-dark.png', import.meta.url)),
  });
  const header = page.locator('.alchemy-canvas [data-zloz-group-header]');
  const box = await header.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 10);
  await page.mouse.wheel(0, -400);
  await expect
    .poll(async () => (await header.boundingBox()).width)
    .toBeGreaterThan(box.width * 1.5);
  await check();
  const zoomed = await header.boundingBox();
  const canvas = await page.locator('.alchemy-canvas [data-flow-surface]').boundingBox();
  expect(zoomed.x).toBeGreaterThan(canvas.x);
  expect(zoomed.y).toBeGreaterThan(canvas.y);
  expect(zoomed.x + zoomed.width).toBeLessThan(canvas.x + canvas.width);
  expect(zoomed.y + zoomed.height).toBeLessThan(canvas.y + canvas.height);
  await page.screenshot({
    path: fileURLToPath(new URL('group-headers-detail.png', import.meta.url)),
  });
  await panel.getByRole('button', { name: 'Restore original preview', exact: true }).click();
  await expect.poll(positions).toEqual(before);
  await select.selectOption('default');
  await expect(page.locator('.alchemy-canvas [data-zloz-group-header]')).toHaveCount(0);
  await expect(panel.getByRole('list', { name: 'Descriptor findings' }).locator('li')).toHaveCount(
    9,
  );
  await page
    .locator('.alchemy-canvas')
    .getByRole('button', { name: 'Return to working model', exact: true })
    .click();
  expect(await model()).toEqual(original);
  expect(errors).toEqual([]);
  expect(requests.filter((url) => !url.startsWith(base) && !url.startsWith('data:'))).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'default group headings unchanged until opt-in',
          'profile selection never arranges automatically',
          'keyboard Arrange retains focus',
          'actual 640x112 heading at 24-unit top/left inset; children retain a 24-unit gap',
          'RIGHT and DOWN reserve space with real ELK',
          'declared group headers compose with measured edge labels',
          'light/dark and Minimal mode preserve heading geometry',
          'native zoom preserves world bounds',
          'original geometry, nine findings and working model/lineage preserved',
          'no page errors or external requests',
        ],
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
