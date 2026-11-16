/* oxlint-disable linteffect/no-return-in-callback, linteffect/no-return-in-arrow, linteffect/no-try-catch -- This browser qualification script asserts public UI behavior and always closes its own browser. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { parseModelDocumentV3 } from '@opsydyn/foldkit-zloz';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const base = process.env.ZLOZ_EVIDENCE_URL ?? 'http://127.0.0.1:4388';
const directory = new URL('./v3-core/', import.meta.url);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
});
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const checks = [];
const button = (name) => page.getByRole('button', { name, exact: true });
const node = (id) => page.locator(`[data-flow-node="${id}"]`);
const x = (id) => node(id).evaluate((element) => Number.parseFloat(element.style.left));
const waitX = (id, value) =>
  page.waitForFunction(
    ({ id, value }) =>
      Number.parseFloat(document.querySelector(`[data-flow-node="${id}"]`)?.style.left ?? '') ===
      value,
    { id, value },
  );
const screenshot = (name) =>
  page.screenshot({ path: new URL(name, directory).pathname, fullPage: true });
try {
  const response = await page.goto(`${base}/groups/`);
  assert.equal(response?.status(), 200);
  await page.locator('[data-flow-surface]').waitFor();
  await button('Fit view').click();
  await button('Select or move Orders boundary').click();
  const initialX = await x('orders'),
    childX = await x('service');
  await screenshot('light.png');
  const handle = await button('Select or move Orders boundary').boundingBox();
  assert(handle);
  await page.mouse.move(handle.x + 80, handle.y + 20);
  await page.mouse.down();
  await page.mouse.move(handle.x + 140, handle.y + 40, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction(
    (value) =>
      Number.parseFloat(document.querySelector('[data-flow-node="orders"]')?.style.left ?? '') !==
      value,
    initialX,
  );
  const movedX = await x('orders');
  assert.equal((await x('service')) - childX, movedX - initialX);
  await button('Undo').click();
  await waitX('orders', initialX);
  assert.equal(await x('service'), childX);
  checks.push('Pointer group movement moves descendants once and Undo restores both.');
  await button('Select or move Orders boundary').focus();
  await page.keyboard.press('ArrowRight');
  await waitX('orders', initialX + 5);
  await button('Undo').click();
  await waitX('orders', initialX);
  checks.push('Keyboard movement and Undo.');
  await page.locator('[data-flow-owner="orders"][data-flow-port="api"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-flow-owner="warehouse"][data-flow-port="input"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('[data-flow-edge]').length === 2);
  await button('Undo').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-flow-edge]').length === 1);
  checks.push('Keyboard source/target creation preserves group endpoint and one Undo.');
  await button('Select or move Orders boundary').click();
  await button('Protect service and interface').click();
  await expect(button('Move right')).toBeDisabled();
  await expect(button('Add output port')).toBeDisabled();
  assert((await page.locator('.workbench-sidebar').innerText()).includes('The service is pinned'));
  await button('Use dark theme').click();
  await page.locator('[data-flow-workbench-color-scheme="dark"]').waitFor();
  const darkControl = await button('Collapse group').evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }));
  assert.notEqual(darkControl.background, 'rgb(255, 255, 255)');
  assert.notEqual(darkControl.background, darkControl.color);

  await screenshot('dark-protected.png');
  await button('Minimal mode').click();
  await button('Show diagnostics').waitFor();
  assert(
    (await page.locator('.workbench-sidebar').innerText()).includes(
      'The published interface is protected.',
    ),
  );
  await screenshot('minimal-protected.png');
  checks.push('Live policy reasons remain visible in dark/minimal presentation.');
  await button('Disable protection').click();
  await expect(button('Add output port')).toBeEnabled();
  await button('Add output port').click();
  await page.waitForFunction(
    () => document.querySelectorAll('[data-flow-owner="orders"][data-flow-port]').length === 2,
  );
  await button('Undo').click();
  await page.waitForFunction(
    () => document.querySelectorAll('[data-flow-owner="orders"][data-flow-port]').length === 1,
  );
  checks.push('Native group-port addition and Undo.');
  await button('Save checkpoint').click();
  await button('Review Edition 1').click();
  await page.locator('[data-flow-readonly="true"]').waitFor();
  await expect(button('Undo')).toBeDisabled();
  await screenshot('readonly-edition.png');
  await button('Return to working model').click();
  await page.locator('[data-flow-readonly="false"]').waitFor();
  await button('Move right').click();
  await waitX('orders', initialX + 20);
  await button('Review Edition 1').click();
  await button('Restore checkpoint').click();
  await waitX('orders', initialX);
  await button('Undo').click();
  await waitX('orders', initialX + 20);
  checks.push('Detached read-only edition review, guarded restore and one Undo.');
  await page.getByText('Portable v3 model', { exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    button('Download model').click(),
  ]);
  const output = new URL('model-v3.json.txt', directory).pathname;
  await download.saveAs(output);
  const text = await readFile(output, 'utf8');
  const decoded = parseModelDocumentV3(text);
  assert.equal(decoded.snapshot.capabilities.groupPorts, true);
  assert.equal(decoded.editions.length, 1);
  await page.getByRole('textbox', { name: 'Canonical v3 model JSON' }).fill(text);
  await button('Open in new session').click();
  await page
    .getByText('Opened a validated v3 model in a new session with independent Undo.', {
      exact: true,
    })
    .waitFor();
  await expect(button('Undo')).toBeDisabled();
  await waitX('orders', initialX + 20);
  checks.push(
    'Downloaded canonical model strictly reopens with retained edition/capability and independent Undo.',
  );
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
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
        browser: await browser.version(),
        node: process.version,
        date: new Date().toISOString(),
        baseHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        sourceHashes,
        viewport: { width: 1440, height: 960 },
        reducedMotion: 'reduce',
        checks,
        errors,
        limits: [
          'Headless Chromium only. No human screen-reader, physical-device or broad performance acceptance.',
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
      output: new URL('browser.json', directory).pathname,
    }),
  );
} finally {
  await browser.close();
}
