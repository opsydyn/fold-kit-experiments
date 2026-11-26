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
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const evidence = (file) => fileURLToPath(new URL(file, import.meta.url));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('[data-flow-node="review"]').waitFor();
  await page
    .getByRole('navigation', { name: 'Workbench sections' })
    .getByRole('button', { name: 'PNG export', exact: true })
    .click();
  const action = (name) => page.locator(`[data-zloz-png-action="${name}"]`);
  const accept = () =>
    page.getByRole('checkbox', { name: 'Accept the reported PNG losses', exact: true });
  const preview = () => page.getByRole('img', { name: 'PNG export preview' });
  await expect(action('render')).toBeDisabled();
  await expect(action('download')).toBeDisabled();
  await expect(page.getByRole('list', { name: 'PNG findings' })).toContainText('flattens');
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
    expect(download.suggestedFilename()).toBe('zloz-workbench.png');
    if (file) await writeFile(evidence(file), bytes);
    return { bytes, png: PNG.sync.read(bytes) };
  };
  // Hold only the next rasterizer decode so Cancel must interrupt its live command.
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      if (!this.src.startsWith('blob:')) return decode.call(this);
      HTMLImageElement.prototype.decode = decode;
      const url = this.src;
      const revoke = URL.revokeObjectURL;
      URL.revokeObjectURL = (released) => {
        revoke(released);
        if (released === url) {
          URL.revokeObjectURL = revoke;
          document.documentElement.dataset.pngTestReleased = 'true';
        }
      };
      document.documentElement.dataset.pngTestDecoding = 'true';
      return new Promise(() => {});
    };
  });
  await accept().check();
  await action('render').click();
  await expect(page.locator('html')).toHaveAttribute('data-png-test-decoding', 'true');
  await action('cancel').click();
  await expect(page.locator('html')).toHaveAttribute('data-png-test-released', 'true', {
    timeout: 3000,
  });
  await expect(preview()).toHaveCount(0);
  await expect(action('download')).toBeDisabled();
  await render();
  const light = await download('png-export-model.png');
  expect(light.png.data[3]).toBe(255);
  const surface = await page.locator('[data-flow-surface]').boundingBox();
  expect(surface.x).toBeGreaterThan(350);
  expect(surface.width).toBeGreaterThan(1000);
  await page.getByRole('combobox', { name: 'PNG region', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: evidence('png-export-light.png') });
  await page.getByRole('checkbox', { name: 'Protect PNG exports', exact: true }).check();
  await expect(action('download')).toBeDisabled();
  await expect(page.getByRole('group', { name: 'PNG export review', exact: true })).toContainText(
    'protected',
  );
  await page.getByRole('checkbox', { name: 'Protect PNG exports', exact: true }).uncheck();
  await expect(action('download')).toBeEnabled();
  const choose = async (name, value) => {
    const review = page.locator('[data-zloz-png-review]');
    const before = await review.getAttribute('data-zloz-png-generation');
    await page.getByRole('combobox', { name, exact: true }).selectOption(value);
    await expect(review).not.toHaveAttribute('data-zloz-png-generation', before);
  };
  await choose('PNG region', 'viewport');
  await expect(preview()).toHaveCount(0);
  await expect(accept()).not.toBeChecked();
  await choose('PNG theme', 'dark');
  await choose('PNG background', 'transparent');
  await choose('PNG scale', '2');
  await render();
  const crop = await download('png-export-viewport.png');
  const measured = await page
    .locator('[data-flow-surface]')
    .evaluate((el) => ({ width: el.clientWidth, height: el.clientHeight }));
  expect(crop.png.width).toBe(measured.width * 2);
  expect(crop.png.height).toBe(measured.height * 2);
  expect(crop.png.data.some((byte, index) => index % 4 === 3 && byte === 0)).toBe(true);
  await page.getByRole('button', { name: 'Use custom PNG controls', exact: true }).click();
  await expect(action('download')).toHaveText('↓ Save reviewed PNG');
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  // Explicit dark export remains the same while the surrounding host changes.
  await expect(action('download')).toBeEnabled();
  await action('download').scrollIntoViewIfNeeded();
  await page.screenshot({ path: evidence('png-export-dark-custom.png') });
  await page
    .getByRole('navigation', { name: 'Workbench sections' })
    .getByRole('button', { name: 'Diagnostics', exact: true })
    .click();
  await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Workbench sections' })
    .getByRole('button', { name: 'PNG export', exact: true })
    .click();
  await expect(page.locator('[data-zloz-png-readout]')).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'PNG findings' })).toContainText('flattens');
  await expect(action('download')).toBeEnabled();
  await action('download').scrollIntoViewIfNeeded();
  await page.screenshot({ path: evidence('png-export-minimal.png') });
  await page
    .getByRole('navigation', { name: 'Workbench sections' })
    .getByRole('button', { name: 'Diagram', exact: true })
    .click();
  const nodeCount = await page.locator('[data-flow-node]').count();
  await page.getByRole('button', { name: 'Insert C4 context pattern', exact: true }).click();
  await expect.poll(() => page.locator('[data-flow-node]').count()).toBeGreaterThan(nodeCount);
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
  await expect(page.locator('[data-flow-node]')).toHaveCount(nodeCount);
  await page
    .getByRole('navigation', { name: 'Workbench sections' })
    .getByRole('button', { name: 'PNG export', exact: true })
    .click();
  await expect(accept()).not.toBeChecked();
  await expect(preview()).toHaveCount(0);
  await expect(action('download')).toBeDisabled();
  // Native browser entry: real successful encoding, data/alpha/custom adapter, failure/timeout/abort cleanup.
  const native = await page.evaluate(async () => {
    const { renderPngExport } = await import('/__png/browser.mjs');
    const input = {
      snapshot: {
        graph: {
          nodes: [
            {
              id: 'n',
              label: 'Hello',
              position: { x: 10, y: 10 },
              size: { width: 100, height: 60 },
              ports: [],
            },
          ],
          edges: [],
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      svg: {
        title: 'Native',
        region: { type: 'bounds', bounds: { x: 0, y: 0, width: 120, height: 80 } },
        theme: { colorScheme: 'light' },
        background: { type: 'transparent' },
        font: { family: 'sans-serif', size: 14, weight: 400 },
        renderers: { nodes: 'built-in', edges: 'built-in' },
      },
      writing: { allowLosses: true },
    };
    const create = URL.createObjectURL,
      revoke = URL.revokeObjectURL,
      originalCreateElement = document.createElement,
      make = originalCreateElement.bind(document),
      toBlob = HTMLCanvasElement.prototype.toBlob;
    const urls = new Set(),
      canvases = [];
    URL.createObjectURL = function (blob) {
      const url = create.call(URL, blob);
      urls.add(url);
      return url;
    };
    URL.revokeObjectURL = function (url) {
      urls.delete(url);
      revoke.call(URL, url);
    };
    document.createElement = function (...args) {
      const el = make(...args);
      if (args[0] === 'canvas') canvases.push(el);
      return el;
    };
    const results = {};
    // oxlint-disable-next-line linteffect/no-try-catch -- Test-only native method instrumentation must restore globals even if a qualification fails.
    try {
      results.consent = await renderPngExport({ ...input, writing: {} });
      results.success = await renderPngExport(input);
      const custom = {
        ...input,
        svg: {
          ...input.svg,
          renderers: {
            ...input.svg.renderers,
            overrides: [
              {
                target: { kind: 'node', id: 'n' },
                renderer: {
                  type: 'svg',
                  id: 'badge',
                  version: '1',
                  bounds: { x: 10, y: 10, width: 100, height: 60 },
                  fidelity: 'equivalent',
                  reason: 'Qualified solid red badge',
                },
              },
            ],
          },
        },
        writing: {
          allowLosses: true,
          adapters: [
            {
              id: 'badge',
              version: '1',
              render: () => [
                {
                  type: 'rect',
                  position: { x: 10, y: 10 },
                  width: 100,
                  height: 60,
                  fill: '#ff0000',
                },
              ],
            },
          ],
        },
      };
      results.custom = await renderPngExport(custom);
      results.limit = await renderPngExport({ ...input, png: { maxPixels: 100 } });
      results.changed = await renderPngExport({ ...input, expectedSvg: 'different' });
      results.bytes = await renderPngExport({ ...input, png: { maxBytes: 1 } });
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        callback(null);
      };
      results.empty = await renderPngExport(input);
      HTMLCanvasElement.prototype.toBlob = function () {};
      results.timeout = await renderPngExport(input, { timeoutMs: 30 });
      const controller = new AbortController();
      const pending = renderPngExport(input, { signal: controller.signal });
      setTimeout(() => controller.abort(), 20);
      results.aborted = await pending;
    } finally {
      HTMLCanvasElement.prototype.toBlob = toBlob;
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
      document.createElement = originalCreateElement;
    }
    return { results, urls: urls.size, canvases: canvases.map((c) => [c.width, c.height]) };
  });
  expect(native.results.success.type).toBe('rendered');
  expect(native.results.custom.type).toBe('rendered');
  const customPng = PNG.sync.read(
    Buffer.from(native.results.custom.artifact.dataUrl.split(',')[1], 'base64'),
  );
  expect([...customPng.data.slice((40 * 120 + 60) * 4, (40 * 120 + 60) * 4 + 4)]).toEqual([
    255, 0, 0, 255,
  ]);
  expect(native.results.consent.code).toBe('loss-consent-required');
  expect(native.results.limit.code).toBe('plan-blocked');
  expect(native.results.changed.code).toBe('source-changed');
  expect(native.results.bytes.code).toBe('output-invalid');
  expect(native.results.empty.code).toBe('encoding-failed');
  expect(native.results.timeout.code).toBe('timeout');
  expect(native.results.aborted.code).toBe('aborted');
  expect(native.urls).toBe(0);
  expect(native.canvases.every(([w, h]) => w === 0 && h === 0)).toBe(true);
  const nativePng = PNG.sync.read(
    Buffer.from(native.results.success.artifact.dataUrl.split(',')[1], 'base64'),
  );
  expect(nativePng.width).toBe(120);
  expect(nativePng.height).toBe(80);
  expect(nativePng.data[3]).toBe(0);
  expect(nativePng.data.some((v, i) => i % 4 === 3 && v === 255)).toBe(true);
  expect(errors).toEqual([]);
  const receipt = {
    browser: await browser.version(),
    model: { width: light.png.width, height: light.png.height, bytes: light.bytes.length },
    viewport: { width: crop.png.width, height: crop.png.height, bytes: crop.bytes.length },
    previewDownloadEqual: true,
    cancelledRenderReleasedObjectUrl: true,
    cleanup: { urls: native.urls, canvases: native.canvases },
    nativeOutcomes: Object.fromEntries(
      Object.entries(native.results).map(([key, value]) => [
        key,
        value.type === 'failed' ? value.code : value.type,
      ]),
    ),
    pageErrors: errors,
  };
  await writeFile(evidence('png-export-browser.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
}
// oxlint-disable-next-line linteffect/no-try-catch -- Browser/server test resources must close even if assertions fail.
try {
  await run();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
