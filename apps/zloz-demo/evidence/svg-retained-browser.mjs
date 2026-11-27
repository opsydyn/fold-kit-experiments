import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
import {
  captureSvgLayout,
  createEditor,
  writeSvgExport,
} from '../../../packages/foldkit-zloz/dist/index.mjs';

const fixtures = new Map();
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  if (fixtures.has(route)) {
    response.setHeader('Content-Type', 'image/svg+xml');
    response.end(fixtures.get(route));
    return;
  }
  const path = resolve(root, '.' + (route === '/' ? '/index.html' : route));
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
async function run() {
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
  const snapshot = captureSvgLayout(editor, 'vector-badge-v1');
  const samples = [];
  for (const scheme of ['light', 'dark']) {
    const options = {
      title: `Retained system routes — ${scheme}`,
      region: { type: 'model', padding: 32 },
      theme: { colorScheme: scheme },
      background: { type: 'theme' },
      font: { family: 'sans-serif', size: 14, weight: 400 },
      renderers: {
        nodes: 'built-in',
        edges: 'built-in',
        overrides: [
          {
            target: { kind: 'edge', id: 'reads' },
            renderer: {
              type: 'svg',
              id: 'badge',
              version: '1',
              bounds: { x: 280, y: 74, width: 340, height: 216 },
              fidelity: 'equivalent',
              reason: 'Fixture vector badge; host declaration remains unverified',
            },
          },
        ],
      },
      layout: { snapshot, renderKey: 'vector-badge-v1' },
    };
    const result = writeSvgExport(editor, options, {
      adapters: [
        {
          id: 'badge',
          version: '1',
          render: (context) => {
            if (context.kind !== 'edge' || !context.layoutRoute || !context.labelBox)
              throw new Error('Missing effective adapter geometry');
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
                fill: context.theme.tokens.nodeBackground,
                stroke: context.theme.tokens.nodeBorder,
                strokeWidth: 1,
              },
              {
                type: 'text',
                position: { x: position.x, y: position.y - 8.75 },
                text: context.edge.label,
                anchor: 'middle',
                baseline: 'middle',
              },
            ];
          },
        },
      ],
    });
    expect(result.type).toBe('written');
    await writeFile(
      fileURLToPath(new URL(`svg-retained-${scheme}.svg`, import.meta.url)),
      result.svg,
    );
    fixtures.set(`/svg-retained-${scheme}.svg`, result.svg);
    samples.push({ scheme, bounds: result.plan.contentBounds, findings: result.findings });
  }
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  page.setDefaultTimeout(15000);
  const errors = [],
    external = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const base = `http://127.0.0.1:${server.address().port}`;
  page.on('request', (request) => {
    if (!request.url().startsWith(base) && !request.url().startsWith('data:'))
      external.push(request.url());
  });
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const xmlPreview = async () => {
    const uri = await page.getByRole('img', { name: 'SVG export preview' }).getAttribute('src');
    return decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
  };
  const model = async () => {
    await section('History');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return await readFile(await file.path(), 'utf8');
  };
  await page.goto(base);
  await page.locator('[data-flow-node="review"]').waitFor();
  await section('SVG export');
  const toggle = page.getByRole('checkbox', { name: 'Use retained layout in SVG', exact: true });
  await expect(toggle).not.toBeChecked();
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeFocused();
  await expect(page.locator('[data-zloz-svg-download]')).toBeDisabled();
  await expect(page.locator('body')).toContainText('Arrange with ELK');
  await toggle.uncheck();
  await section('Diagram');
  await button('Open C4 container view').click();
  await button('Arrange with ELK').click();
  await expect(page.getByText('Layout applied.', { exact: true })).toBeVisible();
  const before = await model();
  const nativeRoutes = await page
    .locator('[data-flow-edge]')
    .evaluateAll((elements) =>
      elements.map((el) => ({ id: el.getAttribute('data-flow-edge'), path: el.getAttribute('d') })),
    );
  expect(nativeRoutes.length).toBeGreaterThan(0);
  await section('SVG export');
  const canonical = await xmlPreview();
  await toggle.check();
  await expect(
    page.getByText(
      'Retained routes are included. Label artwork remains subject to fidelity findings.',
      { exact: true },
    ),
  ).toBeVisible();
  const retained = await xmlPreview();
  const exported = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
    return {
      errors: doc.querySelectorAll('parsererror').length,
      paths: [...doc.querySelectorAll('[data-zloz-export-edge]')].map((el) => ({
        id: el.getAttribute('data-zloz-export-edge'),
        path: el.querySelector('path')?.getAttribute('d'),
      })),
    };
  }, retained);
  expect(exported.errors).toBe(0);
  for (const edge of nativeRoutes)
    expect(exported.paths.find((e) => e.id === edge.id)?.path).toBe(edge.path);
  const acceptance = page.getByRole('checkbox', {
    name: 'Accept the reported SVG losses',
    exact: true,
  });
  if (await acceptance.count()) {
    if (!(await acceptance.isChecked())) await acceptance.click();
    await expect(acceptance).toBeChecked();
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-zloz-svg-download]').click(),
  ]);
  expect(await readFile(await download.path(), 'utf8')).toBe(retained);
  await writeFile(fileURLToPath(new URL('svg-retained-workbench.svg', import.meta.url)), retained);
  await toggle.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('svg-retained-workbench-light.png', import.meta.url)),
  });
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await toggle.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('svg-retained-workbench-dark.png', import.meta.url)),
  });
  await toggle.uncheck();
  expect(await model()).toBe(before);
  // Real standalone SVG documents, rendered without the app or DOM injection.
  for (const scheme of ['light', 'dark']) {
    await page.goto(`${base}/svg-retained-${scheme}.svg`);
    await expect(page.locator('parsererror')).toHaveCount(0);
    await expect(page.locator('[data-zloz-export-edge="reads"] polyline')).toHaveAttribute(
      'points',
      '280,290 400,290 400,100 620,100 620,290',
    );
    await expect(page.locator('[data-zloz-export-edge="reads"] rect')).toHaveAttribute('x', '425');
    await expect(page.locator('[data-zloz-export-edge="reads"] text')).toHaveAttribute(
      'y',
      '91.25',
    );
    await page.locator('svg').screenshot({
      path: fileURLToPath(new URL(`svg-retained-standalone-${scheme}.png`, import.meta.url)),
    });
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  console.log(
    JSON.stringify({
      browser: browser.version(),
      nativeRouteCount: nativeRoutes.length,
      retainedBytesDifferFromCanonical: retained !== canonical,
      samples,
      checks:
        'keyboard opt-in/default, no-route protection, actual ELK/native path equality, exact downloaded bytes, source/lineage unchanged, light/dark workbench and standalone safe-vector badge',
      pageErrors: errors,
      externalRequests: external,
    }),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
