import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseModelDocument } from '../../../packages/foldkit-zloz/dist/index.mjs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
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
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections', exact: true })
      .getByRole('button', { name, exact: true })
      .click();
  const download = async () => {
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return parseModelDocument(await readFile(await file.path(), 'utf8'));
  };
  const selected = () => page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  const slider = () => page.getByRole('slider', { name: 'Seek edition', exact: true });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open DDD Order aggregate').click();
  await section('History');
  const original = await download();
  await section('Diagram');
  await page.locator('[data-flow-handle="order"]').press('ArrowRight');
  await section('History');
  await button('Load scrubber history example').click();
  const working = await download();
  expect(working.editions).toHaveLength(8);
  await page.getByRole('checkbox', { name: 'Enable edition playback', exact: true }).check();
  await expect(slider()).toHaveAttribute('max', '7');
  await expect(button('Play editions')).toBeDisabled();
  await expect(slider()).toBeEnabled();
  await button('Open edition').press('Enter');
  await expect(selected()).toHaveValue('scrubber-order-0');
  await page.getByRole('checkbox', { name: 'Show comparison ghosts', exact: true }).check();
  await slider().press('End');
  await expect(slider()).toBeFocused();
  await expect(selected()).toHaveValue('scrubber-order-7');
  await expect(slider()).toHaveAttribute('aria-valuetext', 'Ordering · Final review');
  await slider().press('Home');
  await expect(slider()).toBeFocused();
  await expect(selected()).toHaveValue('scrubber-order-0');
  await slider().press('ArrowRight');
  await expect(slider()).toBeFocused();
  await expect(selected()).toHaveValue('scrubber-order-1');
  await slider().press('Home');
  const track = await slider().boundingBox();
  if (!track) throw new Error('Missing range bounds');
  await page.mouse.move(track.x + 8, track.y + track.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width - 8, track.y + track.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(selected()).toHaveValue('scrubber-order-7');
  await expect(slider()).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(button('Play editions')).toBeEnabled();
  await slider().press('Home');
  await page.getByRole('combobox', { name: 'Edition interval', exact: true }).selectOption('1000');
  await button('Play editions').click();
  await expect(page.getByLabel('Edition playback status', { exact: true })).toContainText(
    'Playing',
  );
  await slider().press('ArrowRight');
  await expect(page.getByLabel('Edition playback status', { exact: true })).toContainText('Paused');
  await page.waitForTimeout(1200);
  await expect(selected()).toHaveValue('scrubber-order-1');
  await slider().press('End');
  await page
    .getByRole('combobox', { name: 'History comparison baseline', exact: true })
    .selectOption('scrubber-order-0');
  await expect(page.locator('[data-zloz-history-node="removed"]')).toHaveCount(1);
  const ghost = (name) => page.getByRole('checkbox', { name, exact: true });
  const group = page.getByRole('group', { name: 'History comparison controls', exact: true });
  await expect(group).toBeVisible();
  await expect(page.getByLabel('History comparison status', { exact: true })).toContainText(
    'compared with',
  );
  const layers = ['Node ghosts', 'Edge ghosts', 'Movement connectors'];
  for (const name of layers) {
    await ghost(name).uncheck();
    await expect(ghost(name)).toBeEnabled();
  }
  await expect(page.locator('[data-zloz-history-node]')).toHaveCount(0);
  await expect(page.locator('[data-zloz-history-edge]')).toHaveCount(0);
  await expect(page.locator('[data-zloz-history-movement]')).toHaveCount(0);
  await ghost('Show comparison ghosts').uncheck();
  await ghost('Node ghosts').check();
  await ghost('Show comparison ghosts').check();
  await expect(ghost('Edge ghosts')).not.toBeChecked();
  await expect(page.locator('[data-zloz-history-node="removed"]')).toHaveCount(1);
  await section('Diagnostics');
  await button('Minimal mode').click();
  await expect(page.locator('[data-zloz-history-ghosts]')).toHaveCount(0);
  await section('History');
  await expect(ghost('Show comparison ghosts')).toBeChecked();
  await expect(ghost('Node ghosts')).toBeChecked();
  await expect(ghost('Edge ghosts')).not.toBeChecked();
  await expect(page.getByLabel('History comparison availability', { exact: true })).toContainText(
    'Minimal mode',
  );
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('History');
  await expect(page.locator('[data-zloz-history-node="removed"]')).toHaveCount(1);
  await ghost('Edge ghosts').check();
  await ghost('Movement connectors').check();
  // Preferences remain live during play; selecting a baseline pauses the host timer.
  await slider().press('Home');
  await button('Play editions').click();
  await ghost('Node ghosts').uncheck();
  await expect(page.getByLabel('Edition playback status', { exact: true })).toContainText(
    'Playing',
  );
  await page
    .getByRole('combobox', { name: 'History comparison baseline', exact: true })
    .selectOption('scrubber-order-7');
  await expect(page.getByLabel('Edition playback status', { exact: true })).toContainText('Paused');
  await ghost('Node ghosts').check();
  await slider().press('End');
  await page
    .getByRole('combobox', { name: 'History comparison baseline', exact: true })
    .selectOption('scrubber-order-0');
  await expect(
    page
      .getByRole('combobox', { name: 'History comparison baseline', exact: true })
      .locator('option[value="scrubber-order-7"]'),
  ).toHaveCount(0);
  const changes = page.getByRole('list', { name: 'History changes', exact: true });
  const filter = (name) => page.getByRole('checkbox', { name, exact: true });
  const viewChange = (name) => changes.getByRole('button', { name, exact: true });
  await filter('Added changes').uncheck();
  await expect(changes.getByRole('button', { name: /View added/ })).toHaveCount(0);
  await filter('Removed changes').uncheck();
  await filter('Changed changes').uncheck();
  await expect(changes.locator('li')).toHaveCount(0);
  await expect(page.getByLabel('History changes status', { exact: true })).toHaveText(
    'No changes match these filters.',
  );
  await filter('Removed changes').check();
  await expect(changes.locator('li')).toHaveCount(1);
  await viewChange('View removed node: Pricing policy').press('Enter');
  await expect(viewChange('View removed node: Pricing policy')).toBeFocused();
  const removed = await page.locator('[data-zloz-history-node="removed"]').boundingBox();
  const canvas = await page.locator('#flow-demo-surface').boundingBox();
  if (!removed || !canvas) throw new Error('Missing focused ghost/canvas');
  const centerX = removed.x + removed.width / 2,
    centerY = removed.y + removed.height / 2;
  expect(centerX).toBeGreaterThan(canvas.x);
  expect(centerX).toBeLessThan(canvas.x + canvas.width);
  expect(centerY).toBeGreaterThan(canvas.y);
  expect(centerY).toBeLessThan(canvas.y + canvas.height);
  await filter('Added changes').check();
  await filter('Changed changes').check();
  await slider().press('Home');
  await slider().press('ArrowRight');
  await button('Play editions').click();
  await expect(page.getByLabel('Edition playback status', { exact: true })).toContainText(
    'Playing',
  );
  await viewChange('View changed node: Order').press('Enter');
  await expect(viewChange('View changed node: Order')).toBeFocused();
  await expect(page.getByLabel('Edition playback status', { exact: true })).toContainText('Paused');
  await page.waitForTimeout(1200);
  await expect(selected()).toHaveValue('scrubber-order-1');
  await slider().press('End');
  await page
    .getByRole('combobox', { name: 'History comparison baseline', exact: true })
    .selectOption('scrubber-order-0');
  await viewChange('View added node: Delivery').press('Enter');
  await expect(viewChange('View added node: Delivery')).toBeFocused();
  await viewChange('View removed node: Pricing policy').press('Enter');
  // Restore the overall review frame for the visual captures after qualifying focus.
  await slider().press('Home');
  await slider().press('End');
  await page
    .getByRole('combobox', { name: 'History comparison baseline', exact: true })
    .selectOption('scrubber-order-0');
  expect(await download()).toEqual(working);
  for (const theme of ['Light', 'Dark']) {
    await page
      .getByRole('combobox', { name: 'Theme', exact: true })
      .selectOption(theme.toLowerCase());
    await page
      .getByRole('group', { name: 'History change navigator', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: fileURLToPath(
        new URL(`./change-navigator-${theme.toLowerCase()}.png`, import.meta.url),
      ),
    });
  }
  await button('Return to present').click();
  await page.waitForTimeout(1200);
  await expect(selected()).toHaveValue('');
  expect(await download()).toEqual(working);
  await section('Diagram');
  await button('Undo').click();
  await section('History');
  expect((await download()).snapshot.graph).toEqual(original.snapshot.graph);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'package change list with custom badges',
          'Added/Removed/Changed filters and empty-state summary',
          'removed focus keeps earlier ghost geometry within the canvas',
          'native Enter activation retains keyboard focus',
          'explicit change focus pauses playback and rejects old ticks',
          'current and removed focus preserve working model and prior Undo',
          'composable comparison group and named baseline',
          'all ghost layers independently switchable',
          'master and minimal mode retain layer preferences',
          'ghost preferences remain live during playback',
          'baseline selection pauses playback',
          'current edition excluded from baselines',
          'eight named checkpoints',
          'explicit current-point opening with Enter',
          'native End/Home/Arrow seeking retains focus',
          'native pointer drag across checkpoints',
          'custom labels and aria-valuetext',
          'manual seek remains usable with reduced motion',
          'seek pauses timed playback and rejects old ticks',
          'existing ghosts compare selected checkpoint',
          'working model and prior Undo preserved',
          'light/dark screenshots',
        ],
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
