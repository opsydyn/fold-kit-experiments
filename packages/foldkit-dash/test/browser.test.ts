/**
 * The starter, built, in Chromium: charts drawn, no script, no console errors, and usable
 * at phone width in light and dark. Run by `bun run test:browser`.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Browser, chromium } from 'playwright';

const bin = join(import.meta.dir, '..', 'src', 'bin.ts');
/** The starter, built, and a browser to read it in. */
async function setUp(): Promise<{ readonly browser: Browser; readonly site: string }> {
  const dir = join(mkdtempSync(join(tmpdir(), 'foldkit-dash-')), 'site');
  for (const args of [
    ['new', dir],
    ['build', '-C', dir],
  ]) {
    expect(Bun.spawnSync(['bun', bin, ...args]).exitCode).toBe(0);
  }
  return { browser: await chromium.launch(), site: `file://${join(dir, 'dist', 'index.html')}` };
}

const ready = setUp();

beforeAll(async () => {
  await ready;
});

afterAll(async () => {
  await (await ready).browser.close();
});

for (const [name, viewport] of [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1280, height: 900 }],
] as const) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the built page reads at ${name} width, ${colorScheme}`, async () => {
      const { browser, site } = await ready;
      const page = await browser.newPage({ viewport, colorScheme });
      const errors: Array<string> = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(site);
      const shown = await page.evaluate(() => ({
        scripts: document.scripts.length,
        figures: document.querySelectorAll('figure.chart svg').length,
        tables: document.querySelectorAll('figure.chart table').length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        widest: Math.max(
          ...[...document.querySelectorAll('figure.chart svg')].map(
            (svg) => svg.getBoundingClientRect().width,
          ),
        ),
        background: getComputedStyle(document.body).backgroundColor,
        heading: document.querySelector('h1')?.textContent,
      }));
      expect(shown.scripts).toBe(0);
      expect(shown.figures).toBeGreaterThanOrEqual(2);
      expect(shown.tables).toBe(2);
      expect(shown.overflow).toBeLessThanOrEqual(0);
      expect(shown.widest).toBeLessThanOrEqual(viewport.width);
      expect(shown.heading).toBe('Weekly sales');
      expect(shown.background).toBe(
        colorScheme === 'dark' ? 'rgb(20, 20, 22)' : 'rgb(251, 251, 250)',
      );
      expect(errors).toEqual([]);
      await page.close();
    });
  }
}

// INTERACTIVE PAGES (ADR 0110)

const sales = [
  { month: 'Jan', units: 12, revenue: 120, region: 'north', promo: true },
  { month: 'Feb', units: 9, revenue: 95, region: 'south', promo: false },
  { month: 'Mar', units: 15, revenue: 160, region: 'north', promo: false },
  { month: 'Apr', units: 6, revenue: 70, region: 'south', promo: true },
];

const interactive = [
  '# Sales\n',
  '```input\n{ "type": "select", "name": "region", "label": "Region", "options": { "data": "shop.json", "field": "region" }, "all": "All regions" }\n```\n',
  '```input\n{ "type": "radio", "name": "metric", "label": "Measure", "options": ["units", "revenue"] }\n```\n',
  '```input\n{ "type": "range", "name": "floor", "label": "At least", "min": 0, "max": 15, "step": 1 }\n```\n',
  '```input\n{ "type": "checkbox", "name": "promo", "label": "Promotion weeks", "value": false }\n```\n',
  '```plot\n{ "width": 400, "height": 240, "data": "shop.json", "where": { "region": { "input": "region" }, "units": { "min": { "input": "floor" } } }, "marks": [{ "mark": "bar", "x": "month", "y": { "input": "metric" } }] }\n```\n',
  '```plot\n{ "width": 400, "height": 240, "data": "shop.json", "where": { "promo": { "input": "promo" } }, "marks": [{ "mark": "bar", "x": "month", "y": "units" }] }\n```\n',
  '```plot\n{ "width": 400, "height": 240, "data": "regions.json", "select": "region", "marks": [{ "mark": "bar", "x": "region", "y": "units" }] }\n```\n',
].join('\n');

/** An interactive page, built, opened from its folder. */
async function interactivePage(javaScriptEnabled = true) {
  const dir = join(mkdtempSync(join(tmpdir(), 'foldkit-dash-')), 'site');
  for (const args of [
    ['new', dir],
    ['build', '-C', dir],
  ]) {
    expect(Bun.spawnSync(['bun', bin, ...args]).exitCode).toBe(0);
  }
  await Bun.write(join(dir, 'pages/sales.md'), interactive);
  await Bun.write(join(dir, 'data/shop.json'), JSON.stringify(sales));
  await Bun.write(join(dir, 'pages/trend.md'), trend);
  await Bun.write(
    join(dir, 'data/regions.json'),
    JSON.stringify([
      { region: 'north', units: 27 },
      { region: 'south', units: 15 },
    ]),
  );
  expect(Bun.spawnSync(['bun', bin, 'build', '-C', dir]).exitCode).toBe(0);
  const { browser } = await ready;
  const context = await browser.newContext({
    javaScriptEnabled,
    viewport: { width: 390, height: 900 },
  });
  const page = await context.newPage();
  const errors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  // Before the script runs: note on the document whether the server's SVG is ever
  // removed, to see whether hydration adopts the server's nodes or draws new ones.
  await page.addInitScript(() => {
    new MutationObserver((_, first) => {
      const svg = document.querySelector('figure.chart svg');
      if (svg === null) return;
      first.disconnect();
      new MutationObserver(() => {
        if (!document.contains(svg)) document.documentElement.dataset['svgReplaced'] = 'yes';
      }).observe(document, { childList: true, subtree: true });
    }).observe(document, { childList: true, subtree: true });
  });
  const url = `file://${join(dir, 'dist', 'sales.html')}`;
  await page.goto(url);
  return { page, errors, context, url };
}

const barsShown = (page: Awaited<ReturnType<typeof interactivePage>>['page'], chart: number) =>
  page.evaluate(
    (at) =>
      document.querySelectorAll('figure.chart')[at]?.querySelectorAll('svg rect').length ?? -1,
    chart,
  );

const labelOf = (page: Awaited<ReturnType<typeof interactivePage>>['page']) =>
  page.evaluate(() => document.querySelector('figure.chart svg desc')?.textContent ?? '');

test('an interactive page hydrates the HTML it was built as, and every kind of input redraws', async () => {
  const { page, errors, context } = await interactivePage();
  await page.waitForFunction(() => document.querySelector('[data-foldkit-app]') === null);
  // Hydration adopted the server's SVG rather than drawing a new one.
  expect(
    await page.evaluate(() => document.documentElement.dataset['svgReplaced']),
  ).toBeUndefined();
  expect(await barsShown(page, 0)).toBe(4);
  await page.selectOption('select', { label: 'north' });
  await page.waitForFunction(() =>
    document.querySelector('figure.chart svg desc')?.textContent?.startsWith('Shows 2 bars'),
  );
  await page.getByLabel('revenue').check();
  await page.waitForFunction(() =>
    document.querySelector('figure.chart svg desc')?.textContent?.includes('revenue'),
  );
  expect(await labelOf(page)).toContain('revenue from 0 to 160');
  await page.locator('input[type=range]').fill('13');
  await page.waitForFunction(() =>
    document.querySelector('figure.chart svg desc')?.textContent?.startsWith('Shows 1 bar'),
  );
  expect(await page.locator('output').textContent()).toBe('13');
  expect(await barsShown(page, 1)).toBe(2);
  await page.getByLabel('Promotion weeks').check();
  await page.waitForFunction(() =>
    document
      .querySelectorAll('figure.chart')[1]
      ?.querySelector('desc')
      ?.textContent?.includes('Jan, Apr'),
  );
  expect(errors).toEqual([]);
  await context.close();
});

test('without JavaScript the page shows its defaults, charts and inputs alike', async () => {
  const { page, errors, context } = await interactivePage(false);
  expect(await barsShown(page, 0)).toBe(4);
  expect(await barsShown(page, 1)).toBe(2);
  expect(await page.locator('select option').allTextContents()).toEqual([
    'All regions',
    'north',
    'south',
  ]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
  await context.close();
});

// CLICKING A CHART, AND INPUTS IN THE URL (ADR 0116)

test('clicking a bar chooses its category, and the address keeps the choice', async () => {
  const { page, errors, context, url } = await interactivePage();
  await page.waitForFunction(() => document.querySelector('[data-foldkit-app]') === null);
  const regionBars = page.locator('figure.chart').nth(2).locator('svg rect');
  await regionBars.nth(1).click();
  await page.waitForFunction(() =>
    document.querySelector('figure.chart svg desc')?.textContent?.startsWith('Shows 2 bars'),
  );
  expect(await page.locator('select option:checked').textContent()).toBe('south');
  expect(new URL(page.url()).search).toBe('?region=south');
  // The chosen bar stands out: the other is dimmed.
  const opacities = await regionBars.evaluateAll((rects) =>
    rects.map((rect) => Number(getComputedStyle(rect).opacity)),
  );
  expect(opacities[0]).toBeLessThan(opacities[1] ?? 0);
  // The chosen bar again: back to all regions, and a plain address.
  await regionBars.nth(1).click();
  await page.waitForFunction(() =>
    document.querySelector('figure.chart svg desc')?.textContent?.startsWith('Shows 4 bars'),
  );
  expect(new URL(page.url()).search).toBe('');
  // A shared address opens the page with its values; what it cannot take is ignored.
  await page.goto(`${url}?region=north&metric=revenue&floor=99`);
  await page.waitForFunction(() =>
    document.querySelector('figure.chart svg desc')?.textContent?.includes('revenue'),
  );
  expect(await labelOf(page)).toStartWith('Shows 2 bars');
  expect(await page.locator('input[type=range]').inputValue()).toBe('0');
  expect(errors).toEqual([]);
  await context.close();
});

// SEVERAL VALUES AT ONCE, AND CHOOSING A SERIES (ADR 0117)

const trend = [
  '# Trend\n',
  '```input\n{ "type": "checkboxes", "name": "regions", "label": "Regions", "options": { "data": "shop.json", "field": "region" } }\n```\n',
  '```input\n{ "type": "select", "name": "focus", "label": "Focus", "options": ["north", "south"], "all": "Both" }\n```\n',
  '```plot\n{ "width": 400, "height": 240, "data": "shop.json", "select": "focus", "where": { "region": { "input": "regions" } }, "marks": [{ "mark": "dot", "x": "month", "y": "units", "stroke": "region", "r": { "value": 8 } }] }\n```\n',
  '```plot\n{ "width": 400, "height": 240, "data": "shop.json", "where": { "region": { "input": "focus" } }, "marks": [{ "mark": "bar", "x": "month", "y": "units" }] }\n```\n',
].join('\n');

test('checkboxes filter to several values, and clicking a point chooses its series', async () => {
  const { page, errors, context, url } = await interactivePage();
  await page.goto(url.replace('sales.html', 'trend.html'));
  await page.waitForFunction(() => document.querySelector('[data-foldkit-app]') === null);
  const descOf = (at: number) =>
    page.evaluate(
      (index) =>
        document.querySelectorAll('figure.chart')[index]?.querySelector('desc')?.textContent ?? '',
      at,
    );
  expect(await descOf(0)).toStartWith('Shows 4 points');
  await page.getByRole('checkbox', { name: 'south' }).uncheck();
  await page.waitForFunction(() =>
    document.querySelector('figure.chart desc')?.textContent?.startsWith('Shows 2 points'),
  );
  expect(new URL(page.url()).search).toBe('?regions=north');
  // A press on a north point chooses north for the select the chart names.
  // A grid line crosses the hollow dot's centre; the press lands on the chart either way.
  await page.locator('figure.chart').nth(0).locator('svg circle').first().click({ force: true });
  await page.waitForFunction(() =>
    document
      .querySelectorAll('figure.chart')[1]
      ?.querySelector('desc')
      ?.textContent?.startsWith('Shows 2 bars'),
  );
  expect(await page.locator('select option:checked').textContent()).toBe('north');
  expect(new URL(page.url()).search).toBe('?regions=north&focus=north');
  // The address carries both, the checkboxes as one parameter per ticked choice.
  await page.goto(
    `${url.replace('sales.html', 'trend.html')}?regions=south&regions=north&focus=south`,
  );
  await page.waitForFunction(() =>
    document
      .querySelectorAll('figure.chart')[1]
      ?.querySelector('desc')
      ?.textContent?.includes('Feb, Apr'),
  );
  expect(await page.getByRole('checkbox', { name: 'south' }).isChecked()).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});
