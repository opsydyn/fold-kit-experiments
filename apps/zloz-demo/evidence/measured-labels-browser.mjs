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
  const section = async (name) =>
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
  await expect(page.locator('.alchemy-canvas [data-alchemy-relation-badge]')).toHaveCount(8);
  await expect(
    panel.getByRole('button', { name: 'Measure label bounds', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await panel.getByRole('combobox', { name: 'Label sizing', exact: true }).selectOption('measured');
  const measure = () => panel.getByRole('button', { name: 'Measure label bounds', exact: true });
  const arrange = () =>
    panel.getByRole('button', { name: 'Arrange preview with ELK', exact: true });
  const status = panel.getByLabel('Label measurement status', { exact: true });
  await expect(arrange()).toBeDisabled();
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
  const before = await positions();
  // Delay only the browser font boundary, never the application Model or DOM content.
  const holdFonts = () =>
    page.evaluate(() => {
      const prior = document.fonts.ready;
      let release;
      const hold = new Promise((resolve) => {
        release = resolve;
      });
      window.releaseMeasurementFonts = () => {
        release();
        delete document.fonts.ready;
      };
      Object.defineProperty(document.fonts, 'ready', {
        configurable: true,
        value: prior.then(() => hold),
      });
    });
  const releaseFonts = () => page.evaluate(() => window.releaseMeasurementFonts());
  await holdFonts();
  await measure().click();
  const cancel = () => panel.getByRole('button', { name: 'Cancel label measurement', exact: true });
  await expect(cancel()).toBeVisible();
  await cancel().click();
  await releaseFonts();
  await expect(status).toContainText('Measure rendered labels first');
  expect(await positions()).toEqual(before);
  await holdFonts();
  await measure().click();
  await expect(cancel()).toBeVisible();
  await panel.getByRole('combobox', { name: 'Badge detail', exact: true }).selectOption('expanded');
  await releaseFonts();
  await expect(arrange()).toBeDisabled();
  await expect(status).toContainText('Measure rendered labels first');
  await measure().focus();
  await measure().press('Enter');
  await expect(status).toHaveText('Measured 8 rendered labels. Arrange to apply.');
  await expect(measure()).toBeFocused();
  expect(await positions()).toEqual(before);
  await expect(panel.getByLabel('Preview layout mode', { exact: true })).toHaveText(
    'Original descriptor geometry',
  );
  const boxes = () =>
    page.locator('.alchemy-canvas').evaluate((canvas) => {
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      return {
        labels: [...canvas.querySelectorAll('[data-alchemy-relation-badge]')].map(rect),
        nodes: [...canvas.querySelectorAll('[data-flow-node]')].map(rect),
      };
    });
  const widths = (await boxes()).labels.map((b) => Math.round(b.width));
  expect(new Set(widths).size).toBeGreaterThan(2);
  await arrange().focus();
  await arrange().press('Enter');
  await expect(panel.getByLabel('Preview layout mode', { exact: true })).toHaveText(
    'ELK preview geometry',
    { timeout: 30000 },
  );
  await expect(arrange()).toBeFocused();
  expect(await positions()).not.toEqual(before);
  const actual = await boxes();
  for (const label of actual.labels)
    for (const node of actual.nodes) {
      expect(
        Math.min(label.x + label.width, node.x + node.width) - Math.max(label.x, node.x) > 1 &&
          Math.min(label.y + label.height, node.y + node.height) - Math.max(label.y, node.y) > 1,
      ).toBe(false);
    }
  await expect(status).toContainText('Measure again before arranging');
  await page.getByRole('button', { name: 'Fit descriptor diagram', exact: true }).click();
  await panel
    .getByRole('region', { name: 'Descriptor preview layout', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('measured-labels-light.png', import.meta.url)),
  });
  const fitted = await boxes();
  // A second request after fit uses world sizes, not the smaller screen rectangles.
  await measure().click();
  await expect(status).toContainText('Measured 8 rendered labels');
  await arrange().click();
  await expect(panel.getByLabel('Preview layout mode', { exact: true })).toHaveText(
    'ELK preview geometry',
    { timeout: 30000 },
  );
  await expect(status).toContainText('Measure again before arranging');
  const refitted = await boxes();
  expect(refitted.labels.map((b) => Math.round(b.width))).toEqual(
    fitted.labels.map((b) => Math.round(b.width)),
  );
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await expect(arrange()).toBeDisabled();
  await measure().click();
  await expect(status).toContainText('Measured 8 rendered labels');
  await arrange().click();
  await expect(status).toContainText('Measure again before arranging');
  await section('Diagnostics');
  await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
  await section('Domain review');
  await panel
    .getByRole('region', { name: 'Descriptor preview layout', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('measured-labels-dark.png', import.meta.url)),
  });
  const badge = page.locator('.alchemy-canvas [data-alchemy-relation-badge]').first();
  const badgeBox = await badge.boundingBox();
  expect(badgeBox).not.toBeNull();
  await page.mouse.move(badgeBox.x + badgeBox.width / 2, badgeBox.y + badgeBox.height / 2);
  await page.mouse.wheel(0, -500);
  await expect
    .poll(async () => (await badge.boundingBox()).width)
    .toBeGreaterThan(badgeBox.width * 2);
  await page.screenshot({
    path: fileURLToPath(new URL('measured-labels-detail.png', import.meta.url)),
  });
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
          'opt-in only; no automatic layout',
          'Cancel and content change during delayed font readiness discard old work',
          'keyboard Measure/Arrange retain focus',
          'eight intrinsic badges have varied widths and avoid leaf-node overlap',
          'measurement after camera fit is zoom independent',
          'dark mode requires fresh measurement; Minimal mode retains controls',
          'source findings and working model/lineage preserved',
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
