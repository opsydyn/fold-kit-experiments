/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Exercises built-in graph outlines through the public adapter. */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
import { exportMermaid } from '../../../packages/foldkit-zloz-mermaid/dist/index.mjs';

const appRoot = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const oracleRoot = resolve(
  fileURLToPath(
    new URL('../../../experiments/mermaid-fidelity/node_modules/mermaid/dist/', import.meta.url),
  ),
);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/oracle-page') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Syntax oracle</title>');
    return;
  }
  const oracle = pathname.startsWith('/mermaid/');
  const root = oracle ? oracleRoot : appRoot;
  const route = oracle
    ? pathname.slice('/mermaid'.length)
    : pathname === '/'
      ? '/index.html'
      : pathname;
  const path = resolve(root, '.' + route);
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
const run = async () => {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1100 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const errors = [],
    externalRequests = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:')) externalRequests.push(request.url());
  });
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const exportedGraph = async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export JSON').click(),
    ]);
    return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open nested C4 container view').click();
  const before = await exportedGraph();
  await button('Mermaid export').click();
  const panel = page.getByRole('region', { name: 'Mermaid export preview', exact: true });
  const consent = panel.getByRole('checkbox', {
    name: 'Allow reported conversion losses for this revision',
    exact: true,
  });
  const downloadButton = panel.getByRole('button', {
    name: 'Download Mermaid bundle',
    exact: true,
  });
  await expect(downloadButton).toBeDisabled();
  await expect(panel).toContainText('architecture');
  await consent.check();
  await expect(downloadButton).toBeEnabled();
  const source = panel.getByLabel('Mermaid source', { exact: true });
  await expect(source).toContainText('flowchart LR');
  const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
  expect(download.suggestedFilename()).toBe('foldkit-zloz.mermaid.json');
  const bundle = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(bundle.protocol).toBe('foldkit-flow-mermaid/v1');
  expect(bundle.identity.nodes.filter((node) => node.kind === 'group')).toHaveLength(2);
  expect(bundle.identity.nodes.find((node) => node.zlozId === 'storage-boundary').parentId).toBe(
    'platform-boundary',
  );
  expect(bundle.identity.nodes.find((node) => node.zlozId === 'orders-db').parentId).toBe(
    'storage-boundary',
  );
  expect(bundle.identity.nodes.map((node) => node.zlozId)).toEqual(
    before.nodes.map((node) => node.id),
  );
  expect(bundle.identity.edges.map((edge) => edge.zlozId)).toEqual(
    before.edges.map((edge) => edge.id),
  );
  expect(bundle.diagnostics.some((item) => item.code === 'node-fields-omitted')).toBe(true);
  expect(bundle.source.trim()).toBe((await source.textContent()).trim());
  expect(await exportedGraph()).toEqual(before);
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
    await expect(downloadButton).toBeEnabled();
    await panel.screenshot({
      path: fileURLToPath(new URL(`./mermaid-subgraphs-${theme}.png`, import.meta.url)),
    });
  }
  // Canvas diagnostics can be disabled without suppressing an explicitly opened conversion-loss preview.
  await button('Minimal mode').click();
  await expect(panel).toContainText('architecture');
  await expect(downloadButton).toBeEnabled();
  await button('Minimal mode').click();
  await button('Open release workflow').click();
  await expect(consent).not.toBeChecked();
  await expect(downloadButton).toBeDisabled();
  await button('Open C4 container view').click();
  await consent.check();
  await expect(downloadButton).toBeEnabled();
  await expect(source).toContainText('subgraph');
  await panel.getByRole('button', { name: 'Close Mermaid preview' }).click();
  await expect(panel).toHaveCount(0);
  await expect(button('Mermaid export')).toHaveAttribute('aria-expanded', 'false');

  const node = (id, label) => ({
    id,
    label,
    position: { x: 0, y: 0 },
    size: { width: 200, height: 100 },
    ports: [],
  });
  const candidates = [
    {
      id: 'escaped-group-title',
      graph: {
        nodes: [
          { ...node('g', 'Group \"end\" & 支付'), kind: 'group' },
          { ...node('child', 'Child'), parentId: 'g' },
        ],
        edges: [],
      },
    },
    {
      id: 'empty-group',
      rejected: true,
      graph: { nodes: [{ ...node('g', 'Empty'), kind: 'group' }], edges: [] },
    },
    { id: 'empty-graph', graph: { nodes: [], edges: [] } },
    { id: 'empty-node-label', rejected: true, graph: { nodes: [node('empty', '')], edges: [] } },
    {
      id: 'escaped-literal',
      graph: { nodes: [node('end 🔁', 'Café "yes" & #quot; <支付>\nline | \\ `')], edges: [] },
    },
    ...['LR', 'RL', 'TB', 'BT'].map((direction) => ({
      id: `outlines-${direction}`,
      direction,
      graph: {
        nodes: [
          node('a', 'Rectangle'),
          { ...node('b', 'Rounded'), appearance: { shape: 'rounded-rectangle' } },
          { ...node('c', 'Store'), appearance: { shape: 'cylinder' } },
        ],
        edges: [],
      },
    })),
  ];
  const rejected = [];
  const sources = [{ id: 'workbench-c4-nested', source: bundle.source }];
  for (const item of candidates) {
    const result = exportMermaid(item.graph, {
      lossPolicy: 'report',
      direction: item.direction ?? 'LR',
    });
    if (item.rejected) {
      expect(result.status).toBe('rejected');
      expect('value' in result).toBe(false);
      rejected.push(item.id);
      continue;
    }
    expect(result.status).toBe('converted');
    sources.push({ id: item.id, source: result.value.source });
  }
  const mermaidManifest = JSON.parse(
    await readFile(
      new URL(
        '../../../experiments/mermaid-fidelity/node_modules/mermaid/package.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  expect(mermaidManifest.version).toBe('12.3.0');
  const oraclePage = await browser.newPage();
  oraclePage.on('pageerror', (error) => errors.push(String(error)));
  oraclePage.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:')) externalRequests.push(request.url());
  });
  await oraclePage.goto(`http://127.0.0.1:${server.address().port}/oracle-page`);
  const syntax = await oraclePage.evaluate(async (sources) => {
    const { default: mermaid } = await import('/mermaid/mermaid.esm.min.mjs');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    const results = [];
    for (const { id, source } of sources)
      results.push(
        await Promise.resolve()
          .then(() => mermaid.parse(source))
          .then(
            (result) => ({ id, valid: Boolean(result) }),
            (error) => ({ id, valid: false, error: String(error) }),
          ),
      );
    return results;
  }, sources);
  const rendered = await oraclePage.evaluate(
    async ({ source, groups }) => {
      const { default: mermaid } = await import('/mermaid/mermaid.esm.min.mjs');
      const { svg } = await mermaid.render('nested-qualification', source);
      document.body.innerHTML = svg;
      const bounds = (id) => {
        const element = [...document.querySelectorAll('g.cluster')].find(
          (element) => element.id === id || element.id.endsWith('-' + id),
        );
        if (!element)
          throw new Error(
            `Missing cluster ${id}; actual ${[...document.querySelectorAll('g.cluster')].map((node) => node.id).join(', ')}`,
          );
        const rect = element.querySelector('rect').getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      return {
        clusters: document.querySelectorAll('g.cluster').length,
        outer: bounds(groups.outer),
        inner: bounds(groups.inner),
      };
    },
    {
      source: bundle.source,
      groups: {
        outer: bundle.identity.nodes.find((node) => node.zlozId === 'platform-boundary').mermaidId,
        inner: bundle.identity.nodes.find((node) => node.zlozId === 'storage-boundary').mermaidId,
      },
    },
  );
  expect(rendered.clusters).toBe(2);
  expect(rendered.inner.width).toBeGreaterThan(0);
  expect(rendered.inner.x).toBeGreaterThanOrEqual(rendered.outer.x);
  expect(rendered.inner.y).toBeGreaterThanOrEqual(rendered.outer.y);
  expect(rendered.inner.right).toBeLessThanOrEqual(rendered.outer.right);
  expect(rendered.inner.bottom).toBeLessThanOrEqual(rendered.outer.bottom);
  for (const result of syntax) expect(result.valid, JSON.stringify(result)).toBe(true);
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  console.log(
    JSON.stringify(
      {
        chromium: browser.version(),
        mermaid: '12.3.0',
        syntax,
        rejected,
        downloaded: {
          protocol: bundle.protocol,
          nodes: bundle.identity.nodes.length,
          edges: bundle.identity.edges.length,
          diagnostics: [...new Set(bundle.diagnostics.map((item) => item.code))],
        },
        graphPreserved: true,
        consentResetOnReplacement: true,
        hierarchyPreserved: true,
        rendered,
        minimalModeKeepsRequestedLossPreview: true,
        screenshots: ['mermaid-subgraphs-light.png', 'mermaid-subgraphs-dark.png'],
        errors,
        externalRequests,
      },
      null,
      2,
    ),
  );
};
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
