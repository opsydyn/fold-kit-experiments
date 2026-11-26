/* oxlint-disable linteffect/no-try-catch -- Tests use finally to release browser and DOM resources. */
import { beforeAll, expect, mock, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import { Window as TestWindow } from 'happy-dom';
import { chromium, type WebSocketRoute } from 'playwright';

import renderer from '../../../packages/astro-effect-ui/src/client';
import interaction from '../../../packages/astro-effect-ui/src/directive-interaction';
import { Counter, StaticSummary } from './fixture/src/Counter';
import { deploymentChart, reportChart } from './fixture/src/ReportChart';
import { VizBarChart } from './fixture/src/VizBarChart';

const fixture = new URL('./fixture/', import.meta.url);
const output = new URL('dist/client/', fixture);

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

test('build-time island state is identified as static for Effect UI hydration', async () => {
  const html = await readFile(new URL('chart/index.html', output), 'utf8');
  expect(html).toContain('"~static":true');
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

test('interaction defers Astro hydration and delivers the first click exactly once', async () => {
  const dom = new TestWindow({ url: origin });
  try {
    dom.document.write(await readFile(new URL('interaction/index.html', output), 'utf8'));
    const island = dom.document.querySelector('astro-island[client="interaction"]');
    const button = island?.querySelector('button[data-bar-key="feb"]');
    const svg = island?.querySelector('svg');
    if (!island || !button || !svg)
      throw new Error('Expected the server-rendered interaction chart.');
    expect(island.querySelector('script[data-effect-ui-state]')).not.toBeNull();
    // SAFETY: Happy DOM implements the island methods used by the renderer and directive.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations differ from lib.dom.
    const host = island as unknown as HTMLElement;
    const hydrate = renderer(host);
    let releaseLoad!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    let loads = 0;
    let deliveries = 0;
    button.addEventListener('click', () => {
      deliveries += 1;
    });
    const load = async () => {
      loads += 1;
      await held;
      return async () => {
        await hydrate(
          VizBarChart,
          { ...reportChart, interactive: true },
          {},
          { client: 'interaction' },
        );
      };
    };
    interaction(load, { name: 'interaction', value: '' }, host);
    expect(loads).toBe(0);
    button.dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(loads).toBe(1);
    expect(deliveries).toBe(0);
    expect(island.querySelector('output')?.textContent).toBe('No selection');
    releaseLoad();
    await expectEventually(
      () => island.querySelector('output')?.textContent,
      'February: 24 reports',
    );
    expect(island.querySelector('svg')).toBe(svg);
    expect(deliveries).toBe(1);
    expect(loads).toBe(1);
  } finally {
    dom.document.querySelector('astro-island')?.dispatchEvent(new dom.Event('astro:unmount'));
    await dom.close();
  }
});

test('removing an interaction island while its module loads discards queued input', async () => {
  const dom = new TestWindow({ url: origin });
  try {
    dom.document.write(await readFile(new URL('interaction/index.html', output), 'utf8'));
    const island = dom.document.querySelector('astro-island[client="interaction"]');
    const button = island?.querySelector('button[data-bar-key="feb"]');
    if (!island || !button) throw new Error('Expected the interaction island and its button.');
    // SAFETY: Happy DOM implements the island methods used by the directive.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations differ from lib.dom.
    const host = island as unknown as HTMLElement;
    const hydrate = mock(async () => {});
    let releaseLoad!: (resume: () => Promise<void>) => void;
    const held = new Promise<() => Promise<void>>((resolve) => {
      releaseLoad = resolve;
    });
    const load = mock(() => held);
    interaction(load, { name: 'interaction', value: '' }, host);
    button.dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(load).toHaveBeenCalledTimes(1);
    island.remove();
    island.dispatchEvent(new dom.Event('astro:unmount'));
    releaseLoad(hydrate);
    await Bun.sleep(0);
    expect(hydrate).not.toHaveBeenCalled();
  } finally {
    await dom.close();
  }
});

test('the built Astro server isolates request props and emits adoptable island state', async () => {
  const entry = new URL('dist/server/entry.mjs', fixture);
  const { default: app }: { default: { fetch: (request: Request) => Promise<Response> } } =
    await import(entry.href);
  const request = (name: string) =>
    new Request(`${origin}/request/?name=${encodeURIComponent(name)}`);
  const [ada, grace] = await Promise.all([
    app.fetch(request('Ada </script><b>unsafe</b>')),
    app.fetch(request('Grace')),
  ]);
  expect(ada.status).toBe(200);
  expect(grace.status).toBe(200);
  const [adaHtml, graceHtml] = await Promise.all([ada.text(), grace.text()]);
  const dom = new TestWindow({ url: origin });
  try {
    dom.document.write(adaHtml);
    const island = dom.document.querySelector('astro-island');
    const greeting = island?.querySelector('output');
    if (!island || !greeting) throw new Error('Expected a hydratable greeting.');
    expect(greeting.textContent).toBe('Hello, Ada </script><b>unsafe</b>!');
    expect(island.querySelector('b')).toBeNull();
    expect(graceHtml).toContain('Hello, Grace!');
    expect(graceHtml).not.toContain('unsafe');
    const state = island.querySelector('script[data-effect-ui-state]')?.textContent;
    expect(state).toContain('unsafe');
    expect(state).not.toContain('"~static"');
    expect(state).not.toContain('</script>');
    const { Greeting } = await import('./fixture/src/Greeting');
    // SAFETY: Happy DOM supplies the DOM methods the renderer uses.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations differ from lib.dom.
    const hydrate = renderer(island as unknown as HTMLElement);
    await hydrate(Greeting, { name: 'Ada </script><b>unsafe</b>' }, {}, { client: 'load' });
    expect(island.querySelector('output')).toBe(greeting);
    island.querySelector('button')?.click();
    await expectEventually(() => greeting.textContent, 'Welcome, Ada </script><b>unsafe</b>!');
  } finally {
    dom.document.querySelector('astro-island')?.dispatchEvent(new dom.Event('astro:unmount'));
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
      await page.goto(`${origin}/interaction/`);
      await page.locator('astro-island[client="interaction"][ssr]').waitFor({ state: 'attached' });
      await page.getByRole('button', { name: 'February' }).click();
      await page
        .locator('astro-island[client="interaction"]:not([ssr])')
        .waitFor({ state: 'attached' });
      await page.waitForFunction(
        () => document.querySelector('output')?.textContent === 'February: 24 reports',
      );
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  30_000,
);

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  'the maintained Effect UI chart uses WebGL, orbits and releases its context across navigation',
  async () => {
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      const errors: Array<string> = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route(`${origin}/**`, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const path = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        await route.fulfill({ path: new URL(path, output).pathname });
      });
      await page.goto(`${origin}/three-chart/`);
      const stage = page.locator('effect-three-scene');
      const canvas = stage.locator('canvas');
      const original = await canvas.elementHandle();
      await page.waitForFunction(() => {
        const canvas = document.querySelector('effect-three-scene canvas');
        return (
          canvas instanceof HTMLCanvasElement &&
          canvas.getContext('webgl2')?.isContextLost() === false
        );
      });
      await stage.evaluate((node) => {
        node.addEventListener('scene-reconciled', (event) => {
          if (event instanceof CustomEvent && event.detail.ops.configured > 0) {
            node.setAttribute('data-camera-reconciled', 'true');
          }
        });
      });
      const start = await canvas.screenshot();
      const box = await canvas.boundingBox();
      if (!box) throw new Error('Expected the chart canvas to be visible.');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.55, { steps: 8 });
      await page.mouse.up();
      await stage.and(page.locator('[data-camera-reconciled]')).waitFor();
      expect(await canvas.screenshot()).not.toEqual(start);
      await stage.evaluate((node) => node.removeAttribute('data-camera-reconciled'));
      await page.getByRole('button', { name: 'Reset view' }).click();
      await stage.and(page.locator('[data-camera-reconciled]')).waitFor();
      await page.getByRole('button', { name: 'Surface' }).press('Enter');
      await page.locator('button[aria-pressed="true"]').filter({ hasText: 'Surface' }).waitFor();
      expect(await page.locator('.e3-readout').textContent()).toContain('32 by 32 grid');
      expect(
        await original.evaluate(
          (node) => node === document.querySelector('effect-three-scene canvas'),
        ),
      ).toBe(true);

      await page.getByRole('link', { name: 'Away' }).click();
      await page.waitForURL('**/away/');
      await page.waitForFunction(
        (node) =>
          node instanceof HTMLCanvasElement &&
          !node.isConnected &&
          node.getContext('webgl2')?.isContextLost(),
        original,
      );
      await page.goBack();
      await page.waitForURL('**/three-chart/');
      await canvas.waitFor();
      expect(await original.evaluate((node) => node.isConnected)).toBe(false);
      expect(await page.getByRole('button', { name: 'Scatter' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  30_000,
);

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  'the maintained gallery measures a loaded font and bowling scores a Rapier roll',
  async () => {
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage();
      const errors: Array<string> = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const font = new URL(
        '../../../apps/three-promo/public/models/inter-latin-400-normal.woff',
        import.meta.url,
      );
      await page.route(`${origin}/**`, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === '/models/inter-latin-400-normal.woff') {
          await route.fulfill({ path: font.pathname, contentType: 'font/woff' });
          return;
        }
        const path = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        await route.fulfill({ path: new URL(path, output).pathname });
      });

      const loaded = page.waitForResponse(
        (response) => response.url().endsWith('.woff') && response.ok(),
      );
      await page.goto(`${origin}/three-scenes/gallery/`);
      await loaded;
      const note = page.getByRole('textbox', { name: 'Write on the wall' });
      const readout = page.locator('.e3-readout');
      await readout.filter({ hasText: /\d+\.\d+ × \d+\.\d+ units/ }).waitFor();
      const previous = await readout.textContent();
      await note.fill('WW');
      await page.waitForFunction(
        (text) => document.querySelector('.e3-readout')?.textContent !== text,
        previous,
      );
      await page.getByRole('button', { name: 'Lights off' }).click();
      await page.getByRole('button', { name: 'Lights on' }).waitFor();

      const canvas = page.locator('effect-three-scene canvas');
      const gallery = await canvas.elementHandle();
      const isDisposed = (node: HTMLElement | SVGElement) =>
        node instanceof HTMLCanvasElement &&
        !node.isConnected &&
        node.getContext('webgl2')?.isContextLost();
      await page.getByRole('link', { name: 'Bowling', exact: true }).click();
      await page.waitForURL('**/three-scenes/bowling/');
      await page.waitForFunction(isDisposed, gallery);
      await readout.filter({ hasText: '10 pins standing' }).waitFor();
      await page.getByRole('slider', { name: 'Speed' }).press('ArrowRight');
      await page.getByRole('button', { name: 'Roll', exact: true }).click();
      const link = page.getByRole('link', { name: 'Link to this game' });
      await link.waitFor();
      const fragment = await link.getAttribute('href');
      expect(fragment).toMatch(/^#replay=.*?,8\.25\|(?:[1-9]|10)$/);

      const bowling = await canvas.elementHandle();
      await page.getByRole('link', { name: 'Away' }).click();
      await page.waitForURL('**/away/');
      await page.waitForFunction(isDisposed, bowling);
      await page.goto(`${origin}/three-scenes/bowling/${fragment}`);
      await readout
        .filter({ hasText: 'Replayed 1 rolls: every one knocked down the same pins' })
        .waitFor();
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  45_000,
);

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  'Workshop releases and reloads its assets, and Room scopes its relay to the island',
  async () => {
    const siteOrigin = 'https://astro-effect-ui.test';
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage();
      const errors: Array<string> = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const models = new URL('../../../apps/three-promo/public/models/', import.meta.url);
      const requests: Array<string> = [];
      await page.route(`${siteOrigin}/**`, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.startsWith('/models/')) {
          requests.push(pathname);
          await route.fulfill({
            path: new URL(pathname.slice('/models/'.length), models).pathname,
          });
          return;
        }
        const path = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        await route.fulfill({ path: new URL(path, output).pathname });
      });

      const texture = page.waitForResponse(
        (response) => response.url().endsWith('tiles.png') && response.ok(),
      );
      const sign = page.waitForResponse(
        (response) => response.url().endsWith('inter-bold.typeface.json') && response.ok(),
      );
      await page.goto(`${siteOrigin}/three-scenes/workshop/`);
      await Promise.all([texture, sign]);
      const readout = page.locator('.e3-readout');
      const ready = readout.filter({ hasText: /^Loaded:.*wave and roll/ });
      await ready.waitFor();
      expect(requests).toEqual(
        expect.arrayContaining([
          '/models/robot-low.glb',
          '/models/robot.glb',
          '/models/tiles-low.png',
          '/models/tiles.png',
          '/models/inter-bold.typeface.json',
        ]),
      );
      const canvas = page.locator('effect-three-scene canvas');
      const original = await canvas.elementHandle();
      await page.getByRole('button', { name: 'Still', exact: true }).press('Enter');
      expect(
        await page.getByRole('button', { name: 'Still', exact: true }).getAttribute('aria-pressed'),
      ).toBe('true');
      await page.getByRole('button', { name: 'Unload' }).click();
      await readout.filter({ hasText: 'Unloaded:' }).waitFor();
      const loadedAgain = page.waitForResponse(
        (response) => response.url().endsWith('/robot.glb') && response.ok(),
      );
      await page.getByRole('button', { name: 'Reload' }).click();
      await loadedAgain;
      await ready.waitFor();
      expect(
        await original.evaluate(
          (node) => node === document.querySelector('effect-three-scene canvas'),
        ),
      ).toBe(true);

      const connected = Promise.withResolvers<WebSocketRoute>();
      const disconnected = Promise.withResolvers<void>();
      const poseSent = Promise.withResolvers<string>();
      await page.routeWebSocket('wss://room-relay.test/room', (socket) => {
        socket.onMessage((message) => poseSent.resolve(String(message)));
        socket.onClose(() => disconnected.resolve());
        connected.resolve(socket);
      });
      await page.goto(`${siteOrigin}/three-scenes/room/?relay=wss%3A%2F%2Froom-relay.test%2Froom`);
      const relay = await connected.promise;
      const room = await canvas.elementHandle();
      const poses = {
        head: { position: [0, 1.6, 0], quaternion: [0, 0, 0, 1] },
        left: null,
        right: null,
      };
      relay.send(JSON.stringify({ _tag: 'Pose', peer: 'another', poses }));
      await readout.filter({ hasText: '1 other player is in the room' }).waitFor();
      await page
        .locator('effect-three-scene')
        .evaluate(
          (node, detail) => node.dispatchEvent(new CustomEvent('scene-xr-poses', { detail })),
          poses,
        );
      expect(await poseSent.promise).toContain('"_tag":"Pose"');
      await page.getByRole('link', { name: 'Away' }).click();
      await page.waitForURL('**/away/');
      await disconnected.promise;
      await page.waitForFunction(
        (node) =>
          node instanceof HTMLCanvasElement &&
          !node.isConnected &&
          node.getContext('webgl2')?.isContextLost(),
        room,
      );
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  45_000,
);

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  'the seven migrated Three demos render and respond to their controls',
  async () => {
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      page.setDefaultTimeout(8000);
      const errors: Array<string> = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const font = new URL(
        '../../../apps/three-promo/public/models/inter-latin-400-normal.woff',
        import.meta.url,
      );
      await page.route(`${origin}/**`, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === '/models/inter-latin-400-normal.woff') {
          await route.fulfill({ path: font.pathname, contentType: 'font/woff' });
          return;
        }
        const path = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        await route.fulfill({ path: new URL(path, output).pathname });
      });

      const stage = page.locator('effect-three-scene');
      const canvas = stage.locator('canvas');
      const go = async (demo: string) => {
        await page.goto(`${origin}/three-scenes/${demo}/`);
        await stage.locator('canvas[data-engine]').waitFor();
        expect(
          await canvas.evaluate(
            (node) =>
              node instanceof HTMLCanvasElement && node.getContext('webgl2')?.isContextLost(),
          ),
        ).toBe(false);
      };

      await page.goto(`${origin}/three-scenes/hero/`);
      await stage.waitFor({ state: 'attached' });
      expect(await canvas.count()).toBe(0);
      await stage.scrollIntoViewIfNeeded();
      await canvas.waitFor();
      await stage.evaluate((node) => {
        node.addEventListener('scene-reconciled', () =>
          node.setAttribute('data-repainted', 'true'),
        );
      });
      await canvas.click();
      await stage.and(page.locator('[data-repainted]')).waitFor();

      await go('city');
      await canvas.hover();
      await page
        .locator('.e3-readout')
        .filter({ hasText: /Building \d+ of 10,000/ })
        .waitFor();
      await page.getByRole('button', { name: 'New city' }).press('Enter');
      await page.locator('.e3-readout').filter({ hasText: 'Hover a building' }).waitFor();

      await go('curves');
      await canvas.scrollIntoViewIfNeeded();
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error('The curve canvas is not visible.');
      await stage.evaluate((node) => {
        node.addEventListener('scene-drag', () => node.setAttribute('data-dragged', 'true'));
      });
      const x = bounds.x + bounds.width / 2;
      const y = bounds.y + bounds.height * 0.594;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 65, y - 30, { steps: 6 });
      await page.mouse.up();
      await stage.and(page.locator('[data-dragged]')).waitFor();
      const dashes = page.getByRole('button', { name: 'Dashed curve' });
      await dashes.press('Enter');
      expect(await dashes.getAttribute('aria-pressed')).toBe('true');

      await go('sculpture');
      await canvas.click();
      await page.getByText(/Showing 4 of 4 pieces/).waitFor();
      await page.getByRole('slider', { name: 'Build history' }).press('Home');
      await page.getByText(/Showing 0 of 4 pieces/).waitFor();
      await page.getByRole('button', { name: 'Redo' }).press('Enter');
      await page.getByText(/Showing 1 of 4 pieces/).waitFor();

      await go('playground');
      const stat = (label: string) =>
        page
          .locator('.e3-stat')
          .filter({ has: page.getByText(label, { exact: true }) })
          .locator('dd');
      await page.getByRole('button', { name: 'Add cube' }).press('Enter');
      await stat('Created').filter({ hasText: /^1$/ }).waitFor();
      await page.getByRole('button', { name: 'Remove cube' }).press('Enter');
      await stat('Removed').filter({ hasText: /^1$/ }).waitFor();

      await go('bars');
      await page.getByText('Data table', { exact: true }).click();
      const table = page.getByRole('table');
      expect(await table.getByRole('columnheader').count()).toBe(4);
      await page.getByRole('button', { name: 'Search' }).press('Enter');
      await table.getByRole('columnheader', { name: 'Search' }).waitFor({ state: 'detached' });
      expect(await table.getByRole('columnheader').count()).toBe(3);

      await go('marbles');
      await page.getByRole('button', { name: 'Reverse' }).press('Enter');
      await stat('Wheel').filter({ hasText: 'anticlockwise' }).waitFor();
      const before = await stat('Gold binned').textContent();
      await page.getByRole('button', { name: 'Pour gold' }).press('Enter');
      await page.waitForFunction(
        (value) =>
          Array.from(document.querySelectorAll('.e3-stat'))
            .find((node) => node.querySelector('dt')?.textContent === 'Gold binned')
            ?.querySelector('dd')?.textContent !== value,
        before,
      );
      const original = await canvas.elementHandle();
      await page.getByRole('link', { name: 'Away' }).click();
      await page.waitForURL('**/away/');
      await page.waitForFunction(
        (node) =>
          node instanceof HTMLCanvasElement &&
          !node.isConnected &&
          node.getContext('webgl2')?.isContextLost(),
        original,
      );
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  75_000,
);

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  'Studio and Arrange render scene overlays and Toybox runs its physics controls',
  async () => {
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      page.setDefaultTimeout(9000);
      const errors: Array<string> = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route(`${origin}/**`, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const path = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        await route.fulfill({ path: new URL(path, output).pathname });
      });
      const stage = page.locator('effect-three-scene');
      const canvas = stage.locator('canvas[data-engine]');
      const readout = page.locator('.e3-readout');
      const go = async (sample: string) => {
        await page.goto(`${origin}/three-scenes/${sample}/`);
        await canvas.waitFor();
      };
      // The real Three stage consumes these structured hits. Choose world points directly
      // so the overlay assertion is independent of the browser's viewport and projection.
      const hit = (key: string, point: readonly [number, number, number]) =>
        stage.evaluate(
          (node, detail) => node.dispatchEvent(new CustomEvent('scene-click', { detail })),
          {
            key,
            point,
            path: [key],
            button: 0,
            distance: 5,
            normal: [0, 1, 0],
            uv: [0.5, 0.5],
            ray: { origin: [0, 5, 4], direction: [0, -1, 0] },
          },
        );

      await go('studio');
      await hit('piece:torus', [0, 1, 0]);
      await readout.filter({ hasText: 'Torus:' }).waitFor();
      const tag = stage.locator('[data-effect-three-overlay="selected-tag"]');
      await tag.waitFor();
      expect(await tag.textContent()).toContain('Torus');
      const originalPlacement = await tag.evaluate(
        (node) => node instanceof HTMLElement && node.style.transform,
      );
      await page.getByLabel('Studio scene.', { exact: false }).press('ArrowLeft');
      await page.waitForFunction((transform) => {
        const tag = document.querySelector('[data-effect-three-overlay="selected-tag"]');
        return tag instanceof HTMLElement && tag.style.transform !== transform;
      }, originalPlacement);
      await page.getByRole('button', { name: 'Orthographic camera' }).press('Enter');
      await page.getByRole('button', { name: 'Split view' }).waitFor();

      await go('arrange');
      const position = page.getByRole('spinbutton', { name: 'placement position x', exact: true });
      await position.fill('1.25');
      await position.press('Tab');
      await readout.filter({ hasText: 'crate: at 1.25' }).waitFor();
      await page.getByRole('button', { name: 'Undo' }).press('Enter');
      await readout.filter({ hasText: 'crate: at -1.50' }).waitFor();
      await page.getByRole('button', { name: 'Redo' }).press('Enter');
      await readout.filter({ hasText: 'crate: at 1.25' }).waitFor();
      await page.getByRole('button', { name: 'Measure' }).press('Enter');
      await hit('table', [-0.5, 0, 0]);
      await hit('table', [0.5, 0, 0]);
      await readout.filter({ hasText: '1.00 units between the ends' }).waitFor();
      const tape = stage.locator('[data-effect-three-overlay="tape:label"]');
      await tape.waitFor();
      expect(await tape.textContent()).toBe('1.00 units');

      await go('toybox');
      const originalToys = (await readout.textContent())?.match(/^(\d+) toys/)?.[1];
      if (originalToys === undefined) throw new Error('Toybox did not show a toy count.');
      await page.getByRole('button', { name: 'Drop a toy' }).press('Enter');
      await readout.filter({ hasText: new RegExp(`^${Number(originalToys) + 1} toys`) }).waitFor();
      await page.getByRole('button', { name: 'Pour marbles' }).press('Enter');
      await readout.filter({ hasText: '16 marbles' }).waitFor();
      const original = await canvas.elementHandle();
      await page.getByRole('link', { name: 'Away' }).click();
      await page.waitForURL('**/away/');
      await page.waitForFunction(
        (node) =>
          node instanceof HTMLCanvasElement &&
          !node.isConnected &&
          node.getContext('webgl2')?.isContextLost(),
        original,
      );
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  60_000,
);

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  'Shared Resources keeps its canvas across edits and releases it on unmount',
  async () => {
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      page.setDefaultTimeout(9000);
      await page.route(`${origin}/**`, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const path = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        await route.fulfill({ path: new URL(path, output).pathname });
      });
      await page.goto(`${origin}/three-scenes/shared/`);
      const ready = page.getByText('Scene running.', { exact: false });
      await ready.waitFor();
      const canvas = page.locator('effect-three-scene canvas[data-engine]');
      const original = await canvas.elementHandle();
      await page.getByRole('button', { name: 'Grow cubes' }).press('Enter');
      await page.getByRole('button', { name: 'Shrink cubes' }).waitFor();
      await page.getByRole('button', { name: 'Remove right cube' }).press('Enter');
      await page.getByRole('button', { name: 'Add right cube' }).waitFor();
      expect(await canvas.evaluate((current, before) => current === before, original)).toBe(true);
      await page.getByRole('button', { name: 'Unmount scene' }).press('Enter');
      await page.getByText('Scene unmounted:', { exact: false }).waitFor();
      await page.waitForFunction(
        (node) =>
          node instanceof HTMLCanvasElement &&
          !node.isConnected &&
          node.getContext('webgl2')?.isContextLost(),
        original,
      );
      await page.getByRole('button', { name: 'Mount scene' }).press('Enter');
      await ready.waitFor();
      expect(await canvas.evaluate((current, before) => current !== before, original)).toBe(true);
      expect(
        await canvas.evaluate(
          (node) => node instanceof HTMLCanvasElement && node.getContext('webgl2')?.isContextLost(),
        ),
      ).toBe(false);
      await page.getByRole('button', { name: 'Shrink cubes' }).waitFor();
      await page.getByRole('button', { name: 'Add right cube' }).waitFor();
    } finally {
      await browser.close();
    }
  },
  45_000,
);

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  'Tabletop peers agree with worker physics and replay a recorded throw',
  async () => {
    const siteOrigin = 'https://astro-effect-ui.test';
    const tabletop = `${siteOrigin}/three-scenes/tabletop/`;
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      // The scene host pauses physics with reduced motion.
      const context = await browser.newContext({ reducedMotion: 'no-preference' });
      context.setDefaultTimeout(15_000);
      await context.route(`${siteOrigin}/**`, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const path = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        await route.fulfill({ path: new URL(path, output).pathname });
      });
      const main = await context.newPage();
      const workerPage = await context.newPage();
      const errors: Array<string> = [];
      for (const page of [main, workerPage]) {
        page.on('pageerror', (error) => errors.push(error.message));
      }
      await main.goto(tabletop);
      await main.locator('.e3-together').filter({ hasText: 'Playing alone.' }).waitFor();
      const workerStarted = workerPage.waitForEvent('worker');
      await workerPage.goto(`${tabletop}?physics=worker&predict=1`);
      const worker = await workerStarted;
      for (const page of [main, workerPage]) {
        await page
          .locator('.e3-together')
          .filter({ hasText: 'Playing with 1 other player' })
          .waitFor();
        await page
          .locator('.e3-agreement')
          .filter({ hasText: /[1-9]\d* checks? agreed/ })
          .waitFor();
      }
      const agreement = await workerPage.locator('.e3-agreement').textContent();
      const beforeThrow = Number(agreement?.match(/(\d+) checks? agreed/)?.[1]);
      await main.locator('effect-three-scene canvas').click();
      for (const page of [main, workerPage]) {
        await page
          .locator('.e3-readout')
          .filter({ hasText: /^1 balls on the table/ })
          .waitFor();
      }
      await main.waitForFunction(() => {
        const fragment = document.querySelector('.e3-replay-link')?.getAttribute('href');
        if (!fragment?.startsWith('#replay=')) return false;
        const encoded = fragment.slice('#replay='.length).replaceAll('-', '+').replaceAll('_', '/');
        // SAFETY: Tabletop generated this link by encoding its replay record schema.
        const record = JSON.parse(atob(encoded)) as { inputs: Array<{ input: { _tag: string } }> };
        return record.inputs.some(({ input }) => input._tag === 'Throw');
      });
      await workerPage.waitForFunction((before) => {
        const report = document.querySelector('.e3-agreement')?.textContent;
        const matched = Number(report?.match(/(\d+) checks? agreed/)?.[1]);
        return matched >= before + 2;
      }, beforeThrow);
      const fragment = await main
        .getByRole('link', { name: 'Replay this game' })
        .getAttribute('href');
      expect(fragment).toStartWith('#replay=');
      const workerStopped = worker.waitForEvent('close');
      await workerPage.getByRole('link', { name: 'Away' }).click();
      await workerPage.waitForURL('**/away/');
      await workerStopped;
      await main.close();
      await workerPage.goto(`${tabletop}${fragment}`);
      const readout = workerPage.locator('.e3-readout');
      await readout.filter({ hasText: 'Replay finished at step' }).waitFor({ timeout: 40_000 });
      const verdict = await workerPage.locator('.e3-agreement').textContent();
      expect(verdict).toMatch(/(\d+) of the record's \1 checks matched/);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  85_000,
);

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  'Tabletop opens a new relay after a loss and closes it on navigation',
  async () => {
    const siteOrigin = 'https://astro-effect-ui.test';
    const relayUrl = 'wss://tabletop-relay.test/session';
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      const transcript: Array<string> = [];
      const disconnected = Promise.withResolvers<void>();
      const sockets: Array<WebSocketRoute> = [];
      await page.route(`${siteOrigin}/**`, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const path = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        await route.fulfill({ path: new URL(path, output).pathname });
      });
      await page.routeWebSocket(relayUrl, (socket) => {
        sockets.push(socket);
        socket.onMessage((raw) => {
          const text = String(raw);
          if (text.includes('"_tag":"Hello"')) transcript.push(text);
        });
        if (sockets.length === 2) socket.onClose(() => disconnected.resolve());
      });
      await page.goto(`${siteOrigin}/three-scenes/tabletop/?relay=${encodeURIComponent(relayUrl)}`);
      const linked = page
        .locator('.e3-together')
        .filter({ hasText: 'Playing alone, through the relay' });
      await linked.waitFor();
      expect(transcript).toHaveLength(1);
      await sockets[0]?.close();
      await page.getByRole('button', { name: 'Reconnect' }).press('Enter');
      await linked.waitFor();
      expect(transcript).toHaveLength(2);
      expect(transcript[1]).not.toEqual(transcript[0]);
      await page.getByRole('link', { name: 'Away' }).click();
      await page.waitForURL('**/away/');
      await disconnected.promise;
    } finally {
      await browser.close();
    }
  },
  45_000,
);

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  'Three Editor shares inspector edits, undo, and an opened scene between tabs',
  async () => {
    const siteOrigin = 'https://astro-effect-ui.test';
    const editor = `${siteOrigin}/three-scenes/editor/`;
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      context.setDefaultTimeout(15_000);
      await context.route(`${siteOrigin}/**`, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const path = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        await route.fulfill({ path: new URL(path, output).pathname });
      });
      const first = await context.newPage();
      const second = await context.newPage();
      const errors: Array<string> = [];
      const pages = [first, second];
      for (const page of pages) page.on('pageerror', (error) => errors.push(error.message));
      await first.goto(editor);
      await first.getByText('Editing alone.', { exact: false }).waitFor();
      await second.goto(editor);
      for (const page of pages) {
        await page.getByText('Editing with 1 other tab.', { exact: true }).waitFor();
        await page.locator('effect-three-scene canvas[data-engine]').waitFor();
      }
      await first.getByRole('button', { name: '+ Cone', exact: true }).press('Enter');
      for (const page of pages) {
        await page.locator('.e3-outline-row').filter({ hasText: 'cone-1' }).waitFor();
        await page.locator('.e3-outline-row').filter({ hasText: 'light-1' }).press('Enter');
      }
      const intensity = first.getByRole('spinbutton', { name: 'intensity', exact: true });
      const original = await intensity.inputValue();
      await intensity.fill('20');
      await intensity.press('Tab');
      for (const page of pages) {
        await page
          .getByRole('button', { name: 'Edited light-1 intensity', exact: true })
          .and(page.locator('[aria-current="step"]'))
          .waitFor();
        expect(
          await page.getByRole('spinbutton', { name: 'intensity', exact: true }).inputValue(),
        ).toBe('20');
      }
      await second.getByRole('button', { name: 'Undo', exact: true }).press('Enter');
      for (const page of pages) {
        await page
          .getByRole('button', { name: /Added cone/ })
          .and(page.locator('[aria-current="step"]'))
          .waitFor();
        expect(
          await page.getByRole('spinbutton', { name: 'intensity', exact: true }).inputValue(),
        ).toBe(original);
      }
      await first.getByRole('button', { name: 'Redo', exact: true }).press('Enter');
      await second
        .getByRole('button', { name: 'Edited light-1 intensity', exact: true })
        .and(second.locator('[aria-current="step"]'))
        .waitFor();
      const saved = first.waitForEvent('download');
      await first.getByRole('button', { name: 'Save', exact: true }).press('Enter');
      const download = await saved;
      expect(download.suggestedFilename()).toBe('scene.json');
      const contents = await readFile(await download.path());
      await first.locator('input[type="file"]').setInputFiles({
        name: 'broken.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{}'),
      });
      await first.getByRole('alert').filter({ hasText: 'That file is not a scene' }).waitFor();
      await second.getByRole('button', { name: 'Delete', exact: true }).press('Enter');
      await first
        .locator('.e3-outline-row')
        .filter({ hasText: 'light-1' })
        .waitFor({ state: 'detached' });
      await first.locator('input[type="file"]').setInputFiles({
        name: 'scene.json',
        mimeType: 'application/json',
        buffer: contents,
      });
      for (const page of pages) {
        await page
          .getByRole('button', { name: 'Opened a file', exact: true })
          .and(page.locator('[aria-current="step"]'))
          .waitFor();
        await page.locator('.e3-outline-row').filter({ hasText: 'light-1' }).press('Enter');
        expect(
          await page.getByRole('spinbutton', { name: 'intensity', exact: true }).inputValue(),
        ).toBe('20');
      }
      const withoutWebGl = await context.newPage();
      await withoutWebGl.addInitScript(() => {
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null });
      });
      withoutWebGl.on('pageerror', (error) => errors.push(error.message));
      const rendererFailed = withoutWebGl.waitForEvent('console', {
        predicate: (message) => message.text().includes('Error creating WebGL context'),
      });
      await withoutWebGl.goto(editor);
      await rendererFailed;
      await withoutWebGl.getByText('Editing with 2 other tabs.', { exact: true }).waitFor();
      await withoutWebGl.getByRole('button', { name: '+ Ring', exact: true }).press('Enter');
      await second.locator('.e3-outline-row').filter({ hasText: 'ring-1' }).waitFor();
      const canvas = await first.locator('effect-three-scene canvas').elementHandle();
      await first.getByRole('link', { name: 'Away' }).click();
      await first.waitForURL('**/away/');
      await first.waitForFunction(
        (element) =>
          element instanceof HTMLCanvasElement &&
          !element.isConnected &&
          element.getContext('webgl2')?.isContextLost(),
        canvas,
      );
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  60_000,
);

test.skipIf(process.env.ASTRO_EFFECT_UI_BROWSER !== '1')(
  '3D Radar restores a deep link and records, saves, and plays a tour',
  async () => {
    const siteOrigin = 'https://astro-effect-ui.test';
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      page.setDefaultTimeout(15_000);
      const errors: Array<string> = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const models = new URL('../../../apps/web/public/models/', import.meta.url);
      await page.route(`${siteOrigin}/**`, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.startsWith('/models/')) {
          await route.fulfill({
            path: new URL(pathname.slice('/models/'.length), models).pathname,
          });
          return;
        }
        const path = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        await route.fulfill({ path: new URL(path, output).pathname });
      });
      await page.addInitScript(() => localStorage.setItem('radar-theme', 'blueprint'));
      await page.goto(`${siteOrigin}/three-scenes/radar/`);
      const canvas = page.locator('effect-three-scene canvas[data-engine]');
      await canvas.waitFor();
      const app = page.locator('.e3-app');
      const dropdown = page.getByRole('combobox', { name: 'Theme', exact: true });
      await page
        .locator('.e3-stage-readout')
        .filter({ hasText: /Foldkit/i })
        .waitFor();
      expect(await app.getAttribute('data-theme')).toBe('paper');
      expect(await dropdown.inputValue()).toBe('paper');
      const minimap = page.getByRole('img', { name: 'Minimap of the radar from above' });
      expect(await minimap.evaluate((node) => node.namespaceURI)).toBe(
        'http://www.w3.org/2000/svg',
      );
      expect(await minimap.getAttribute('viewBox')).toBe('-1.08 -1.08 2.16 2.16');
      await minimap.locator('path[aria-label="Fly to Tools"]').dispatchEvent('click');
      await page.waitForURL((url) => url.searchParams.get('view') === 'cluster:tools');

      const search = page.getByRole('searchbox', { name: 'Search entries' });
      const chooser = page.getByRole('combobox', { name: 'Category' });
      await chooser.selectOption('techniques');
      await page.waitForURL((url) => url.searchParams.get('category') === 'techniques');
      await page.getByRole('button', { name: 'Clear filters' }).press('Enter');
      await page.waitForURL((url) => !url.searchParams.has('category'));
      expect(await chooser.inputValue()).toBe('all');
      const timeline = page.getByRole('region', { name: 'Timeline' });
      const edition = timeline.getByRole('slider', { name: 'Edition' });
      await timeline.getByRole('button', { name: 'Play', exact: true }).press('Enter');
      await page.waitForFunction(
        () => document.querySelector<HTMLInputElement>('.e3-range')?.value !== '0',
      );
      expect(await edition.inputValue()).not.toBe('0');

      const tour = page.getByRole('region', { name: 'Tour' });
      await tour.getByRole('button', { name: '● Record' }).press('Enter');
      await search.fill('effect');
      await page.waitForURL((url) => url.searchParams.get('q') === 'effect');
      await dropdown.selectOption('blueprint');
      await page.waitForURL((url) => url.searchParams.get('theme') === 'blueprint');
      expect(await page.evaluate(() => localStorage.getItem('radar-theme'))).toBe('blueprint');
      await tour.getByRole('button', { name: '■ Stop', exact: true }).press('Enter');
      await tour.getByText('2 moves ready').waitFor();
      const saving = page.waitForEvent('download');
      await tour.getByRole('button', { name: 'Save', exact: true }).press('Enter');
      const download = await saving;
      expect(download.suggestedFilename()).toMatch(/^radar-tour-.*\.json$/);
      const recording = await readFile(await download.path());
      const picking = page.waitForEvent('filechooser');
      await tour.getByRole('button', { name: 'Load…', exact: true }).click();
      const picker = await picking;
      await picker.setFiles({ name: 'tour.json', mimeType: 'application/json', buffer: recording });
      await page.locator('.e3-stage-readout').filter({ hasText: 'Tour loaded' }).waitFor();
      await tour.getByRole('button', { name: '▶ Play', exact: true }).press('Enter');
      await tour.getByText('2 moves ready').waitFor();
      expect(await search.inputValue()).toBe('effect');
      expect(await dropdown.inputValue()).toBe('blueprint');

      await tour.getByRole('button', { name: '● Record' }).focus();
      for (const key of [
        'ArrowUp',
        'ArrowUp',
        'ArrowDown',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'ArrowLeft',
        'ArrowRight',
        'b',
        'a',
      ]) {
        await page.keyboard.press(key);
      }
      await page.locator('.e3-stage-readout').filter({ hasText: "Conway's Law" }).waitFor();

      const original = await canvas.elementHandle();
      await page.getByRole('link', { name: 'Away' }).click();
      await page.waitForURL('**/away/');
      await page.waitForFunction(
        (node) =>
          node instanceof HTMLCanvasElement &&
          !node.isConnected &&
          node.getContext('webgl2')?.isContextLost(),
        original,
      );
      await page.goto(`${siteOrigin}/three-scenes/radar-default/`);
      await page.locator('.e3-app[data-theme="blueprint"]').waitFor();
      expect(await dropdown.inputValue()).toBe('blueprint');
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  75_000,
);
