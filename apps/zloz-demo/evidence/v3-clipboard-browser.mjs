/* oxlint-disable linteffect/no-return-in-callback, linteffect/no-return-in-arrow, linteffect/no-try-catch -- Browser qualification asserts real native IO and restores test instrumentation/owned resources. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const directory = new URL('./v3-clipboard/', import.meta.url);
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const base = resolve(root),
      route = url.pathname;
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
  downloads = [];
page.on('pageerror', (error) => errors.push(String(error)));
const button = (name) => page.getByRole('button', { name, exact: true });
const handle = (id) => page.locator(`[data-flow-handle="${id}"]`);
const nodes = () => page.locator('[data-flow-node]');
const edges = () => page.locator('[data-flow-edge]');
const panel = () => page.getByRole('group', { name: 'V3 clipboard controls', exact: true });
async function snapshot(file) {
  const details = page.getByText('Portable v3 model', { exact: true });
  if (!(await button('Download model').isVisible())) await details.click();
  const pending = page.waitForEvent('download');
  await button('Download model').click();
  const download = await pending;
  await download.saveAs(new URL(file, directory).pathname);
  const bytes = await readFile(new URL(file, directory));
  const model = JSON.parse(bytes).document;
  downloads.push({
    file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    nodes: model.snapshot.graph.nodes.length,
    edges: model.snapshot.graph.edges.length,
  });
  return model.snapshot;
}
async function capture(file) {
  await panel().scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL(file, directory).pathname, fullPage: true });
}
try {
  assert.equal((await page.goto(`${base}/groups/`))?.status(), 200);
  await page.locator('[data-flow-surface]').waitFor();
  await page.locator('[data-flow-owner="orders"][data-flow-port="api"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-flow-owner="warehouse"][data-flow-port="input"]').focus();
  await page.keyboard.press('Enter');
  await expect(edges()).toHaveCount(2);
  const original = await snapshot('before.txt');
  await handle('orders').click();
  await handle('warehouse').click({ modifiers: ['Shift'] });
  await page.getByText('Clipboard', { exact: true }).click();
  await panel().getByRole('button', { name: 'Copy selection', exact: true }).click();
  await expect(panel().getByRole('button', { name: 'Paste copy', exact: true })).toBeEnabled();
  await panel().getByRole('button', { name: 'Paste copy', exact: true }).click();
  await expect(nodes()).toHaveCount(6);
  await expect(edges()).toHaveCount(4);
  const pasted = await snapshot('pasted.txt');
  assert.deepEqual(pasted.graph.nodes.slice(0, 3), original.graph.nodes);
  assert.deepEqual(pasted.graph.edges.slice(0, 2), original.graph.edges);
  assert.equal(pasted.connectionMode, original.connectionMode);
  assert.deepEqual(pasted.capabilities, original.capabilities);
  const copiedNodes = pasted.graph.nodes.slice(3),
    group = copiedNodes.find((n) => n.kind === 'group'),
    child = copiedNodes.find((n) => n.label === 'Order service'),
    warehouse = copiedNodes.find((n) => n.label === 'Warehouse');
  assert(group && child && warehouse);
  assert.equal(child.parentId, group.id);
  assert.equal(group.position.y, original.graph.nodes[0].position.y + 380);
  assert.notEqual(group.ports[0].id, 'api');
  assert.deepEqual(pasted.graph.edges[3].source, { node: group.id, port: group.ports[0].id });
  assert.deepEqual(pasted.graph.edges[3].target, {
    node: warehouse.id,
    port: warehouse.ports[0].id,
  });
  await expect(
    page.locator(`[data-flow-owner="${group.id}"][data-flow-port="${group.ports[0].id}"]`),
  ).toHaveCount(1);
  await button('Fit view').click();
  await capture('light-pasted.png');
  checks.push(
    'Actual package Copy/Paste controls preserve native group sockets, internal edges, mode/capability and child membership; downloaded canonical before/after records confirm explicit remapping and one translation.',
  );

  await handle('orders').focus();
  await page.keyboard.press('Control+v');
  await expect(nodes()).toHaveCount(9);
  await expect(edges()).toHaveCount(6);
  const repeated = await snapshot('repeated.txt');
  assert.equal(repeated.graph.nodes[6].position.y, original.graph.nodes[0].position.y + 760);
  await handle('orders').focus();
  await page.keyboard.press('Control+z');
  await expect(nodes()).toHaveCount(6);
  await handle('orders').focus();
  await page.keyboard.press('Control+z');
  await expect(nodes()).toHaveCount(3);
  await expect(edges()).toHaveCount(2);
  const undone = await snapshot('undone.txt');
  assert.deepEqual(undone.graph, original.graph);
  await handle('orders').focus();
  await page.keyboard.press('Control+Shift+z');
  await expect(nodes()).toHaveCount(6);
  checks.push(
    'Native keyboard paste advances occupied anchors; two keyboard Undos remove exactly two complete fragments while keeping clipboard, and Redo restores the full first paste.',
  );

  await button('Protect service and interface').click();
  await button('Minimal mode').click();
  await button('Use dark theme').click();
  await expect(panel().getByRole('button', { name: 'Paste copy', exact: true })).toBeDisabled();
  await expect(panel()).toContainText('The published interface is protected.');
  await capture('dark-protected.png');
  assert.equal(await nodes().count(), 6);
  checks.push(
    'Current live interface protection disables paste with a visible reason in dark/minimal mode; the complete target stays unchanged.',
  );

  await button('Disable protection').click();
  await handle('orders').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+c');
  await expect(
    panel().locator('[data-zloz-clipboard-finding="boundary-edge-omitted"]'),
  ).toHaveCount(2);
  await expect(panel()).not.toContainText('Clipboard state stays in this workbench session.');
  await capture('minimal-findings.png');
  checks.push(
    'Keyboard copy of a boundary includes descendants and retains both crossing-edge omission reasons in minimal mode; optional instructions are hidden.',
  );

  await button('Save checkpoint').click();
  await button('Review Edition 1').click();
  await expect(page.getByRole('region', { name: 'Read-only edition canvas' })).toBeVisible();
  await handle('orders').focus();
  await page.keyboard.press('Enter');
  await panel().getByRole('button', { name: 'Copy selection', exact: true }).click();
  await expect(panel().getByRole('button', { name: 'Paste copy', exact: true })).toBeDisabled();
  await expect(panel()).toContainText('The v3 editor is read-only.');
  await button('Return to working model').click();
  await expect(nodes()).toHaveCount(6);
  await expect(
    panel().locator('[data-zloz-clipboard-finding="boundary-edge-omitted"]'),
  ).toHaveCount(2);
  checks.push(
    'Read-only editions permit independent copying but block paste; returning preserves the working clipboard and authored document.',
  );
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
        sourceHashes,
        limits: [
          'Local production build and headless Chromium. No OS clipboard IO, hosted/registry publication, broad performance, physical-device or human screen-reader acceptance.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({ checks: checks.length, errors, downloads, output: directory.pathname }),
  );
} catch (error) {
  await page
    .screenshot({ path: '/private/tmp/zloz-clipboard-v3-failure.png', fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
