/* oxlint-disable linteffect/no-return-in-callback, linteffect/no-return-in-arrow, linteffect/no-try-catch -- Browser evidence asserts public UI behavior and closes its own browser. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const base = process.env.ZLOZ_EVIDENCE_URL ?? 'http://127.0.0.1:4390';
const output = new URL('./v3-svg/', import.meta.url);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
  acceptDownloads: true,
});
const errors = [],
  checks = [];
page.on('pageerror', (error) => errors.push(String(error)));
const button = (name) => page.getByRole('button', { name, exact: true });
const panel = () => page.getByRole('group', { name: 'SVG export review', exact: true });
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
  page.screenshot({ path: new URL(name, output).pathname, fullPage: true });
try {
  assert.equal((await page.goto(`${base}/groups/`))?.status(), 200);
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
  await page.getByText('SVG export review', { exact: true }).click();
  await button('Use retained ELK routes').click();
  await expect(panel().getByRole('button', { name: 'Download SVG', exact: true })).toBeEnabled();
  const preview = panel().getByRole('img', { name: 'SVG export preview' });
  await expect
    .poll(() => preview.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await screenshot('light-review.png');
  const downloadEvent = page.waitForEvent('download');
  await panel().getByRole('button', { name: 'Download SVG', exact: true }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'zloz-native-v3.svg');
  await download.saveAs(new URL('native-light.svg', output).pathname);
  const svg = await readFile(new URL('native-light.svg', output), 'utf8');
  const inspected = await page.evaluate((svg) => {
    const xml = new DOMParser().parseFromString(svg, 'image/svg+xml'),
      root = xml.documentElement;
    const sockets = [...xml.querySelectorAll('[data-zloz-export-port]')].map((g) => ({
      owner: g.getAttribute('data-zloz-export-owner'),
      port: g.getAttribute('data-zloz-export-port'),
      x: Number(g.querySelector('circle').getAttribute('cx')),
      y: Number(g.querySelector('circle').getAttribute('cy')),
    }));
    const edges = [...xml.querySelectorAll('[data-zloz-export-edge]')].map((g) => {
      const path = g.querySelector('path'),
        first = path.getPointAtLength(0),
        last = path.getPointAtLength(path.getTotalLength());
      return {
        id: g.getAttribute('data-zloz-export-edge'),
        first: { x: first.x, y: first.y },
        last: { x: last.x, y: last.y },
      };
    });
    return {
      version: root.getAttribute('data-zloz-document-version'),
      mode: root.getAttribute('data-zloz-connection-mode'),
      ports: root.getAttribute('data-zloz-group-ports'),
      parserErrors: xml.querySelectorAll('parsererror').length,
      sockets,
      edges,
      unsafe: xml.querySelectorAll('script,foreignObject').length,
    };
  }, svg);
  assert.equal(inspected.version, '3');
  assert.equal(inspected.mode, 'strict');
  assert.equal(inspected.ports, 'true');
  assert.equal(inspected.parserErrors, 0);
  assert.equal(inspected.unsafe, 0);
  const groupSocket = inspected.sockets.find((p) => p.owner === 'orders' && p.port === 'api');
  const groupEdge = inspected.edges.find((e) => e.id !== 'service-events');
  assert(groupSocket && groupEdge);
  assert(
    Math.abs(groupEdge.first.x - groupSocket.x) < 0.001 &&
      Math.abs(groupEdge.first.y - groupSocket.y) < 0.001,
  );
  assert.deepEqual(await nodes(), arranged);
  checks.push(
    'Light native SVG download parses as XML, retains v3/mode/capability metadata and connected group-port anchors, and leaves authored bounds unchanged.',
  );
  await expect
    .poll(() => panel().getByRole('button', { name: 'Download SVG', exact: true }).isEnabled())
    .toBe(true);
  await button('Show custom workshop shells').click();
  await expect(page.locator('[data-zloz-workshop-badge]')).toHaveCount(3);
  const acceptance = panel().getByRole('checkbox', { name: 'Accept the reported SVG losses' });
  await expect(acceptance).not.toBeChecked();
  await expect(panel().getByRole('button', { name: 'Download SVG', exact: true })).toBeDisabled();
  await acceptance.check();
  await expect(panel().getByRole('button', { name: 'Download SVG', exact: true })).toBeEnabled();
  await button('Use dark theme').click();
  await expect(acceptance).not.toBeChecked();
  await expect(panel().getByRole('button', { name: 'Download SVG', exact: true })).toBeDisabled();
  await acceptance.check();
  await screenshot('dark-fidelity-review.png');
  checks.push(
    'Custom live workshop shells require explicit fallback consent; changing the palette invalidates consent. Dark review remains readable.',
  );
  const darkEvent = page.waitForEvent('download');
  await panel().getByRole('button', { name: 'Download SVG', exact: true }).click();
  await (await darkEvent).saveAs(new URL('native-dark.svg', output).pathname);
  const artifact = await browser.newPage();
  await artifact.goto(
    `data:image/svg+xml;base64,${Buffer.from(await readFile(new URL('native-dark.svg', output))).toString('base64')}`,
  );
  await artifact.locator('svg').screenshot({ path: new URL('exported-dark.png', output).pathname });
  await artifact.close();
  await expect
    .poll(() => panel().getByRole('button', { name: 'Download SVG', exact: true }).isEnabled())
    .toBe(true);
  await button('Protect SVG downloads').click();
  await button('Minimal mode').click();
  await expect(
    panel().getByText('SVG downloads are protected in this workspace.', { exact: true }),
  ).toBeVisible();
  await expect(panel().getByRole('button', { name: 'Download SVG', exact: true })).toBeDisabled();
  await expect(page.locator('[data-zloz-svg-readout]')).toHaveCount(0);
  await screenshot('minimal-protected.png');
  assert.deepEqual(await nodes(), arranged);
  checks.push(
    'Live protected downloads remain blocked with visible reasons and findings in minimal mode; measurement readouts are hidden.',
  );
  await button('Undo').click();
  await expect.poll(nodes).toEqual(original);
  checks.push(
    'After both downloads and review changes, one Undo still restores the preceding layout in full.',
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
    new URL('browser.json', output),
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
        download: {
          lightBytes: Buffer.byteLength(svg),
          lightSha256: createHash('sha256').update(svg).digest('hex'),
          darkSha256: createHash('sha256')
            .update(await readFile(new URL('native-dark.svg', output)))
            .digest('hex'),
          inspected,
        },
        sourceHashes,
        limits: [
          'Local production build in headless Chromium. No hosted, physical-device, human screen-reader or broad performance acceptance. SVG is static artwork, not an editable model codec.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ checks: checks.length, errors, output: output.pathname }));
} finally {
  await browser.close();
}
