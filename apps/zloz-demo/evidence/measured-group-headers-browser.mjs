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
  await expect(page.locator('.alchemy-canvas [data-flow-node]')).toHaveCount(7);
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
  await expect(
    panel.getByRole('button', { name: 'Measure group headings', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await panel
    .getByRole('combobox', { name: 'Group heading', exact: true })
    .selectOption('measured');
  const status = panel.getByLabel('Heading measurement status', { exact: true });
  const measure = () => panel.getByRole('button', { name: 'Measure group headings', exact: true });
  const arrange = () =>
    panel.getByRole('button', { name: 'Arrange preview with ELK', exact: true });
  await expect(arrange()).toBeDisabled();
  expect(await positions()).toEqual(before);
  const holdFonts = () =>
    page.evaluate(() => {
      const prior = document.fonts.ready;
      let release;
      const hold = new Promise((resolve) => {
        release = resolve;
      });
      window.releaseHeadingFonts = () => {
        release();
        delete document.fonts.ready;
      };
      Object.defineProperty(document.fonts, 'ready', {
        configurable: true,
        value: prior.then(() => hold),
      });
    });
  const releaseFonts = () => page.evaluate(() => window.releaseHeadingFonts());
  await holdFonts();
  await measure().click();
  const cancel = () =>
    panel.getByRole('button', { name: 'Cancel heading measurement', exact: true });
  await expect(cancel()).toBeVisible();
  await cancel().click();
  await expect(measure()).toBeVisible();
  await releaseFonts();
  await expect(status).toContainText('Measure rendered group headings first');
  await holdFonts();
  await measure().click();
  await expect(cancel()).toBeVisible();
  await panel
    .getByRole('combobox', { name: 'Heading detail', exact: true })
    .selectOption('provenance');
  await expect(status).toContainText('Measure rendered group headings first');
  await releaseFonts();
  await panel
    .getByRole('combobox', { name: 'Heading detail', exact: true })
    .selectOption('summary');
  const ready = async () => {
    await measure().focus();
    await measure().press('Enter');
    await expect(status).toHaveText('Measured 1 group headings. Arrange to apply.');
    await expect(measure()).toBeFocused();
  };
  const apply = async () => {
    await arrange().focus();
    await arrange().press('Enter');
    await expect(status).toContainText('Measured group headings applied', { timeout: 30000 });
    await expect(arrange()).toBeFocused();
  };
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
        nodes: [...surface.querySelectorAll('[data-flow-node]')].map(rect),
      };
    });
  const check = async () => {
    const g = await geometry();
    expect((g.header.x - g.group.x) / g.zoom).toBeCloseTo(24, 1);
    expect((g.header.y - g.group.y) / g.zoom).toBeCloseTo(24, 1);
    for (const node of g.nodes)
      expect((node.y - g.header.y - g.header.height) / g.zoom).toBeGreaterThanOrEqual(23.9);
    return { width: g.header.width / g.zoom, height: g.header.height / g.zoom };
  };
  await ready();
  expect(await positions()).toEqual(before);
  const natural = await geometry();
  const summary = {
    width: natural.header.width / natural.zoom,
    height: natural.header.height / natural.zoom,
  };
  expect(summary.width).toBeLessThan(640);
  expect(summary.height).toBeLessThan(112);
  await apply();
  const measuredSummary = await check();
  expect(measuredSummary.width).toBeCloseTo(summary.width, 1);
  expect(measuredSummary.height).toBeCloseTo(summary.height, 1);
  await ready();
  await apply();
  const repeated = await check();
  expect(repeated.width).toBeCloseTo(summary.width, 1);
  expect(repeated.height).toBeCloseTo(summary.height, 1);
  const arranged = await positions();
  await panel
    .getByRole('combobox', { name: 'Heading detail', exact: true })
    .selectOption('provenance');
  await expect(arrange()).toBeDisabled();
  expect(await positions()).toEqual(arranged);
  await ready();
  await apply();
  const provenance = await check();
  expect(provenance.width).toBeGreaterThan(summary.width + 40);
  expect(provenance.height).toBeGreaterThan(summary.height + 10);
  await panel
    .getByRole('region', { name: 'Descriptor preview layout', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('measured-group-headers-light.png', import.meta.url)),
  });
  await panel.getByRole('combobox', { name: 'Layout direction', exact: true }).selectOption('DOWN');
  await panel.getByRole('combobox', { name: 'Label sizing', exact: true }).selectOption('measured');
  await ready();
  await panel.getByRole('button', { name: 'Measure label bounds', exact: true }).click();
  await expect(panel.getByLabel('Label measurement status', { exact: true })).toContainText(
    'Measured 8 rendered labels',
  );
  await apply();
  await check();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await expect(arrange()).toBeDisabled();
  await ready();
  await panel.getByRole('button', { name: 'Measure label bounds', exact: true }).click();
  await expect(panel.getByLabel('Label measurement status', { exact: true })).toContainText(
    'Measured 8 rendered labels',
  );
  await apply();
  await check();
  await section('Diagnostics');
  await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
  await section('Domain review');
  await panel
    .getByRole('region', { name: 'Descriptor preview layout', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('measured-group-headers-dark.png', import.meta.url)),
  });
  const header = page.locator('.alchemy-canvas [data-zloz-group-header]');
  const box = await header.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 10);
  await page.mouse.wheel(0, -350);
  await expect
    .poll(async () => (await header.boundingBox()).width)
    .toBeGreaterThan(box.width * 1.5);
  await check();
  await page.screenshot({
    path: fileURLToPath(new URL('measured-group-headers-detail.png', import.meta.url)),
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
          'measurement absent by default; no automatic arrangement',
          'Cancel and detail change during delayed font readiness reject old work',
          'keyboard Measure/Arrange retain focus',
          'summary/provenance headings acquire different intrinsic sizes',
          'real RIGHT/DOWN layouts preserve measured header insets and child gap',
          'repeat measurement after fit is zoom independent',
          'heading and edge measurements compose in one explicit layout',
          'theme requires fresh measurements; Minimal mode retains controls',
          'nine findings and exact working model/lineage survive',
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
