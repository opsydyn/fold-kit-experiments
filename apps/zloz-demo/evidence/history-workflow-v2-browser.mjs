import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const { chromium, firefox, webkit, expect } = require('@playwright/test');
const browserName = process.env.ZLOZ_HISTORY_BROWSER ?? 'chromium';
const engine = { chromium, firefox, webkit }[browserName];
assert(engine, `Unsupported browser: ${browserName}`);
const base = process.env.ZLOZ_HISTORY_URL ?? 'http://127.0.0.1:4377';
const output = process.env.ZLOZ_HISTORY_EVIDENCE_DIR
  ? pathToFileURL(resolve(process.env.ZLOZ_HISTORY_EVIDENCE_DIR) + '/')
  : new URL('./', import.meta.url);
const browser = await engine.launch();
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const response = await page.goto(`${base}/history/`);
  assert.equal(response?.status(), 200);
  assert.match(await response.text(), /data-effect-ui-state/u);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Architecture through time' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review / compare', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await expect(page.getByLabel('Working connection mode')).toHaveText('Working mode: strict');
  await page.getByRole('button', { name: 'Review chosen edition', exact: true }).click();
  await expect(page.getByLabel('Review connection mode')).toHaveText('Review mode: loose');
  await expect(page.locator('[data-zloz-history-ghosts]')).toHaveCount(1);
  await expect(page.locator('[data-zloz-history-ghosts]')).toHaveAttribute('aria-hidden', 'true');
  const world = page.locator('[data-flow-world-overlay]').locator('xpath=..');
  const before = await world.getAttribute('style');
  await page
    .getByRole('button', {
      name: 'View Connection mode changed from strict to loose.',
      exact: true,
    })
    .click();
  assert.equal(await world.getAttribute('style'), before);
  await page.getByLabel('Show minimap', { exact: true }).check();
  const overview = page.getByRole('button', { name: 'Diagram overview' });
  await expect(overview.locator('[data-flow-minimap-viewport]')).toHaveCount(1);
  await overview.press('ArrowRight');
  await expect(world).not.toHaveAttribute('style', before);
  const nudged = await world.getAttribute('style');
  assert(nudged);
  await overview.click({ position: { x: 24, y: 24 } });
  await expect(world).not.toHaveAttribute('style', nudged);
  const pointed = await world.getAttribute('style');
  assert(pointed);
  await overview.press('Enter');
  await expect(world).not.toHaveAttribute('style', pointed);
  await page.getByLabel('Show minimap', { exact: true }).uncheck();
  await page.getByLabel('Comparison side').selectOption('baseline');
  await expect(page.getByLabel('Review connection mode')).toHaveText('Review mode: strict');
  await expect(page.locator('[data-zloz-history-node="changed"]')).toHaveAttribute(
    'transform',
    'translate(140 320)',
  );
  await expect(page.locator('[data-zloz-history-edge="added"]')).toHaveCount(1);
  await page.getByLabel('Comparison side').selectOption('selected');
  await page
    .getByRole('heading', { name: 'Review and compare', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('history-workflow-v2-light.png', output)),
    fullPage: true,
  });
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await expect(page.locator('[data-flow-workbench-color-scheme="dark"]')).toHaveCount(1);
  await page
    .getByRole('heading', { name: 'Review and compare', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('history-workflow-v2-dark.png', output)),
    fullPage: true,
  });
  await page.getByLabel('Minimal mode', { exact: true }).check();
  await expect(page.locator('[data-zloz-history-ghosts]')).toHaveCount(0);
  await expect(page.getByLabel('Show comparison ghosts')).toBeChecked();
  await page.screenshot({
    path: fileURLToPath(new URL('history-workflow-v2-minimal.png', output)),
    fullPage: true,
  });
  await page.getByLabel('Minimal mode', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Restore / Undo', exact: true }).click();
  await page.getByLabel('Protect edition restore').check();
  await page.getByRole('button', { name: 'Preview restore', exact: true }).click();
  await expect(page.getByLabel('History workflow status')).toContainText('protected');
  await expect(page.getByRole('button', { name: 'Confirm restore', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Working connection mode')).toHaveText('Working mode: strict');
  await page.getByLabel('Protect edition restore').uncheck();
  await page.getByRole('button', { name: 'Preview restore', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm restore', exact: true }).click();
  await expect(page.getByLabel('Working connection mode')).toHaveText('Working mode: loose');
  await page.getByRole('button', { name: 'Undo working edit', exact: true }).click();
  await expect(page.getByLabel('Working connection mode')).toHaveText('Working mode: strict');
  await page.getByRole('button', { name: 'Redo working edit', exact: true }).click();
  await expect(page.getByLabel('Working connection mode')).toHaveText('Working mode: loose');
  await page.getByRole('button', { name: 'Capture / files', exact: true }).click();
  await page.getByLabel('Edition name', { exact: true }).fill('Captured loose working state');
  await page.getByRole('button', { name: 'Capture working edition', exact: true }).click();
  async function download(label, name) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: label, exact: true }).click();
    const file = await pending;
    const path = fileURLToPath(new URL(name, output));
    await file.saveAs(path);
    return JSON.parse(await readFile(path, 'utf8'));
  }
  const model = await download('Download v2 model', 'history-workflow-v2-model.json');
  const archive = await download('Download v2 editions', 'history-workflow-v2-editions.json');
  assert.equal(model.version, 2);
  assert.equal(model.document.snapshot.connectionMode, 'loose');
  assert.equal(archive.editions.length, 3);
  const graph = model.document.snapshot.graph;
  const edge = graph.edges.find((item) => item.id === 'shared-inputs');
  assert.equal(
    graph.nodes
      .find((item) => item.id === edge.source.node)
      .ports.find((item) => item.id === edge.source.port).kind,
    'input',
  );
  assert.equal(
    graph.nodes
      .find((item) => item.id === edge.target.node)
      .ports.find((item) => item.id === edge.target.port).kind,
    'input',
  );
  const upload = (label, value) =>
    page.getByLabel(label, { exact: true }).setInputFiles({
      name: 'history.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(value)),
    });
  await upload('Merge v2 editions', archive);
  await expect(page.getByLabel('History workflow status')).toContainText('Identical editions');
  const conflict = structuredClone(archive);
  conflict.editions[0].name = 'Conflicting identity';
  await upload('Merge v2 editions', conflict);
  await expect(page.getByLabel('Edition import conflict')).toBeVisible();
  await page
    .getByLabel('Merge v2 editions', { exact: true })
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from([255]) });
  await expect(page.getByLabel('History workflow status')).toContainText(
    'Unsupported or invalid v2',
  );
  const withOutline = structuredClone(model);
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- This field is part of the portable v2 authoring contract.
  withOutline.document.snapshot.graph.nodes[0].appearance = { shape: 'cylinder' };
  const architectureNodes = withOutline.document.snapshot.graph.nodes;
  architectureNodes[0].architecture = {
    family: 'c4',
    role: 'container',
    scope: 'external',
    technology: 'PostgreSQL',
    description: 'Stores orders',
  };
  architectureNodes.push(
    {
      id: 'order-context',
      label: 'Order management',
      kind: 'group',
      position: { x: 80, y: 530 },
      size: { width: 300, height: 200 },
      ports: [],
      architecture: { family: 'ddd', role: 'bounded-context', subdomain: 'core' },
    },
    {
      id: 'billing-hotspot',
      parentId: 'order-context',
      label: 'Billing delay',
      position: { x: 125, y: 595 },
      size: { width: 220, height: 120 },
      ports: [],
      architecture: { family: 'event-storming', role: 'hotspot', status: 'resolved' },
    },
  );
  const contexts = [
    { id: 'orders-ddd', label: 'Order lifecycle', position: { x: 80, y: 800 } },
    { id: 'billing-ddd', label: 'Billing ledger', position: { x: 690, y: 800 } },
    { id: 'catalog-ddd', label: 'Product catalog', position: { x: 690, y: 1110 } },
  ];
  architectureNodes.push(
    ...contexts.map((context) => ({
      ...context,
      size: { width: 220, height: 130 },
      ports: [
        { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
        { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
      ],
      architecture: { family: 'ddd', role: 'bounded-context' },
    })),
  );
  withOutline.document.snapshot.graph.edges.push(
    {
      id: 'order-facts',
      source: { node: 'orders-ddd', port: 'out' },
      target: { node: 'billing-ddd', port: 'in' },
      architecture: {
        family: 'ddd',
        scope: 'strategic',
        role: 'upstream-downstream',
        upstream: ['open-host-service'],
        downstream: 'anti-corruption-layer',
      },
    },
    {
      id: 'product-ids',
      source: { node: 'orders-ddd', port: 'out' },
      target: { node: 'catalog-ddd', port: 'in' },
      architecture: { family: 'ddd', scope: 'strategic', role: 'shared-kernel' },
    },
  );
  await upload('Open v2 model', withOutline);
  await expect(page.getByLabel('History workflow status')).toContainText('fresh independent Undo');
  await expect(page.getByLabel('Working connection mode')).toHaveText('Working mode: loose');
  const outline = page.locator('[data-node-outline="cylinder"] svg');
  await expect(outline.locator('path')).toHaveCount(2);
  await expect(outline.locator('path').first()).toHaveAttribute('d', /^M0,16 A110,16/u);
  const container = page.locator('[data-flow-c4-node="a"]');
  await expect(container.locator('.flow-c4-type')).toHaveText('Container · external');
  await expect(container.locator('.flow-c4-technology')).toHaveText('PostgreSQL');
  await expect(container.locator('.flow-c4-description')).toHaveText('Stores orders');
  await expect(
    container.getByRole('button', { name: 'Select Orders' }),
  ).toHaveAccessibleDescription('Container · external. PostgreSQL. Stores orders');
  await expect(container.locator('[data-flow-c4-outline]')).toHaveAttribute(
    'stroke-dasharray',
    '6 4',
  );
  await expect(
    page.locator('[data-flow-ddd-group="order-context"] .flow-ddd-subdomain'),
  ).toHaveText('Core subdomain');
  await expect(
    page.locator('[data-zloz-event-storming-node="billing-hotspot"] [data-zloz-hotspot-status]'),
  ).toHaveText('Resolved');
  const directed = page.locator('[data-zloz-context-map-edge="order-facts"]');
  const symmetric = page.locator('[data-zloz-context-map-edge="product-ids"]');
  await expect(directed).toHaveAttribute('marker-end', /url\(#history-v2-\d+-arrow\)/u);
  await expect(symmetric).toHaveCount(1);
  await expect(symmetric).not.toHaveAttribute('marker-end', /./u);
  const contract = page.getByRole('group', {
    name: /Order lifecycle, Upstream, Open host service to Billing ledger, Downstream, Anti-corruption layer/u,
  });
  await expect(contract.getByText('OHS', { exact: true })).toBeAttached();
  await expect(contract.getByText('ACL', { exact: true })).toBeAttached();
  await expect(page.locator('[data-zloz-context-map-label="product-ids"]')).toContainText(
    'Shared kernel',
  );
  const hotspot = page.locator('[data-flow-node="billing-hotspot"]');
  const collapse = page.getByRole('button', { name: 'Collapse Order management' });
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await collapse.click();
  await expect(hotspot).toHaveCount(0);
  const expand = page.getByRole('button', { name: 'Expand Order management' });
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expand.click();
  await expect(hotspot).toBeVisible();
  const reopened = await download('Download v2 model', 'history-workflow-v2-notation.json');
  assert.deepEqual(reopened.document.snapshot.graph, withOutline.document.snapshot.graph);

  await page.getByRole('button', { name: 'Switch to previous model session', exact: true }).click();
  await expect(outline).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore / Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo working edit', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo working edit', exact: true }).click();
  await expect(page.getByLabel('Working connection mode')).toHaveText('Working mode: strict');
  await page.getByRole('button', { name: 'Playback', exact: true }).click();
  await page.getByRole('button', { name: 'Play editions', exact: true }).click();
  await expect(page.getByLabel('Edition playback state')).toHaveText('Playback: playing');
  await expect(page.getByLabel('Review connection mode'))
    .toHaveText('Review mode: loose', {
      timeout: 10_000,
    })
    .catch(async (error) => {
      console.log(
        JSON.stringify({
          playback: await page.getByLabel('Edition playback state').textContent(),
          notice: await page.getByLabel('History workflow status').textContent(),
          errors,
        }),
      );
      throw error;
    });
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await expect(page.getByLabel('Edition playback state')).toHaveText('Playback: paused');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Play editions', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Rewind editions', exact: true }).click();
  await expect(page.getByLabel('Review connection mode')).toHaveText('Review mode: strict');
  await page.getByRole('button', { name: 'Next edition', exact: true }).click();
  await expect(page.getByLabel('Review connection mode')).toHaveText('Review mode: loose');
  assert.deepEqual(errors, []);
  await writeFile(
    new URL('history-workflow-v2-browser.json', output),
    JSON.stringify(
      {
        result: 'passed',
        provenance: `local production build, mounted ${browserName}`,
        cases: [
          'mode inspection without camera move',
          'minimap pointer navigation, keyboard pan and centering while reviewing',
          'baseline/selected ghost geometry and chronological meaning',
          'light/dark/minimal',
          'protected preview and cross-mode Undo/Redo',
          'capture/download/import/conflict/invalid UTF-8',
          'C4, DDD and Event Storming notation, strategic direction, and previous working session history',
          'play/pause/rewind/reduced motion',
        ],
        pageErrors: errors,
      },
      null,
      2,
    ) + '\n',
  );
}
await run().finally(() => browser.close());
