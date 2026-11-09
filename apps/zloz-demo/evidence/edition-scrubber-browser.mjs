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
  expect(await download()).toEqual(working);
  for (const theme of ['Light', 'Dark']) {
    await page
      .getByRole('combobox', { name: 'Theme', exact: true })
      .selectOption(theme.toLowerCase());
    await page
      .getByRole('group', { name: 'Edition scrubber', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: fileURLToPath(
        new URL(`./edition-scrubber-${theme.toLowerCase()}.png`, import.meta.url),
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
