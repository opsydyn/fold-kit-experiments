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
    reducedMotion: 'no-preference',
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
  const rewind = () => page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  const status = () => page.getByLabel('Edition playback status', { exact: true });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open DDD Order aggregate').click();
  await section('History');
  const original = await download();
  await section('Diagram');
  await page.locator('[data-flow-handle="order"]').press('ArrowRight');
  await section('History');
  await button('Load Order history example').click();
  const working = await download();
  await rewind().selectOption('order-start');
  await page.getByRole('checkbox', { name: 'Show comparison ghosts', exact: true }).check();
  await expect(
    page.getByRole('checkbox', { name: 'Enable edition playback', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Enable edition playback', exact: true }).check();
  await page.getByRole('combobox', { name: 'Edition interval', exact: true }).selectOption('1000');
  await expect(
    page.getByRole('group', { name: 'Edition playback controls', exact: true }),
  ).toHaveClass('workbench-playback-transport');
  await expect(button('Play editions')).toHaveAttribute('type', 'button');
  await button('Play editions').press('Enter');
  await expect(status()).toContainText('Playing');
  await page.waitForTimeout(250);
  await expect(rewind()).toHaveValue('order-start');
  await button('Pause editions').click();
  await expect(status()).toContainText('Paused');
  await page.waitForTimeout(1200);
  await expect(rewind()).toHaveValue('order-start');
  await button('Play editions').click();
  await expect(rewind()).toHaveValue('order-evolved', { timeout: 5000 });
  await expect(status()).toContainText('Paused');
  await expect(page.locator('[data-zloz-history-node="removed"]')).toHaveCount(1);
  expect(await download()).toEqual(working);
  for (const theme of ['Light', 'Dark']) {
    await page
      .getByRole('combobox', { name: 'Theme', exact: true })
      .selectOption(theme.toLowerCase());
    await page
      .getByRole('group', { name: 'Edition playback', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: fileURLToPath(
        new URL(`./playback-controls-${theme.toLowerCase()}.png`, import.meta.url),
      ),
    });
  }
  await button('Rewind editions').click();
  await expect(rewind()).toHaveValue('order-start');
  await button('Play editions').click();
  await expect(status()).toContainText('Playing');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(button('Play editions')).toBeDisabled();
  await expect(status()).toContainText('Paused');
  await expect(page.getByLabel('Playback availability', { exact: true })).toContainText(
    'reduced motion',
  );
  await page.waitForTimeout(1200);
  await expect(rewind()).toHaveValue('order-start');
  await expect(button('Play editions')).toHaveAttribute('aria-description', /reduced motion/);
  await button('Next edition').press('Enter');
  await expect(rewind()).toHaveValue('order-evolved');
  await page.getByRole('group', { name: 'Edition playback', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('./playback-controls-reduced-motion.png', import.meta.url)),
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(button('Play editions')).toBeEnabled();
  await expect(status()).toContainText('Paused');
  await button('Rewind editions').click();
  await button('Play editions').click();
  await button('Return to present').click();
  await page.waitForTimeout(1200);
  await expect(rewind()).toHaveValue('');
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
          'public package control group with custom layout and badge',
          'native Enter activation and disabled reason descriptions',
          'playback disabled by default',
          'first edition receives full interval',
          'pause cancels timed advancement',
          'end pauses with existing ghost comparison',
          'working model export stays exact',
          'rewind and manual step',
          'live reduced-motion change pauses without auto-resume',
          'return to present rejects old ticks and retains Undo',
          'light/dark/reduced-motion screenshots',
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
