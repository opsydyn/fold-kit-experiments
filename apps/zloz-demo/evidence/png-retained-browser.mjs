import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const { PNG } = createRequire(
  new URL('../../../packages/effect-three/package.json', import.meta.url),
)('pngjs');
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const core = resolve(
  fileURLToPath(new URL('../../../packages/foldkit-zloz/dist/', import.meta.url)),
);
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  const base = route.startsWith('/__png/') ? core : root;
  const path = resolve(
    base,
    '.' + (route.startsWith('/__png/') ? route.slice(6) : route === '/' ? '/index.html' : route),
  );
  if (!path.startsWith(base + sep)) {
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
    colorScheme: 'light',
  });
  page.setDefaultTimeout(15000);
  const errors = [],
    external = [];
  const base = `http://127.0.0.1:${server.address().port}`;
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (
      !request.url().startsWith(base) &&
      !request.url().startsWith('data:') &&
      !request.url().startsWith('blob:')
    )
      external.push(request.url());
  });
  const evidence = (file) => fileURLToPath(new URL(file, import.meta.url));
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const action = (name) => page.locator(`[data-zloz-png-action="${name}"]`);
  const accept = () =>
    page.getByRole('checkbox', { name: 'Accept the reported PNG losses', exact: true });
  const preview = () => page.getByRole('img', { name: 'PNG export preview' });
  const toggle = () =>
    page.getByRole('checkbox', { name: 'Use retained layout in PNG', exact: true });
  const model = async () => {
    await section('History');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return await readFile(await file.path(), 'utf8');
  };
  const render = async () => {
    await accept().check();
    await action('render').click();
    await expect(preview()).toBeVisible();
    await expect(action('download')).toBeEnabled();
  };
  const download = async (file) => {
    const uri = await preview().getAttribute('src');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      action('download').click(),
    ]);
    const bytes = await readFile(await download.path());
    expect(bytes.equals(Buffer.from(uri.split(',')[1], 'base64'))).toBe(true);
    if (file) await writeFile(evidence(file), bytes);
    return PNG.sync.read(bytes);
  };
  await page.goto(base);
  await page.locator('[data-flow-node="review"]').waitFor();
  await section('PNG export');
  await expect(toggle()).not.toBeChecked();
  await toggle().focus();
  await page.keyboard.press('Space');
  await expect(toggle()).toBeChecked();
  await expect(toggle()).toBeFocused();
  await expect(action('render')).toBeDisabled();
  await expect(
    page.getByText('Arrange with ELK before reviewing retained routes.', { exact: true }),
  ).toBeVisible();
  await toggle().uncheck();
  await section('Diagram');
  await button('Open C4 container view').click();
  await button('Arrange with ELK').click();
  await expect(page.getByText('Layout applied.', { exact: true })).toBeVisible();
  const before = await model();
  await section('PNG export');
  await toggle().check();
  await expect(
    page.getByText('Retained routes are included. PNG still flattens vector and label artwork.', {
      exact: true,
    }),
  ).toBeVisible();
  await render();
  const light = await download('png-retained-workbench.png');
  await toggle().scrollIntoViewIfNeeded();
  await page.screenshot({ path: evidence('png-retained-workbench-light.png') });
  // A new host theme invalidates source-theme consent and the old image.
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await expect(preview()).toHaveCount(0);
  await expect(accept()).not.toBeChecked();
  await render();
  const dark = await download('png-retained-workbench-dark-output.png');
  await toggle().scrollIntoViewIfNeeded();
  await page.screenshot({ path: evidence('png-retained-workbench-dark.png') });
  // SVG has its own opt-in, and the graph/edition lineage is untouched.
  await section('SVG export');
  await expect(
    page.getByRole('checkbox', { name: 'Use retained layout in SVG', exact: true }),
  ).not.toBeChecked();
  await section('PNG export');
  await toggle().uncheck();
  await expect(preview()).toHaveCount(0);
  await expect(accept()).not.toBeChecked();
  expect(await model()).toBe(before);

  // Exercise public browser/core APIs with a centre-anchored vector badge fixture.
  const native = await page.evaluate(async () => {
    const {
      createEditor,
      captureSvgLayout,
      writeSvgExport,
      planPngExport,
      createPngReview,
      resolvePngReview,
      updatePngReview,
    } = await import('/__png/index.mjs');
    const { renderPngExport } = await import('/__png/browser.mjs');
    const graph = {
      nodes: [
        {
          id: 'orders',
          label: 'Order platform',
          position: { x: 40, y: 220 },
          size: { width: 240, height: 140 },
          ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
        },
        {
          id: 'pricing',
          label: 'Pricing service',
          position: { x: 620, y: 220 },
          size: { width: 240, height: 140 },
          ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
        },
      ],
      edges: [
        {
          id: 'reads',
          source: { node: 'orders', port: 'out' },
          target: { node: 'pricing', port: 'in' },
          label: 'Reads\nmodel',
        },
      ],
    };
    const editor = {
      ...createEditor(graph),
      routes: [
        {
          id: 'reads',
          points: [
            { x: 280, y: 290 },
            { x: 400, y: 290 },
            { x: 400, y: 100 },
            { x: 620, y: 100 },
            { x: 620, y: 290 },
          ],
          label: { position: { x: 505, y: 100 }, size: { width: 160, height: 52 } },
        },
      ],
    };
    const layout = { snapshot: captureSvgLayout(editor, 'vector-v1'), renderKey: 'vector-v1' };
    const options = {
      title: 'Retained PNG badge',
      region: { type: 'model', padding: 32 },
      theme: { colorScheme: 'light' },
      background: { type: 'theme' },
      font: { family: 'sans-serif', size: 14, weight: 400 },
      renderers: { nodes: 'built-in', edges: 'built-in' },
      layout,
    };
    const adapter = {
      id: 'badge',
      version: '1',
      render: (context) => {
        if (context.kind !== 'edge' || !context.layoutRoute || !context.labelBox)
          throw new Error('Missing retained vector context');
        const { position, size } = context.labelBox;
        return [
          {
            type: 'polyline',
            points: context.layoutRoute.points,
            fill: 'none',
            stroke: context.theme.tokens.edge,
            strokeWidth: 3,
          },
          {
            type: 'rect',
            position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
            width: size.width,
            height: size.height,
            radius: 8,
            fill: '#e24455',
            stroke: context.theme.tokens.nodeBorder,
            strokeWidth: 1,
          },
          {
            type: 'text',
            position: { x: position.x, y: position.y - 8.75 },
            text: context.edge.label,
            anchor: 'middle',
            baseline: 'middle',
            fill: '#ffffff',
          },
        ];
      },
    };
    const custom = {
      ...options,
      renderers: {
        ...options.renderers,
        overrides: [
          {
            target: { kind: 'edge', id: 'reads' },
            renderer: {
              type: 'svg',
              id: 'badge',
              version: '1',
              bounds: { x: 280, y: 74, width: 340, height: 216 },
              fidelity: 'equivalent',
              reason: 'Explicit vector fixture; declaration remains unverified',
            },
          },
        ],
      },
    };
    const writing = { allowLosses: true, adapters: [adapter] };
    const input = { snapshot: editor, svg: custom, writing };
    const results = {};
    const written = writeSvgExport(editor, custom, writing);
    results.light = await renderPngExport({ ...input, expectedSvg: written.svg });
    results.dark = await renderPngExport({
      ...input,
      svg: { ...custom, theme: { colorScheme: 'dark' } },
    });
    results.transparent = await renderPngExport({
      ...input,
      svg: { ...custom, background: { type: 'transparent' }, scale: 2 },
    });
    const canonicalPlan = planPngExport(
      writeSvgExport(editor, { ...options, layout: undefined }, { allowLosses: true }),
      { maxPixels: 200000 },
    );
    const retainedPlan = planPngExport(writeSvgExport(editor, options, { allowLosses: true }), {
      maxPixels: 200000,
    });
    const create = URL.createObjectURL,
      make = document.createElement.bind(document);
    let urls = 0,
      canvases = 0;
    URL.createObjectURL = (...args) => {
      urls++;
      return create.apply(URL, args);
    };
    document.createElement = (...args) => {
      if (args[0] === 'canvas') canvases++;
      return make(...args);
    };
    // oxlint-disable-next-line linteffect/no-try-catch -- Test-only native allocation instrumentation must always be restored.
    try {
      results.budget = await renderPngExport({
        snapshot: editor,
        svg: options,
        writing: { allowLosses: true },
        png: { maxPixels: 200000 },
      });
      results.staleSvg = await renderPngExport({ ...input, expectedSvg: written.svg + ' changed' });
      results.staleKey = await renderPngExport({
        ...input,
        svg: { ...custom, layout: { ...layout, renderKey: 'v2' } },
      });
    } finally {
      URL.createObjectURL = create;
      document.createElement = make;
    }
    // Real rendered bytes delivered after a changed review may not publish.
    const context = {
      scope: 'browser-job',
      sourceRevision: 0,
      snapshot: editor,
      title: options.title,
      theme: options.theme,
      renderers: custom.renderers,
      writing: { adapters: [adapter] },
      layout,
    };
    const state = createPngReview(context.scope),
      view = resolvePngReview(state, context);
    const accepted = updatePngReview(state, context, {
      ...view.identity,
      type: 'PngLossAcceptanceChanged',
      accepted: true,
    }).state;
    const started = updatePngReview(accepted, context, {
      ...view.identity,
      type: 'PngRenderRequested',
    });
    const rendered = await renderPngExport(started.payload.input);
    const changed = { ...context, layout: undefined };
    const late = updatePngReview(started.state, changed, {
      ...view.identity,
      type: 'PngRenderSettled',
      run: started.payload.run,
      result: rendered,
    });
    const cancelled = updatePngReview(started.state, context, {
      ...view.identity,
      type: 'PngRenderCancelled',
    }).state;
    const ignored = updatePngReview(cancelled, context, {
      ...view.identity,
      type: 'PngRenderSettled',
      run: started.payload.run,
      result: rendered,
    });
    return {
      results,
      urls,
      canvases,
      canonicalBudget: canonicalPlan.type,
      retainedBudget: retainedPlan.type,
      lateArtifact: resolvePngReview(late.state, changed).artifact,
      cancelledArtifact: resolvePngReview(ignored.state, context).artifact,
    };
  });
  expect(native.urls).toBe(0);
  expect(native.canvases).toBe(0);
  expect(native.canonicalBudget).toBe('ready');
  expect(native.retainedBudget).toBe('blocked');
  expect(native.results.budget.code).toBe('plan-blocked');
  expect(native.results.staleSvg.code).toBe('source-changed');
  expect(native.results.staleKey.code).toBe('plan-blocked');
  expect(native.lateArtifact).toBeNull();
  expect(native.cancelledArtifact).toBeNull();
  const samples = [];
  for (const name of ['light', 'dark', 'transparent']) {
    const result = native.results[name];
    expect(result.type).toBe('rendered');
    const bytes = Buffer.from(result.artifact.dataUrl.split(',')[1], 'base64');
    const png = PNG.sync.read(bytes),
      scale = name === 'transparent' ? 2 : 1;
    expect(png.width).toBe(884 * scale);
    expect(png.height).toBe(350 * scale);
    const at = (38 * scale * png.width + 422 * scale) * 4;
    expect([...png.data.slice(at, at + 4)]).toEqual([226, 68, 85, 255]);
    if (name === 'transparent') expect(png.data[3]).toBe(0);
    await writeFile(evidence(`png-retained-badge-${name}.png`), bytes);
    samples.push({
      name,
      width: png.width,
      height: png.height,
      bytes: bytes.length,
      badgeRgba: [...png.data.slice(at, at + 4)],
    });
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  console.log(
    JSON.stringify({
      browser: browser.version(),
      workbench: {
        light: { width: light.width, height: light.height },
        dark: { width: dark.width, height: dark.height },
      },
      samples,
      checks:
        'keyboard/default, missing routes, independent SVG setting, theme/setting invalidation, exact PNG download bytes, source/lineage unchanged, vector badge pixels, transparency/2x, stale/late/cancel suppression, no URL/canvas allocation for budget/stale failures',
      blockedAllocation: { urls: native.urls, canvases: native.canvases },
      pageErrors: errors,
      externalRequests: external,
    }),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
