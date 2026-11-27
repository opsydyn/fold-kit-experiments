import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, firefox, webkit, expect } = require('@playwright/test');
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
const engine = process.env.ZLOZ_BROWSER ?? 'chromium';
const browser = await { chromium, firefox, webkit }[engine].launch();
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    reducedMotion: 'reduce',
    hasTouch: engine === 'chromium',
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const count = () => page.locator('[data-flow-node]').count();
  const source = () => page.locator('[data-zloz-palette-entry="c4-person"]');
  const preview = page.locator('[data-zloz-placement-preview]');
  const host = page.locator('[data-zloz-placement-host]');
  const place = button('Place fragment');
  const start = async () => {
    await source().focus();
    await page.keyboard.press('Enter');
    await expect(host).toHaveAttribute('data-zloz-placement-active', 'true');
    await expect(source()).toHaveAttribute('aria-pressed', 'true');
    await expect(place).toBeEnabled();
  };
  const nudge = async (key) => {
    const revision = await host.getAttribute('data-zloz-placement-target-revision');
    await page.keyboard.press(key);
    await expect(host).not.toHaveAttribute('data-zloz-placement-target-revision', revision);
  };
  const capture = async (name) => {
    if (process.env.ZLOZ_PALETTE_SCREENSHOTS)
      await page.screenshot({ path: resolve(process.env.ZLOZ_PALETTE_SCREENSHOTS, name + '.png') });
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('[data-flow-node="review"]').waitFor();
  const initial = await count();
  await section('Diagram');
  await expect(
    page
      .locator('[data-architecture-effect-ui="pattern-insertion"]')
      .getByRole('group', { name: 'Placement palette' }),
  ).toBeVisible();
  await source().scrollIntoViewIfNeeded();
  await start();
  await expect(preview).toBeVisible();
  expect(await count()).toBe(initial);
  await nudge('ArrowRight');
  await nudge('Alt+ArrowDown');
  await capture('palette-native');
  await expect(source()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-flow-node]')).toHaveCount(initial + 1);
  await expect(host).toHaveAttribute('data-zloz-placement-active', 'false');
  await button('Undo').click();
  await expect(page.locator('[data-flow-node]')).toHaveCount(initial);
  await start();
  await page.keyboard.press('Escape');
  await expect(host).toHaveAttribute('data-zloz-placement-active', 'false');
  await expect(preview).toHaveCount(0);
  expect(await count()).toBe(initial);
  await start();
  await expect(preview).toBeVisible();
  await page.getByRole('checkbox', { name: 'Protect pattern insertion', exact: true }).check();
  await expect(place).toBeDisabled();
  await expect(
    page.getByText('Pattern insertion is protected in this workspace.', { exact: true }).first(),
  ).toBeVisible();
  await capture('palette-protected');
  await button('Cancel placement').click();
  await page.getByRole('checkbox', { name: 'Protect pattern insertion', exact: true }).uncheck();
  await button('Use custom palette').click();
  await expect(source()).toContainText('Compose a new system element');
  await expect(source()).toHaveCSS('border-top-style', 'dashed');
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await source().scrollIntoViewIfNeeded();
  const card = await source().boundingBox();
  const canvas = await page.locator('[data-flow-surface]').boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.45, canvas.y + canvas.height * 0.5, {
    steps: 10,
  });
  await expect(preview).toBeVisible();
  await capture('palette-custom-light');
  await page.mouse.up();
  await expect(page.locator('[data-flow-node]')).toHaveCount(initial + 1);
  const mousePlaced = await page.locator('[data-flow-node]').last().boundingBox();
  expect(Math.abs(mousePlaced.x - (canvas.x + canvas.width * 0.45))).toBeLessThan(2);
  expect(Math.abs(mousePlaced.y - (canvas.y + canvas.height * 0.5))).toBeLessThan(2);
  await button('Undo').click();
  await expect(page.locator('[data-flow-node]')).toHaveCount(initial);
  if (engine === 'chromium') {
    // Chromium touch emulation exercises actual PointerEvents and capture, not a synthetic reducer call.
    await source().scrollIntoViewIfNeeded();
    const touchCard = await source().boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: touchCard.x + 20, y: touchCard.y + 20 }],
    });
    await expect(source()).toHaveAttribute('aria-pressed', 'true');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: canvas.x + canvas.width * 0.5, y: canvas.y + canvas.height * 0.55 }],
    });
    await expect(preview).toBeVisible();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('[data-flow-node]')).toHaveCount(initial + 1);
    const touchPlaced = await page.locator('[data-flow-node]').last().boundingBox();
    expect(Math.abs(touchPlaced.x - (canvas.x + canvas.width * 0.5))).toBeLessThan(2);
    expect(Math.abs(touchPlaced.y - (canvas.y + canvas.height * 0.55))).toBeLessThan(2);
    await button('Undo').click();
    await expect(page.locator('[data-flow-node]')).toHaveCount(initial);
  }
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await source().scrollIntoViewIfNeeded();
  await start();
  await capture('palette-custom-dark');
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('Diagram');
  await source().scrollIntoViewIfNeeded();
  await expect(page.locator('[data-zloz-placement-readout]')).toHaveCount(0);
  await expect(preview).toBeVisible();
  await capture('palette-minimal');
  await button('Cancel placement').click();
  expect(await count()).toBe(initial);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      browser: engine + ' ' + browser.version(),
      viewport: '1600x1100',
      checks:
        'keyboard, mouse drag, cancellation, live protection, one Undo, native/custom, light/dark/minimal',
      touch: engine === 'chromium' ? 'verified' : 'not run',
      pageErrors: errors,
    }),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
