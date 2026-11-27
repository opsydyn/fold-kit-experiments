/**
 * The starter, built, in Chromium: charts drawn, no script, no console errors, and usable
 * at phone width in light and dark. Run by `bun run test:e2e`.
 */
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Browser, chromium } from 'playwright';

const bin = join(import.meta.dir, '..', 'src', 'bin.ts');

// Each test builds a site and drives a browser through several redraws; 5 s, bun's
// default, is too little on a busy machine.
setDefaultTimeout(30_000);
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
async function interactivePage(javaScriptEnabled = true, protocol: 'file' | 'http' = 'file') {
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
  await Bun.write(join(dir, 'pages/lines.md'), lines);
  await Bun.write(join(dir, 'pages/span.md'), span);
  await Bun.write(join(dir, 'data/days.json'), JSON.stringify(daily));
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
  const file = join(dir, 'dist', 'sales.html');
  const server =
    protocol === 'http'
      ? Bun.serve({
          hostname: '127.0.0.1',
          port: 0,
          fetch: (request) => {
            const path = new URL(request.url).pathname;
            if (path === '/sales.html') return new Response(Bun.file(file));
            if (/^\/_dash\/client-[a-f0-9]{12}\.js$/.test(path))
              return new Response(Bun.file(join(dir, 'dist', path.slice(1))));
            return new Response(null, { status: 404 });
          },
        })
      : undefined;
  const url = server ? `http://127.0.0.1:${server.port}/sales.html` : `file://${file}`;
  await page.goto(url).catch(async (error) => {
    server?.stop(true);
    await context.close();
    throw error;
  });
  return { page, errors, context, url, server };
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
  await page.waitForFunction(
    () => document.querySelector('[data-dash-root][data-dash-ready]') !== null,
  );
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

test('an HTTP page adopts the built chart and leaves it static with a mismatched bundle', async () => {
  const { page, errors, context, url, server } = await interactivePage(true, 'http');
  await using fixture = {
    async [Symbol.asyncDispose]() {
      server?.stop(true);
      await context.close();
    },
  };
  await page.locator('[data-dash-ready]').waitFor();
  expect(await page.evaluate(() => document.documentElement.dataset.svgReplaced)).toBeUndefined();
  await page.selectOption('select', { label: 'north' });
  await page.waitForFunction(() => new URL(location.href).searchParams.get('region') === 'north');
  await page.waitForFunction(
    () => document.querySelectorAll('figure.chart')[0]?.querySelectorAll('svg rect').length === 2,
  );

  const description = page.locator('figure.chart svg desc').first();
  expect(await description.evaluate((element) => element.namespaceURI)).toBe(
    'http://www.w3.org/2000/svg',
  );

  await page.route(url, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /data-dash-build="[^"]+"/,
      'data-dash-build="stale"',
    );
    await route.fulfill({ response, body });
  });
  await page.goto(url);
  expect(await page.locator('[data-dash-ready]').count()).toBe(0);
  expect(await barsShown(page, 0)).toBe(4);
  expect(errors).toEqual([]);
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
  await page.waitForFunction(
    () => document.querySelector('[data-dash-root][data-dash-ready]') !== null,
  );
  const regionBars = page.locator('figure.chart').nth(2).locator('svg rect');
  await regionBars.nth(1).click();
  await page.waitForFunction(() =>
    document.querySelector('figure.chart svg desc')?.textContent?.startsWith('Shows 2 bars'),
  );
  expect(await page.locator('select option:checked').textContent()).toBe('south');
  await page.waitForFunction((search) => location.search === search, '?region=south');
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
  await page.waitForFunction((search) => location.search === search, '');
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

const lines = [
  '# Lines\n',
  '```input\n{ "type": "select", "name": "focus", "label": "Focus", "options": ["north", "south"], "all": "Both" }\n```\n',
  '```plot\n{ "width": 400, "height": 240, "data": "shop.json", "select": "focus", "marks": [{ "mark": "line", "x": "month", "y": "units", "stroke": "region" }] }\n```\n',
].join('\n');

const days = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06'];
const daily = days.flatMap((day, i) => [
  { day, units: 10 + i, region: 'north' },
  { day, units: 20 - i, region: 'south' },
]);

const span = [
  '# Span\n',
  '```input\n{ "type": "between", "name": "days", "label": "Days", "options": { "data": "days.json", "field": "day" } }\n```\n',
  '```plot\n{ "width": 400, "height": 240, "data": "days.json", "brush": "days", "x": { "label": "Day" }, "y": { "label": "Units" }, "marks": [{ "mark": "line", "x": "day", "y": "units", "stroke": "region" }] }\n```\n',
  '```plot\n{ "width": 400, "height": 240, "data": "days.json", "where": { "day": { "input": "days" } }, "marks": [{ "mark": "dot", "x": "day", "y": "units", "stroke": "region" }] }\n```\n',
].join('\n');

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
  await page.waitForFunction(
    () => document.querySelector('[data-dash-root][data-dash-ready]') !== null,
  );
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
  await page.waitForFunction((search) => location.search === search, '?regions=north');
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
  await page.waitForFunction((search) => location.search === search, '?regions=north&focus=north');
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

// POINTING AT VALUES, KEYS AND THE LEGEND (ADR 0118)

test('a read-out follows the pointer and the keys, and the legend chooses a series', async () => {
  const { page, errors, context, url } = await interactivePage();
  await page.goto(url.replace('sales.html', 'trend.html'));
  await page.waitForFunction(
    () => document.querySelector('[data-dash-root][data-dash-ready]') !== null,
  );
  const readout = (at: number) =>
    page.evaluate(
      (index) =>
        document.querySelectorAll('figure.chart')[index]?.querySelector('.readout')?.textContent ??
        '',
      at,
    );
  const readsOut = (at: number, text: string) =>
    page.waitForFunction(
      ([index, expected]) =>
        document.querySelectorAll('figure.chart')[Number(index)]?.querySelector('.readout')
          ?.textContent === expected,
      [String(at), text] as const,
    );
  // Hovering a bar reads it out; leaving clears it.
  const bars = page.locator('figure.chart').nth(1).locator('svg rect');
  await bars.nth(2).hover({ force: true });
  await page.waitForFunction(
    () =>
      document.querySelectorAll('figure.chart')[1]?.querySelector('.readout')?.textContent !== '',
  );
  expect(await readout(1)).toBe('month Mar: units 15');
  await page.mouse.move(0, 0);
  await page.waitForFunction(
    () =>
      document.querySelectorAll('figure.chart')[1]?.querySelector('.readout')?.textContent === '',
  );
  // Keys step through the dot chart series by series; Enter chooses the series.
  await page.locator('figure.chart').nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await readsOut(0, 'north, month Jan: units 12');
  await page.keyboard.press('ArrowRight');
  await readsOut(0, 'north, month Mar: units 15');
  // End then Enter at once: Enter chooses what End pointed at, not what was drawn.
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await readsOut(0, 'south, month Apr: units 6');
  await page.waitForFunction(
    () => document.querySelector('select option:checked')?.textContent === 'south',
  );
  // A legend entry chooses what it names.
  await page
    .locator('figure.chart')
    .nth(0)
    .locator('.plot-legend li', { hasText: 'north' })
    .click();
  await page.waitForFunction(
    () => document.querySelector('select option:checked')?.textContent === 'north',
  );
  await page.waitForFunction((search) => location.search === search, '?focus=north');
  // Hidden data tables do not lengthen the page.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - document.body.getBoundingClientRect().height,
    ),
  ).toBeLessThan(100);
  expect(errors).toEqual([]);
  await context.close();
});

test('a chosen line stands out and the others dim', async () => {
  const { page, errors, context, url } = await interactivePage();
  await page.goto(`${url.replace('sales.html', 'lines.html')}?focus=south`);
  await page.waitForFunction(
    () => document.querySelector('[data-dash-root][data-dash-ready]') !== null,
  );
  await page.waitForFunction(
    () => document.querySelector('select option:checked')?.textContent === 'south',
  );
  const opacities = await page
    .locator('figure.chart')
    .nth(0)
    .locator('svg path[fill="none"]')
    .evaluateAll((paths) =>
      paths.map((path) => [path.getAttribute('stroke'), Number(path.getAttribute('opacity'))]),
    );
  // North dims; south, the chosen series, stays lit.
  expect(opacities).toEqual([
    ['#4e79a7', 0.15],
    ['#f28e2c', 1],
  ]);
  expect(errors).toEqual([]);
  await context.close();
});

// A SPAN BETWEEN TWO ENDS, DRAGGED OR TYPED, AND SERIES KEYS (ADR 0119)

test('dragging across a chart sets a span, a click clears it, and the fields set it too', async () => {
  const { page, errors, context, url } = await interactivePage();
  const spanUrl = url.replace('sales.html', 'span.html');
  await page.goto(spanUrl);
  await page.waitForFunction(
    () => document.querySelector('[data-dash-root][data-dash-ready]') !== null,
  );
  const filtered = () =>
    page.evaluate(
      () => document.querySelectorAll('figure.chart')[1]?.querySelector('desc')?.textContent ?? '',
    );
  expect(await filtered()).toStartWith('Shows 12 points');
  const box = await page.locator('figure.chart').nth(0).locator('svg').boundingBox();
  if (box === null) throw new Error('no chart');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.35, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, y, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => new URL(location.href).search.startsWith('?days='));
  const [from, to] = decodeURIComponent(new URL(page.url()).search.slice('?days='.length)).split(
    '..',
  );
  // The span is whole days inside the data, and the other chart keeps only them.
  expect(from! < to!).toBe(true);
  expect(from! >= days[0]! && to! <= days.at(-1)!).toBe(true);
  await page.waitForFunction(
    (start) => document.querySelector<HTMLInputElement>('input[type=date]')?.value === start,
    from!,
  );
  expect(await filtered()).not.toStartWith('Shows 12 points');
  // A click where the drag would start sets the whole span back.
  await page.mouse.click(box.x + box.width * 0.5, y);
  await page.waitForFunction(() => location.search === '');
  // The fields set the span too. Focus moves from the chart first, and the page redraws
  // for that, as it does before a person types; then the value is typed.
  await page.mouse.move(0, 0);
  await page.locator('input[type=date]').nth(0).focus();
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await page.locator('input[type=date]').nth(0).fill('2026-05-04');
  // What is typed applies when the field loses focus or Enter is pressed.
  await page.waitForFunction((search) => location.search === search, '');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.search === '?days=2026-05-04..2026-05-06');
  // While a year is typed, a date field reports whole dates such as 0202-05-05: they
  // are a draft, applied only when the field is left or Enter is pressed.
  const toField = page.locator('input[type=date]').nth(1);
  await toField.focus();
  await toField.evaluate((field) => {
    if (!(field instanceof HTMLInputElement)) return;
    field.value = '0202-05-05';
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await page.waitForFunction(
    (search) => location.search === search,
    '?days=2026-05-04..2026-05-06',
  );
  await toField.fill('2026-05-05');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.search === '?days=2026-05-04..2026-05-05');
  expect(await page.locator('input[type=date]').nth(0).inputValue()).toBe('2026-05-04');
  await page.waitForFunction(
    () =>
      document
        .querySelectorAll('figure.chart')[1]
        ?.querySelector('desc')
        ?.textContent?.startsWith('Shows 4 points') === true,
  );
  expect(errors).toEqual([]);
  await context.close();
});

test('a focused chart shows its keys, and Shift with Down moves to the next series', async () => {
  const { page, errors, context, url } = await interactivePage();
  await page.goto(url.replace('sales.html', 'span.html'));
  await page.waitForFunction(
    () => document.querySelector('[data-dash-root][data-dash-ready]') !== null,
  );
  const readout = () =>
    page.evaluate(() => document.querySelector('figure.chart .readout')?.textContent ?? '');
  await page.locator('figure.chart').nth(0).focus();
  await page.waitForFunction(() =>
    document.querySelector('figure.chart .readout')?.textContent?.startsWith('Arrow keys'),
  );
  expect(await readout()).toBe(
    'Arrow keys read values; Shift with Up or Down changes series; drag across to choose days.',
  );
  await page.keyboard.press('Shift+ArrowDown');
  await page.waitForFunction(() =>
    document.querySelector('figure.chart .readout')?.textContent?.startsWith('north'),
  );
  await page.keyboard.press('Shift+ArrowDown');
  await page.waitForFunction(() =>
    document.querySelector('figure.chart .readout')?.textContent?.startsWith('south'),
  );
  expect(await readout()).toBe('south, Day 2026-05-01: Units 20');
  expect(errors).toEqual([]);
  await context.close();
});
