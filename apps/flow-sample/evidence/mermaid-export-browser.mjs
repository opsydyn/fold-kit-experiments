/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Exercises built-in graph outlines through the public adapter. */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
import { exportMermaid } from '../../../packages/foldkit-flow-mermaid/dist/index.mjs';

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
  await button('Open C4 system context').click();
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
  expect(download.suggestedFilename()).toBe('foldkit-flow.mermaid.json');
  const bundle = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(bundle.protocol).toBe('foldkit-flow-mermaid/v1');
  expect(bundle.identity.nodes.map((node) => node.flowId)).toEqual(
    before.nodes.map((node) => node.id),
  );
  expect(bundle.identity.edges.map((edge) => edge.flowId)).toEqual(
    before.edges.map((edge) => edge.id),
  );
  expect(bundle.diagnostics.some((item) => item.code === 'node-fields-omitted')).toBe(true);
  expect(bundle.source.trim()).toBe((await source.textContent()).trim());
  expect(await exportedGraph()).toEqual(before);
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
    await expect(downloadButton).toBeEnabled();
    await panel.screenshot({
      path: fileURLToPath(new URL(`./mermaid-export-${theme}.png`, import.meta.url)),
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
  await expect(panel).toContainText('does not flatten');
  await expect(downloadButton).toBeDisabled();
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
  const sources = [{ id: 'workbench-c4', source: bundle.source }];
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
        groupsRejected: true,
        minimalModeKeepsRequestedLossPreview: true,
        screenshots: ['mermaid-export-light.png', 'mermaid-export-dark.png'],
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
