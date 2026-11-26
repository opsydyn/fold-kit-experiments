/* oxlint-disable linteffect/no-return-in-callback, linteffect/no-return-in-arrow, linteffect/no-try-catch -- Browser qualification asserts real native IO and restores test instrumentation/owned resources. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const { PNG } = createRequire(
  new URL('../../../packages/effect-three/package.json', import.meta.url),
)('pngjs');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const core = fileURLToPath(new URL('../../../packages/foldkit-zloz/dist/', import.meta.url));
const evidenceRoot = process.env.ZLOZ_GROUP_EVIDENCE_DIR;
const directory = evidenceRoot
  ? pathToFileURL(evidenceRoot + '/png/')
  : new URL('./v3-png/', import.meta.url);
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1'),
      isCore = url.pathname.startsWith('/__png/');
    const base = resolve(isCore ? core : root),
      route = isCore ? url.pathname.slice(6) : url.pathname;
    let path = resolve(base, '.' + route);
    if (path !== base && !path.startsWith(base + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (!extname(path)) path = resolve(path, 'index.html');
    const content = await readFile(path);
    const mime =
      {
        '.mjs': 'text/javascript',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.html': 'text/html',
        '.woff2': 'font/woff2',
      }[extname(path)] ?? 'application/octet-stream';
    response.writeHead(200, { 'content-type': mime });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
// oxlint-disable-next-line anti-slop/no-runtime-typeof -- Node returns AddressInfo|string|null; assert TCP transport and its integer port at the listener boundary.
assert(address && typeof address === 'object' && Number.isInteger(address.port));
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
  acceptDownloads: true,
});
const errors = [],
  checks = [],
  downloads = [];
page.on('pageerror', (error) => errors.push(String(error)));
const button = (name) => page.getByRole('button', { name, exact: true });
const panel = () => page.getByRole('group', { name: 'PNG export review', exact: true });
const preview = () => panel().getByRole('img', { name: 'PNG export preview' });
async function choose(name, value) {
  const generation = Number(await panel().getAttribute('data-zloz-png-generation'));
  await panel().getByLabel(name, { exact: true }).selectOption(value);
  await expect(panel()).toHaveAttribute('data-zloz-png-generation', String(generation + 1));
}
const nodes = () =>
  page.locator('[data-flow-node]').evaluateAll((elements) =>
    elements.map((e) => ({
      id: e.getAttribute('data-flow-node'),
      left: e.style.left,
      top: e.style.top,
      width: e.style.width,
      height: e.style.height,
    })),
  );
const screenshot = (name) =>
  page.screenshot({ path: new URL(name, directory).pathname, fullPage: true });
const imageReady = async () => {
  await expect(preview()).toBeVisible();
  await expect
    .poll(() => preview().evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
};
async function saveDownload(name) {
  const source = await preview().getAttribute('src');
  assert(source?.startsWith('data:image/png;base64,'));
  const encoded = Buffer.from(source.split(',')[1], 'base64');
  const event = page.waitForEvent('download');
  await panel().getByRole('button', { name: 'Download PNG', exact: true }).click();
  const download = await event;
  assert.equal(download.suggestedFilename(), 'zloz-native-v3.png');
  await download.saveAs(new URL(name, directory).pathname);
  const bytes = await readFile(new URL(name, directory));
  assert.deepEqual(bytes, encoded);
  const png = PNG.sync.read(bytes);
  downloads.push({
    file: name,
    width: png.width,
    height: png.height,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    previewDownloadEqual: true,
  });
  return png;
}
try {
  assert.equal((await page.goto(`${base}/groups/`))?.status(), 200);
  await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
  await page.locator('[data-flow-surface]').waitFor();
  await page.locator('[data-flow-owner="orders"][data-flow-port="api"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-flow-owner="warehouse"][data-flow-port="input"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-flow-edge]')).toHaveCount(2);
  const original = await nodes();
  await button('Arrange right').click();
  await expect.poll(nodes).not.toEqual(original);
  const arranged = await nodes();
  await button('Fit view').click();
  await page.getByText('PNG export review', { exact: true }).click();
  await button('Use retained ELK routes for PNG').click();
  const acceptance = panel().getByRole('checkbox', { name: 'Accept the reported PNG losses' });
  await expect(panel().getByRole('button', { name: 'Render PNG', exact: true })).toBeDisabled();
  await acceptance.check();
  await panel().getByRole('button', { name: 'Render PNG', exact: true }).click();
  await imageReady();
  const light = await saveDownload('native-light.png');
  await preview().scrollIntoViewIfNeeded();
  await screenshot('light-review.png');
  assert.deepEqual(await nodes(), arranged);
  checks.push(
    'Ported-group workbench PNG is an actual decoded image; light preview/download bytes match and authored bounds are unchanged.',
  );
  // Test-only native decoding delay makes the public cancellation control observable.
  await page.evaluate(() => {
    globalThis.__pngOriginalDecode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      const image = this;
      return new Promise((resolve, reject) =>
        setTimeout(() => globalThis.__pngOriginalDecode.call(image).then(resolve, reject), 250),
      );
    };
  });
  await panel().getByRole('button', { name: 'Render PNG', exact: true }).click();
  await panel().getByRole('button', { name: 'Cancel PNG render', exact: true }).click();
  await page.evaluate(() => {
    HTMLImageElement.prototype.decode = globalThis.__pngOriginalDecode;
  });
  await expect(preview()).toHaveCount(0);
  await page.waitForTimeout(350);
  await expect(preview()).toHaveCount(0);
  checks.push(
    'Public Cancel PNG render discards a delayed native decode result rather than publishing a late preview.',
  );
  await choose('PNG scale', '2');
  await button('Use dark theme').click();
  await page.locator('[data-flow-workbench-color-scheme="dark"]').waitFor();
  await button('Show custom workshop shells for PNG').click();
  await expect(page.locator('[data-zloz-workshop-badge]')).toHaveCount(3);
  await choose('PNG background', 'transparent');
  await expect(acceptance).not.toBeChecked();
  await acceptance.check();
  await panel().getByRole('button', { name: 'Render PNG', exact: true }).click();
  await imageReady();
  const dark = await saveDownload('native-dark-transparent-2x.png');
  assert.equal(dark.width, light.width * 2);
  assert.equal(dark.height, light.height * 2);
  assert.equal(dark.data[3], 0);
  await preview().scrollIntoViewIfNeeded();
  await screenshot('dark-custom-review.png');
  checks.push(
    'Dark/custom-shell fallback and raster loss require fresh consent; 2x output dimensions and transparent alpha are real encoded PNG data.',
  );
  await button('Protect PNG export').click();
  await button('Minimal mode').click();
  await expect(
    panel().getByText('PNG exports are protected in this workspace.', { exact: true }),
  ).toBeVisible();
  await expect(panel().getByRole('button', { name: 'Render PNG', exact: true })).toBeDisabled();
  await expect(panel().getByRole('button', { name: 'Download PNG', exact: true })).toBeDisabled();
  await expect(page.locator('[data-zloz-png-readout]')).toHaveCount(0);
  await panel()
    .getByText('PNG exports are protected in this workspace.', { exact: true })
    .scrollIntoViewIfNeeded();
  await screenshot('minimal-protected.png');
  checks.push(
    'Current protection blocks render/download and remains visible with fidelity findings in minimal mode.',
  );
  await button('Allow PNG export').click();
  await button('Show diagnostics').click();
  await choose('PNG region', 'viewport');
  await expect(preview()).toHaveCount(0);
  await expect(acceptance).not.toBeChecked();
  // The scoped surface measures its client box on the next native input frame.
  const dimensions = await page
    .locator('[data-flow-surface]')
    .evaluate((element) => ({ width: element.clientWidth * 2, height: element.clientHeight * 2 }));
  await expect(page.locator('[data-zloz-png-readout]')).toHaveText(
    `${dimensions.width} × ${dimensions.height}`,
  );
  await acceptance.check();
  await panel().getByRole('button', { name: 'Render PNG', exact: true }).click();
  await imageReady();
  const crop = await saveDownload('native-viewport-2x.png');
  assert.equal(crop.width, dimensions.width);
  assert.equal(crop.height, dimensions.height);
  await button('Undo').click();
  await expect.poll(nodes).toEqual(original);
  await expect(preview()).toHaveCount(0);
  checks.push(
    'Measured viewport/scale output matches the reviewed dimensions; one Undo after all exports restores the preceding layout and invalidates stale PNG.',
  );
  const native = await page.evaluate(async () => {
    const { renderGroupPngExportV3 } = await import('/__png/browser.mjs');
    const { captureGroupDocumentV3, writeGroupSvgExportV3, planGroupPngExportV3 } =
      await import('/__png/index.mjs');
    const documentV3 = captureGroupDocumentV3({
      version: 3,
      coordinateSpace: 'world',
      connectionMode: 'strict',
      capabilities: { groupPorts: true },
      viewport: { x: 25, y: 10, zoom: 2 },
      graph: {
        nodes: [
          {
            id: 'g',
            label: 'Boundary',
            kind: 'group',
            position: { x: 20, y: 20 },
            size: { width: 240, height: 160 },
            ports: [{ id: 'api', label: 'API', kind: 'output', side: 'right', offset: 0.5 }],
          },
          {
            id: 'child',
            parentId: 'g',
            label: 'Service',
            position: { x: 40, y: 80 },
            size: { width: 120, height: 60 },
            ports: [],
          },
          {
            id: 'other',
            label: 'Other',
            position: { x: 340, y: 60 },
            size: { width: 120, height: 100 },
            ports: [{ id: 'in', label: 'Input', kind: 'input', side: 'left', offset: 0.5 }],
          },
        ],
        edges: [
          {
            id: 'public-api',
            source: { node: 'g', port: 'api' },
            target: { node: 'other', port: 'in' },
          },
        ],
      },
    });
    const input = {
      document: documentV3,
      svg: {
        title: 'Native probe',
        region: { type: 'bounds', bounds: { x: 0, y: 0, width: 500, height: 220 } },
        theme: { colorScheme: 'light' },
        background: { type: 'transparent' },
        font: { family: 'sans-serif', size: 14, weight: 400 },
        renderers: { nodes: 'built-in', edges: 'built-in' },
      },
      writing: { allowLosses: true },
    };
    const svg = writeGroupSvgExportV3(input.document, input.svg, input.writing),
      plan = planGroupPngExportV3(input);
    if (svg.type !== 'written' || plan.type !== 'ready' || plan.svg !== svg.svg)
      throw new Error('Native PNG did not reuse exact SVG projection');
    const create = URL.createObjectURL,
      revoke = URL.revokeObjectURL,
      originalCreateElement = document.createElement,
      toBlob = HTMLCanvasElement.prototype.toBlob,
      getContext = HTMLCanvasElement.prototype.getContext,
      decode = HTMLImageElement.prototype.decode,
      Reader = FileReader;
    const urls = new Set(),
      canvases = [],
      readers = [];
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
      const element = originalCreateElement.apply(document, args);
      if (args[0] === 'canvas') canvases.push(element);
      return element;
    };
    globalThis.FileReader = class extends Reader {
      constructor() {
        super();
        readers.push(this);
      }
    };
    const results = {};
    try {
      results.success = await renderGroupPngExportV3({ ...input, expectedSvg: svg.svg });
      results.dark = await renderGroupPngExportV3({
        ...input,
        svg: { ...input.svg, theme: { colorScheme: 'dark' }, background: { type: 'theme' } },
      });
      results.viewport = await renderGroupPngExportV3({
        ...input,
        svg: {
          ...input.svg,
          region: { type: 'viewport', size: { width: 320, height: 180 } },
          scale: 2,
        },
      });
      results.consent = await renderGroupPngExportV3({ ...input, writing: {} });
      results.limit = await renderGroupPngExportV3({ ...input, png: { maxPixels: 1 } });
      results.changed = await renderGroupPngExportV3({ ...input, expectedSvg: 'different' });
      results.bytes = await renderGroupPngExportV3({ ...input, png: { maxBytes: 1 } });
      const abortedDuringWrite = new AbortController();
      const custom = {
        ...input,
        svg: {
          ...input.svg,
          renderers: {
            ...input.svg.renderers,
            overrides: [
              {
                target: { kind: 'node', id: 'other' },
                renderer: {
                  type: 'svg',
                  id: 'probe',
                  version: '1',
                  bounds: { x: 340, y: 60, width: 120, height: 100 },
                  fidelity: 'approximate',
                  reason: 'Probe rectangle',
                },
              },
            ],
          },
        },
        writing: {
          allowLosses: true,
          adapters: [
            {
              id: 'probe',
              version: '1',
              render: (context) => {
                if (context.version !== 3 || !context.document.capabilities.groupPorts)
                  throw new Error('Native adapter lost its source');
                return [
                  {
                    type: 'rect',
                    position: { x: 340, y: 60 },
                    width: 120,
                    height: 100,
                    fill: '#ff0000',
                  },
                ];
              },
            },
          ],
        },
      };
      results.custom = await renderGroupPngExportV3(custom);
      results.writeAbort = await renderGroupPngExportV3(
        {
          ...custom,
          writing: {
            ...custom.writing,
            adapters: [
              {
                id: 'probe',
                version: '1',
                render: () => {
                  abortedDuringWrite.abort();
                  return [
                    {
                      type: 'rect',
                      position: { x: 340, y: 60 },
                      width: 120,
                      height: 100,
                      fill: '#ff0000',
                    },
                  ];
                },
              },
            ],
          },
        },
        { signal: abortedDuringWrite.signal },
      );
      HTMLImageElement.prototype.decode = function () {
        return Promise.reject(new Error('Native decode probe'));
      };
      results.decode = await renderGroupPngExportV3(input);
      HTMLImageElement.prototype.decode = decode;
      HTMLCanvasElement.prototype.getContext = function () {
        return null;
      };
      results.canvas = await renderGroupPngExportV3(input);
      HTMLCanvasElement.prototype.getContext = getContext;
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        callback(null);
      };
      results.empty = await renderGroupPngExportV3(input);
      HTMLCanvasElement.prototype.toBlob = function () {};
      results.timeout = await renderGroupPngExportV3(input, { timeoutMs: 30 });
      const controller = new AbortController(),
        pending = renderGroupPngExportV3(input, { signal: controller.signal });
      setTimeout(() => controller.abort(), 20);
      results.aborted = await pending;
    } finally {
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
      document.createElement = originalCreateElement;
      HTMLCanvasElement.prototype.toBlob = toBlob;
      HTMLCanvasElement.prototype.getContext = getContext;
      HTMLImageElement.prototype.decode = decode;
      globalThis.FileReader = Reader;
    }
    return {
      results,
      svg: svg.svg,
      urls: urls.size,
      canvases: canvases.map((c) => [c.width, c.height]),
      readersClean: readers.every(
        (r) => r.onload === null && r.onerror === null && r.onabort === null && r.readyState !== 1,
      ),
    };
  });
  function decoded(result) {
    assert.equal(result.type, 'rendered');
    return PNG.sync.read(Buffer.from(result.artifact.dataUrl.split(',')[1], 'base64'));
  }
  function at(png, x, y) {
    return [...png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 4)];
  }
  const ported = decoded(native.results.success);
  assert.equal(ported.width, 500);
  assert.equal(ported.height, 220);
  assert.equal(ported.data[3], 0);
  assert.deepEqual(at(ported, 260, 100), [37, 99, 235, 255]);
  const darkProbe = decoded(native.results.dark);
  assert.deepEqual(at(darkProbe, 0, 0), [17, 24, 39, 255]);
  assert.deepEqual(at(darkProbe, 260, 100), [152, 190, 255, 255]);
  const viewport = decoded(native.results.viewport);
  assert.equal(viewport.width, 640);
  assert.equal(viewport.height, 360);
  assert.deepEqual(at(decoded(native.results.custom), 390, 110), [255, 0, 0, 255]);
  const expectedFailures = {
    consent: 'loss-consent-required',
    limit: 'plan-blocked',
    changed: 'source-changed',
    bytes: 'output-invalid',
    writeAbort: 'aborted',
    decode: 'decode-failed',
    canvas: 'canvas-unavailable',
    empty: 'encoding-failed',
    timeout: 'timeout',
    aborted: 'aborted',
  };
  for (const [name, code] of Object.entries(expectedFailures)) {
    assert.equal(native.results[name].type, 'failed');
    assert.equal(native.results[name].code, code, name);
  }
  assert.equal(native.urls, 0);
  assert(native.canvases.every(([width, height]) => width === 0 && height === 0));
  assert.equal(native.readersClean, true);
  await writeFile(
    new URL('native-ported-transparent.png', directory),
    Buffer.from(native.results.success.artifact.dataUrl.split(',')[1], 'base64'),
  );
  await writeFile(new URL('native-projection.svg', directory), native.svg);
  assert.deepEqual(errors, []);
  const paths = [
    ...new Set(
      execFileSync(
        'git',
        [
          'ls-files',
          '-co',
          '--exclude-standard',
          'packages/foldkit-zloz/src',
          'apps/zloz-demo/src/group-workbench',
          'apps/zloz-demo/src/pages/groups.astro',
        ],
        { encoding: 'utf8' },
      )
        .trim()
        .split('\n'),
    ),
  ].sort();
  const sourceHashes = {};
  for (const path of paths)
    sourceHashes[path] = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  const outcomes = Object.fromEntries(
    Object.entries(native.results).map(([name, result]) => [
      name,
      result.type === 'rendered'
        ? {
            type: result.type,
            width: result.artifact.width,
            height: result.artifact.height,
            bytes: result.artifact.byteLength,
          }
        : { type: result.type, code: result.code },
    ]),
  );
  await writeFile(
    new URL('browser.json', directory),
    JSON.stringify(
      {
        url: `${base}/groups/`,
        date: new Date().toISOString(),
        browser: await browser.version(),
        node: process.version,
        baseHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
        checks,
        errors,
        downloads,
        native: {
          outcomes,
          sourceSvgSha256: createHash('sha256').update(native.svg).digest('hex'),
          groupPortPixels: { light: at(ported, 260, 100), dark: at(darkProbe, 260, 100) },
          cleanup: {
            urls: native.urls,
            canvases: native.canvases,
            readersClean: native.readersClean,
          },
        },
        sourceHashes,
        limits: [
          'Local production build and Chromium only; no hosted/registry, human device/screen-reader or broad performance acceptance. Raster pixels retain no editable source semantics.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      checks: checks.length,
      nativeOutcomes: outcomes,
      errors,
      output: directory.pathname,
    }),
  );
} catch (error) {
  await page.screenshot({ path: '/private/tmp/zloz-png-v3-failure.png', fullPage: true });
  console.log('PNG evidence failure labels', await page.locator('label').allTextContents());
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
