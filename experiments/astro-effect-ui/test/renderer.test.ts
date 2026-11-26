/* oxlint-disable linteffect/no-try-catch -- Tests use finally to release browser and DOM resources. */
import { beforeAll, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import { Window as TestWindow } from 'happy-dom';
import { chromium } from 'playwright';

import renderer from '../src/client';
import { Counter, StaticSummary } from './fixture/src/Counter';
import { deploymentChart, reportChart } from './fixture/src/ReportChart';
import { VizBarChart } from './fixture/src/VizBarChart';

const fixture = new URL('./fixture/', import.meta.url);
const output = new URL('dist/', fixture);

const origin = 'http://astro-effect-ui.test';

beforeAll(async () => {
  const build = Bun.spawn(
    ['node', 'node_modules/astro/bin/astro.mjs', 'build', '--root', 'test/fixture'],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [status, stdout, stderr] = await Promise.all([
    build.exited,
    new Response(build.stdout).text(),
    new Response(build.stderr).text(),
  ]);
  if (status !== 0) throw new Error(stdout + stderr);
}, 30_000);

async function expectEventually(
  read: () => string | number | null | undefined,
  expected: string | number,
) {
  const deadline = Date.now() + 1000;
  while (read() !== expected && Date.now() < deadline) {
    await Bun.sleep(5);
  }
  expect(read()).toBe(expected);
}

test('a static component emits HTML without an island or hydration payload', async () => {
  const html = await readFile(new URL('static/index.html', output), 'utf8');
  expect(html).toContain('<p>Static summary</p>');
  expect(html).not.toMatch(/<astro-island|<script|data-effect-ui-state/);
});

test('the client renderer adopts built Astro markup and disposes an island scope', async () => {
  const dom = new TestWindow({ url: origin });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom });
  try {
    const html = await readFile(new URL('index.html', output), 'utf8');
    dom.document.write(html);
    const [kept, removed] = dom.document.querySelectorAll('astro-island');
    if (!kept || !removed) throw new Error('Expected two Astro islands.');
    const keptOutput = kept.querySelector('output');
    const removedOutput = removed.querySelector('output');
    const activate = (element: typeof kept, label: string, start: number) =>
      // SAFETY: Happy DOM supplies the DOM methods the renderer uses.
      // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations are incompatible with lib.dom.
      renderer(element as unknown as HTMLElement)(
        Counter,
        { label, start },
        {},
        { client: 'load' },
      );
    const firstActivation = activate(kept, 'kept', 10);
    expect(activate(kept, 'kept', 10)).toBe(firstActivation);
    await Promise.all([firstActivation, activate(removed, 'removed', 20)]);
    expect(kept.querySelector('output')).toBe(keptOutput);
    expect(removed.querySelector('output')).toBe(removedOutput);
    expect(window.document.title).toBe('Astro renderer fixture');
    await expectEventually(() => window.activeIslands?.get('removed'), 1);
    kept.querySelector('button')?.click();
    await expectEventually(() => keptOutput?.textContent, '11');
    expect(removedOutput?.textContent).toBe('20');
    removed.dispatchEvent(new dom.Event('astro:unmount'));
    await expectEventually(() => window.activeIslands?.get('removed'), 0);
    expect(window.activeIslands?.get('kept')).toBe(1);
    kept.dispatchEvent(new dom.Event('astro:unmount'));
    await expectEventually(() => window.activeIslands?.get('kept'), 0);
  } finally {
    for (const island of dom.document.querySelectorAll('astro-island')) {
      island.dispatchEvent(new dom.Event('astro:unmount'));
    }
    await dom.close();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('the Viz fixture renders matching static and interactive bars and updates selection', async () => {
  const dom = new TestWindow({ url: origin });
  try {
    const html = await readFile(new URL('chart/index.html', output), 'utf8');
    dom.document.write(html);
    const staticChart = dom.document.querySelector('#static-chart');
    const island = dom.document.querySelector('#interactive-chart astro-island');
    if (!staticChart || !island) throw new Error('Expected both Viz chart variants.');
    expect(staticChart.querySelector('astro-island, script, button')).toBeNull();
    const svg = island.querySelector('svg');
    expect(svg?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg?.getAttribute('aria-label')).toBe('Reports by month');
    expect(svg?.getAttribute('aria-description')).toBe('January through March.');
    const heights = (root: typeof staticChart) =>
      Array.from(root.querySelectorAll('rect'), (bar) => bar.getAttribute('height'));
    expect(heights(staticChart)).toEqual(['32', '64', '96']);
    expect(heights(island)).toEqual(heights(staticChart));
    expect(Array.from(staticChart.querySelectorAll('td'), (cell) => cell.textContent)).toEqual([
      '12',
      '24',
      '36',
    ]);
    // SAFETY: Happy DOM supplies the DOM methods the renderer uses.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations are incompatible with lib.dom.
    const hydrate = renderer(island as unknown as HTMLElement);
    await hydrate(VizBarChart, { ...reportChart, interactive: true }, {}, { client: 'load' });
    expect(island.querySelector('svg')).toBe(svg);
    const february = island.querySelector('button[data-bar-key="feb"]');
    february?.dispatchEvent(new dom.MouseEvent('click', { bubbles: true }));
    await expectEventually(
      () => island.querySelector('output')?.textContent,
      'February: 24 reports',
    );
    expect(february?.getAttribute('aria-pressed')).toBe('true');
    expect(island.querySelector('rect[data-bar-key="feb"]')?.getAttribute('stroke')).toBe(
      'currentColor',
    );
    expect(heights(island)).toEqual(heights(staticChart));
  } finally {
    dom.document.querySelector('astro-island')?.dispatchEvent(new dom.Event('astro:unmount'));
    await dom.close();
  }
});

test('a second Viz chart renders signed values and keeps its selection local', async () => {
  const dom = new TestWindow({ url: origin });
  try {
    const html = await readFile(new URL('chart/index.html', output), 'utf8');
    dom.document.write(html);
    const original = dom.document.querySelector('#interactive-chart astro-island');
    const second = dom.document.querySelector('#deployment-chart astro-island');
    if (!original || !second) throw new Error('Expected two interactive datasets.');
    const svg = second.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('Net deployments by region');
    expect(Array.from(second.querySelectorAll('td'), (cell) => cell.textContent)).toEqual([
      '-4',
      '8',
    ]);
    const negativeBar = second.querySelector('rect[data-bar-key="eu"]');
    expect(negativeBar?.getAttribute('y')).toBe('64');
    expect(negativeBar?.getAttribute('height')).toBe('32');
    // SAFETY: Happy DOM supplies the DOM methods the renderer uses.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations are incompatible with lib.dom.
    const hydrateOriginal = renderer(original as unknown as HTMLElement);
    // SAFETY: Happy DOM supplies the DOM methods the renderer uses.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations are incompatible with lib.dom.
    const hydrateSecond = renderer(second as unknown as HTMLElement);
    await Promise.all([
      hydrateOriginal(VizBarChart, { ...reportChart, interactive: true }, {}, { client: 'load' }),
      hydrateSecond(VizBarChart, deploymentChart, {}, { client: 'load' }),
    ]);
    expect(second.querySelector('svg')).toBe(svg);
    original
      .querySelector('button[data-bar-key="feb"]')
      ?.dispatchEvent(new dom.MouseEvent('click', { bubbles: true }));
    await expectEventually(
      () => original.querySelector('output')?.textContent,
      'February: 24 reports',
    );
    second
      .querySelector('button[data-bar-key="eu"]')
      ?.dispatchEvent(new dom.MouseEvent('click', { bubbles: true }));
    await expectEventually(
      () => second.querySelector('output')?.textContent,
      'Europe: -4 deployments',
    );
    expect(original.querySelector('output')?.textContent).toBe('February: 24 reports');
    expect(negativeBar?.getAttribute('stroke')).toBe('currentColor');
  } finally {
    for (const island of dom.document.querySelectorAll('astro-island')) {
      island.dispatchEvent(new dom.Event('astro:unmount'));
    }
    await dom.close();
  }
});

test('Astro renders composed Viz dots and reports a missing plot field', async () => {
  const dom = new TestWindow({ url: origin });
  try {
    dom.document.write(await readFile(new URL('plot/index.html', output), 'utf8'));
    const plot = dom.document.querySelector('#valid-plot svg');
    expect(plot?.getAttribute('aria-label')).toBe('Latency over time');
    expect(plot?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    const dots = Array.from(plot?.querySelectorAll('circle') ?? []);
    expect(dots.map((dot) => [dot.getAttribute('cx'), dot.getAttribute('cy')])).toEqual([
      ['0', '75'],
      ['100', '25'],
    ]);
    expect(dom.document.querySelector('#invalid-plot svg')).toBeNull();
    expect(dom.document.querySelector('#invalid-plot p')?.textContent).toContain('marks[0].y');
  } finally {
    await dom.close();
  }
});

test('an island can retry after its hydration state fails to parse', async () => {
  const dom = new TestWindow({ url: origin });
  try {
    dom.document.write(await readFile(new URL('chart/index.html', output), 'utf8'));
    const island = dom.document.querySelector('#interactive-chart astro-island');
    const state = island?.querySelector('script[data-effect-ui-state]');
    const originalSvg = island?.querySelector('svg');
    if (!island || !state?.textContent || !originalSvg) {
      throw new Error('Expected an island with hydrated chart markup and state.');
    }
    const serializedState = state.textContent;
    state.textContent = '{';
    // SAFETY: Happy DOM supplies the DOM methods the renderer uses.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations are incompatible with lib.dom.
    const hydrate = renderer(island as unknown as HTMLElement);
    const props = { ...reportChart, interactive: true };
    await expect(hydrate(VizBarChart, props, {}, { client: 'load' })).rejects.toThrow();
    expect(island.querySelector('svg')).toBe(originalSvg);
    state.textContent = serializedState;
    await hydrate(VizBarChart, props, {}, { client: 'load' });
    expect(island.querySelector('svg')).toBe(originalSvg);
    island
      .querySelector('button[data-bar-key="feb"]')
      ?.dispatchEvent(new dom.MouseEvent('click', { bubbles: true }));
    await expectEventually(
      () => island.querySelector('output')?.textContent,
      'February: 24 reports',
    );
  } finally {
    for (const island of dom.document.querySelectorAll('astro-island')) {
      island.dispatchEvent(new dom.Event('astro:unmount'));
    }
    await dom.close();
  }
});

test('client:only mounts without a server render or serialized state', async () => {
  const dom = new TestWindow({ url: origin });
  try {
    const html = await readFile(new URL('browser-only/index.html', output), 'utf8');
    expect(html).not.toMatch(/<p>Static summary|data-effect-ui-state/);
    dom.document.write(html);
    const island = dom.document.querySelector('astro-island');
    if (!island) throw new Error('Expected a browser-only Astro island.');
    // SAFETY: Happy DOM supplies the DOM methods the renderer uses.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations are incompatible with lib.dom.
    const mount = renderer(island as unknown as HTMLElement);
    await mount(StaticSummary, {}, {}, { client: 'only' });
    await expectEventually(() => island.querySelector('p')?.textContent, 'Static summary');
    island.dispatchEvent(new dom.Event('astro:unmount'));
  } finally {
    await dom.close();
  }
});

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  'Astro activates two independent roots in place and closes only the removed scope',
  async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let unblock!: () => void;
      const javascriptReady = new Promise<void>((resolve) => {
        unblock = resolve;
      });
      await page.route(`${origin}/**`, async (route) => {
        if (route.request().resourceType() === 'script') await javascriptReady;
        const pathname = new URL(route.request().url()).pathname;
        const file = new URL(
          pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : ''),
          output,
        );
        await route.fulfill({ path: file.pathname });
      });
      await page.goto(`${origin}/`, { waitUntil: 'commit' });
      const kept = page.getByLabel('kept', { exact: true });
      const removed = page.getByLabel('removed', { exact: true });
      const originalKept = await kept.elementHandle();
      const originalRemoved = await removed.elementHandle();
      const expectActive = (label: string, count: number) =>
        page.waitForFunction(([name, expected]) => window.activeIslands?.get(name) === expected, [
          label,
          count,
        ] as const);
      unblock();

      await expectActive('kept', 1);
      expect(await page.title()).toBe('Astro renderer fixture');
      expect(await page.evaluate(() => window.activeIslands?.get('removed'))).toBeUndefined();
      expect(await kept.textContent()).toBe('10');
      await page.getByRole('button', { name: 'Increment kept' }).click();
      await page.waitForFunction(
        () => document.querySelector('[aria-label="kept"]')?.textContent === '11',
      );
      await removed.scrollIntoViewIfNeeded();
      await expectActive('removed', 1);
      await page.getByRole('button', { name: 'Increment removed' }).click();
      await page.waitForFunction(
        () => document.querySelector('[aria-label="removed"]')?.textContent === '21',
      );
      expect(await originalKept.evaluate((node) => node.isConnected)).toBe(true);
      expect(await originalRemoved.evaluate((node) => node.isConnected)).toBe(true);
      expect(await kept.textContent()).toBe('11');

      await page.getByRole('link', { name: 'Away' }).click();
      await page.waitForURL('**/away/');
      await expectActive('removed', 0);
      expect(await originalKept.evaluate((node) => node.isConnected)).toBe(true);
      expect(await kept.textContent()).toBe('11');
      await page.getByRole('link', { name: 'Return' }).click();
      await page.waitForURL(`${origin}/`);
      await removed.scrollIntoViewIfNeeded();
      await expectActive('removed', 1);
      expect(await removed.textContent()).toBe('20');
      await page.getByRole('button', { name: 'Increment removed' }).click();
      await page.waitForFunction(
        () => document.querySelector('[aria-label="removed"]')?.textContent === '21',
      );
      expect(await kept.textContent()).toBe('11');
      await page.goto(`${origin}/chart/`);
      const chart = page.getByRole('region', { name: 'Interactive chart' });
      await chart.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
      const february = chart.getByRole('button', { name: 'February' });
      await february.press('Enter');
      await page.waitForFunction(
        () =>
          document.querySelector('#interactive-chart output')?.textContent ===
          'February: 24 reports',
      );
      expect(await february.getAttribute('aria-pressed')).toBe('true');
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  30_000,
);
