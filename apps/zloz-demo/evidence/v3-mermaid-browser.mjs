/* oxlint-disable linteffect/no-return-in-callback, linteffect/no-return-in-arrow, linteffect/no-try-catch -- Browser qualification asserts real native IO and restores test instrumentation/owned resources. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { exportGroupMermaidV3 } from '../../../packages/foldkit-zloz-mermaid/dist/index.mjs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const evidenceRoot = process.env.ZLOZ_GROUP_EVIDENCE_DIR;
const directory = evidenceRoot
  ? pathToFileURL(evidenceRoot + '/mermaid/')
  : new URL('./v3-mermaid/', import.meta.url);
const oraclePackage = resolve(
  process.env.ZLOZ_MERMAID_ORACLE ?? 'experiments/mermaid-fidelity/node_modules/mermaid',
);
const oracleManifest = JSON.parse(await readFile(resolve(oraclePackage, 'package.json')));
assert.equal(oracleManifest.version, '12.3.0');
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/__oracle/') {
      response.setHeader('content-type', 'text/html');
      response.end('<!doctype html><title>Mermaid native v3 oracle</title>');
      return;
    }
    const isOracle = url.pathname.startsWith('/__oracle/');
    const base = isOracle ? resolve(oraclePackage, 'dist') : resolve(root),
      route = isOracle ? '/' + url.pathname.slice('/__oracle/'.length) : url.pathname;
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
const checks = [],
  errors = [],
  externalRequests = [],
  downloads = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('request', (request) => {
  if (!request.url().startsWith(base) && !request.url().startsWith('data:'))
    externalRequests.push(request.url());
});
const button = (name) => page.getByRole('button', { name, exact: true });
const panel = () =>
  page.getByRole('region', { name: 'Native v3 Mermaid export review', exact: true });
const consent = () =>
  panel().getByRole('checkbox', { name: 'Accept the reported Mermaid losses', exact: true });
const downloadButton = () =>
  panel().getByRole('button', { name: 'Download Mermaid bundle', exact: true });
const source = () => panel().locator('pre[aria-label="Mermaid source preview"]').textContent();
async function capture(file, where = 'source') {
  if (where === 'download') await downloadButton().scrollIntoViewIfNeeded();
  else await panel().locator('pre').scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL(file, directory).pathname, fullPage: true });
}
async function download(file, kind = 'bundle') {
  if (kind === 'model' && !(await button('Download model').isVisible()))
    await page.getByText('Portable v3 model', { exact: true }).click();
  const before = kind === 'bundle' ? await source() : null,
    pending = page.waitForEvent('download');
  await (kind === 'bundle' ? downloadButton() : button('Download model')).click();
  const result = await pending;
  if (kind === 'bundle') assert.equal(result.suggestedFilename(), 'zloz-native-v3.mermaid.json');
  await result.saveAs(new URL(file, directory).pathname);
  const bytes = await readFile(new URL(file, directory)),
    value = JSON.parse(bytes);
  if (kind === 'bundle') {
    assert.equal(value.source, before);
    assert.equal(bytes.toString(), JSON.stringify(value, null, 2) + '\n');
    assert.equal(value.protocol, 'foldkit-zloz-mermaid/v3');
  }
  downloads.push({
    file,
    kind,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    previewMatches: kind === 'bundle' ? value.source === before : null,
  });
  return value;
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
  const before = await download('before-model.txt', 'model');
  await page.getByText('Mermaid export review', { exact: true }).click();
  await expect(
    panel().locator('[data-zloz-mermaid-finding="group-port-details-omitted"]'),
  ).toHaveCount(1);
  await expect(
    panel().locator('[data-zloz-mermaid-finding="group-port-attachment-omitted"]'),
  ).toHaveCount(1);
  await expect(downloadButton()).toBeDisabled();
  await consent().check();
  await expect(downloadButton()).toBeEnabled();
  await capture('light-review.png');
  const light = await download('native-light-lr.txt');
  assert.equal(light.identity.nodes.find((n) => n.nodeId === 'orders').ports[0].id, 'api');
  assert.equal(
    light.identity.edges.find(
      (e) => e.sourceNode === light.identity.nodes.find((n) => n.nodeId === 'orders').mermaidId,
    ).sourcePort,
    'api',
  );
  assert.deepEqual(light.capabilities, { groupPorts: true });
  checks.push(
    'Actual native group connection shows socket and attachment findings; explicit exact-output consent gates a native bundle whose source equals the highlighted preview and whose identities retain the authored socket.',
  );

  await panel().getByLabel('Mermaid direction', { exact: true }).selectOption('TB');
  await expect(consent()).not.toBeChecked();
  await expect(downloadButton()).toBeDisabled();
  assert((await source()).startsWith('flowchart TB\n'));
  await button('Use dark theme').click();
  await consent().check();
  await expect(downloadButton()).toBeEnabled();
  await capture('dark-review.png');
  const dark = await download('native-dark-tb.txt');
  assert.equal(dark.direction, 'TB');
  const unchanged = await download('after-exports-model.txt', 'model');
  assert.deepEqual(unchanged, before);
  checks.push(
    'Direction changes require fresh consent. Light LR and dark TB downloads retain their exact reviewed bytes; canonical model downloads before/after exports are identical.',
  );

  await button('Protect Mermaid export').click();
  await button('Minimal mode').click();
  await expect(downloadButton()).toBeDisabled();
  await expect(panel()).toContainText('Mermaid exports are protected in this workspace.');
  await expect(panel().getByRole('status')).toHaveCount(0);
  await expect(
    panel().locator('[data-zloz-mermaid-finding="group-port-attachment-omitted"]'),
  ).toHaveCount(1);
  await capture('minimal-protected.png', 'download');
  await button('Allow Mermaid export').click();
  await page.locator('[data-flow-handle="orders"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await expect(consent()).not.toBeChecked();
  await expect(downloadButton()).toBeDisabled();
  await button('Undo').click();
  await expect(page.locator('[data-flow-node="orders"]')).toHaveCSS('left', '60px');
  const undone = await download('after-undo-model.txt', 'model');
  assert.deepEqual(undone, before);
  checks.push(
    'Current protection blocks export in dark/minimal mode while findings/reason remain visible. An authored movement invalidates consent even when Mermaid layout/source is unchanged; one Undo restores the complete pre-export model.',
  );

  await consent().check();
  await button('Save checkpoint').click();
  await button('Review Edition 1').click();
  await expect(consent()).not.toBeChecked();
  await consent().check();
  const edition = await download('native-edition-tb.txt');
  assert.equal(edition.protocol, 'foldkit-zloz-mermaid/v3');
  await button('Return to working model').click();
  await expect(consent()).not.toBeChecked();
  checks.push(
    'Read-only edition export has independent consent and exact native output; returning to the working session cannot reuse edition acceptance.',
  );

  const wire = JSON.parse(
    await readFile(
      new URL(
        '../../../packages/foldkit-zloz/test/fixtures/group-document-v3-ported.json',
        import.meta.url,
      ),
    ),
  );
  const g2 = {
      id: 'h',
      label: 'Other boundary',
      kind: 'group',
      position: { x: 800, y: 0 },
      size: { width: 300, height: 200 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
    c2 = {
      id: 'hc',
      label: 'Other child',
      parentId: 'h',
      position: { x: 830, y: 40 },
      size: { width: 100, height: 80 },
      ports: [],
    };
  const fixtures = [
    ...['LR', 'RL', 'TB', 'BT'].map((direction) => ({
      id: 'boundary-' + direction,
      document: wire,
      direction,
      clusters: 1,
      edges: 1,
    })),
    {
      id: 'boundary-to-boundary',
      document: {
        ...wire,
        graph: {
          nodes: [...wire.graph.nodes, g2, c2],
          edges: [
            { id: 'cross', source: { node: 'g', port: 'out' }, target: { node: 'h', port: 'in' } },
          ],
        },
      },
      clusters: 2,
      edges: 1,
    },
    {
      id: 'boundary-to-child',
      document: {
        ...wire,
        graph: {
          nodes: wire.graph.nodes.map((n) =>
            n.id === 'child'
              ? { ...n, ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }] }
              : n,
          ),
          edges: [
            {
              id: 'inside',
              source: { node: 'g', port: 'out' },
              target: { node: 'child', port: 'in' },
            },
          ],
        },
      },
      clusters: 1,
      edges: 1,
    },
    {
      id: 'boundary-self',
      document: {
        ...wire,
        graph: {
          nodes: wire.graph.nodes.map((n) =>
            n.id === 'g'
              ? {
                  ...n,
                  ports: [...n.ports, { id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
                }
              : n,
          ),
          edges: [
            { id: 'self', source: { node: 'g', port: 'out' }, target: { node: 'g', port: 'in' } },
          ],
        },
      },
      clusters: 1,
      edges: 1,
    },
    {
      id: 'nested-loose',
      document: {
        ...wire,
        connectionMode: 'loose',
        graph: {
          nodes: [...wire.graph.nodes, { ...g2, parentId: 'g' }, c2],
          edges: [
            { id: 'cross', source: { node: 'b', port: 'in' }, target: { node: 'h', port: 'in' } },
          ],
        },
      },
      clusters: 2,
      edges: 1,
    },
    {
      id: 'encoded-label',
      document: {
        ...wire,
        graph: {
          ...wire.graph,
          nodes: wire.graph.nodes.map((n) =>
            n.id === 'g' ? { ...n, label: 'Boundary "end" & 支付' } : n,
          ),
        },
      },
      clusters: 1,
      edges: 1,
    },
    { id: 'workbench-light', source: light.source, clusters: 1, edges: 2 },
    { id: 'workbench-dark', source: dark.source, clusters: 1, edges: 2 },
  ];
  const oracleResults = [];
  let svg;
  for (const fixture of fixtures) {
    const projected = fixture.source
      ? null
      : exportGroupMermaidV3(fixture.document, {
          direction: fixture.direction ?? 'LR',
          lossPolicy: 'report',
        });
    if (projected) assert.equal(projected.status, 'converted', fixture.id);
    const generated = fixture.source ?? projected.value.source;
    const oracle = await browser.newPage();
    oracle.on('pageerror', (e) => errors.push(String(e)));
    oracle.on('request', (r) => {
      if (!r.url().startsWith(base) && !r.url().startsWith('data:')) externalRequests.push(r.url());
    });
    await oracle.goto(`${base}/__oracle/`);
    const rendered = await oracle.evaluate(async (source) => {
      const { default: m } = await import('/__oracle/mermaid.esm.min.mjs');
      m.initialize({ startOnLoad: false, securityLevel: 'strict' });
      const parsed = await m.parse(source),
        result = await m.render('native-oracle', source);
      document.body.innerHTML = result.svg;
      return {
        type: parsed.diagramType,
        clusters: document.querySelectorAll('.cluster').length,
        edges: document.querySelectorAll('.edgePaths path').length,
        svg: result.svg,
      };
    }, generated);
    assert.equal(rendered.type, 'flowchart-v2', fixture.id);
    assert.equal(rendered.clusters, fixture.clusters, fixture.id);
    assert.equal(rendered.edges, fixture.edges, fixture.id);
    if (fixture.id === 'workbench-light') {
      svg = rendered.svg;
      await oracle.locator('svg').screenshot({
        path: new URL('oracle-render.png', directory).pathname,
      });
    }
    oracleResults.push({
      id: fixture.id,
      sourceSha256: createHash('sha256').update(generated).digest('hex'),
      type: rendered.type,
      clusters: rendered.clusters,
      edges: rendered.edges,
    });
    await oracle.close();
  }
  await writeFile(new URL('oracle-render.svg', directory), svg);
  checks.push(
    'Pinned Mermaid 12.3 public parse/render accepts 11 native projections: four directions, group-to-group/child/self, nested loose endpoints, encoded group labels and both actual workbench downloads; real SVG cluster/edge counts are asserted.',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  const paths = [
      ...new Set(
        execFileSync(
          'git',
          [
            'ls-files',
            '-co',
            '--exclude-standard',
            'packages/foldkit-zloz/src',
            'packages/foldkit-zloz-mermaid/src',
            'apps/zloz-demo/src/group-workbench',
            'apps/zloz-demo/src/pages/groups.astro',
          ],
          { encoding: 'utf8' },
        )
          .trim()
          .split('\n'),
      ),
    ].sort(),
    sourceHashes = {};
  for (const path of paths)
    sourceHashes[path] = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
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
        externalRequests,
        downloads,
        oracle: {
          version: oracleManifest.version,
          entrySha256: createHash('sha256')
            .update(await readFile(resolve(oraclePackage, 'dist/mermaid.esm.min.mjs')))
            .digest('hex'),
          cases: oracleResults,
          svgSha256: createHash('sha256').update(svg).digest('hex'),
        },
        sourceHashes,
        limits: [
          'Local production UI and pinned browser oracle only; no product Mermaid runtime/import, registry/hosting, broad performance or human AT/device acceptance. Mermaid layout is not authored socket fidelity.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      checks: checks.length,
      errors,
      oracleCases: oracleResults.length,
      downloads: downloads.length,
      output: directory.pathname,
    }),
  );
} catch (error) {
  await page
    .screenshot({ path: '/private/tmp/zloz-mermaid-v3-failure.png', fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
