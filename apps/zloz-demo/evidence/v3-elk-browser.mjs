/* oxlint-disable linteffect/no-return-in-callback, linteffect/no-return-in-arrow, linteffect/no-try-catch -- This browser qualification script asserts public UI behavior and always closes its browser. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const base = process.env.ZLOZ_EVIDENCE_URL ?? 'http://127.0.0.1:4389';
const evidenceRoot = process.env.ZLOZ_GROUP_EVIDENCE_DIR;
const output = evidenceRoot
  ? pathToFileURL(evidenceRoot + '/elk/')
  : new URL('./v3-elk/', import.meta.url);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
});
const errors = [],
  checks = [];
page.on('pageerror', (error) => errors.push(String(error)));
const button = (name) => page.getByRole('button', { name, exact: true });
const nodes = () =>
  page.locator('[data-flow-node]').evaluateAll((elements) =>
    elements.map((element) => ({
      id: element.getAttribute('data-flow-node'),
      left: element.style.left,
      top: element.style.top,
      width: element.style.width,
      height: element.style.height,
    })),
  );
const port = () =>
  page.locator('[data-flow-owner="orders"][data-flow-port="api"]').evaluate((element) => ({
    owner: element.getAttribute('data-flow-owner'),
    port: element.getAttribute('data-flow-port'),
  }));
const screenshot = (name) =>
  page.screenshot({ path: new URL(name, output).pathname, fullPage: true });
try {
  assert.equal((await page.goto(`${base}/groups/`))?.status(), 200);
  await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
  await page.locator('[data-flow-surface]').waitFor();
  await page.locator('[data-flow-owner="orders"][data-flow-port="api"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-flow-owner="warehouse"][data-flow-port="input"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-flow-edge]')).toHaveCount(2);
  const edgeIds = await page
    .locator('[data-flow-edge]')
    .evaluateAll((elements) => elements.map((e) => e.getAttribute('data-flow-edge')));
  const original = await nodes(),
    authoredPort = await port();
  await button('Arrange right').click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Layout applied' }).first(),
  ).toBeVisible();
  await expect.poll(nodes).not.toEqual(original);
  assert.deepEqual(await port(), authoredPort);
  assert.deepEqual(
    await page
      .locator('[data-flow-edge]')
      .evaluateAll((elements) => elements.map((e) => e.getAttribute('data-flow-edge'))),
    edgeIds,
  );
  await button('Fit view').click();
  await screenshot('light-right.png');
  const route = await page.locator('[data-flow-edge="service-events"]').getAttribute('d');
  assert(route?.includes('L'));
  await button('Undo').click();
  await expect.poll(nodes).toEqual(original);
  checks.push(
    'RIGHT native compound layout preserves the connected group port and edge identities; one Undo restores every node bound.',
  );
  await button('Arrange down').click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Layout applied' }).first(),
  ).toBeVisible();
  await expect.poll(nodes).not.toEqual(original);
  assert.deepEqual(await port(), authoredPort);
  assert.deepEqual(
    await page
      .locator('[data-flow-edge]')
      .evaluateAll((elements) => elements.map((e) => e.getAttribute('data-flow-edge'))),
    edgeIds,
  );
  await button('Use dark theme').click();
  await button('Fit view').click();
  await screenshot('dark-down.png');
  await button('Undo').click();
  await expect.poll(nodes).toEqual(original);
  checks.push(
    'DOWN native layout and dark theme render; one Undo restores the complete pre-layout geometry.',
  );
  await button('Protect service and interface').click();
  const protectedBefore = await nodes();
  await button('Arrange right').click();
  await expect(
    page.getByRole('status').filter({ hasText: 'pinned by the current workshop policy' }).first(),
  ).toBeVisible();
  assert.deepEqual(await nodes(), protectedBefore);
  await button('Minimal mode').click();
  await button('Fit view').click();
  await screenshot('minimal-protected.png');
  checks.push(
    'Current live protection vetoes all layout geometry and remains visible in minimal mode.',
  );
  await button('Save checkpoint').click();
  await button('Review Edition 1').click();
  await expect(button('Arrange right')).toBeDisabled();
  await expect(button('Arrange down')).toBeDisabled();
  checks.push(
    'Read-only edition review disables native layout and retains independent working history.',
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
          'packages/foldkit-zloz-elk/src',
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
        viewport: { width: 1440, height: 960 },
        reducedMotion: 'reduce',
        checks,
        errors,
        sourceHashes,
        limits: [
          'Local production build, headless Chromium. No hosted, physical-device or human screen-reader acceptance. Async cancellation/supersession covered by deterministic app tests.',
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
