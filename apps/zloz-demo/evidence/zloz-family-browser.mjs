import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const boardUrl = process.env.ZLOZ_BOARD_URL ?? 'http://127.0.0.1:4323/';
const promoUrl = process.env.ZLOZ_PROMO_URL ?? 'http://127.0.0.1:4328/brand/zloz/';
const browser = await chromium.launch();
const output = (name) => fileURLToPath(new URL(name, import.meta.url));
await (async () => {
  // Match the unchanged family source palettes as well as the rendered Zloz board.
  for (const app of ['promo', 'three-promo']) {
    const css = await readFile(
      new URL(`../../${app}/src/styles/site.css`, import.meta.url),
      'utf8',
    );
    for (const value of ['#faf9f6', '#fffefa', '#111319', '#191c24', '#3d79fa', '#4485ff']) {
      expect(css).toContain(value);
    }
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  });
  const errors = [],
    external = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:')) external.push(request.url());
  });
  await page.goto(boardUrl);
  const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
  const surface = page.locator('[data-flow-surface]');
  const button = (name) => page.getByRole('button', { name, exact: true });
  await expect(theme).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('body')).toHaveCSS('font-family', '"Inter Variable", sans-serif');
  expect(await page.evaluate(() => document.fonts.check('740 18px "Inter Variable"'))).toBe(true);
  await expect(page).toHaveTitle('Architecture workbench | Foldkit Zloz');
  await button('Open nested C4 container view').click();
  await expect(surface.locator('[data-flow-c4-node]')).toHaveCount(4);
  const snapshot = async () => {
    await page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name: 'Diagram', exact: true })
      .click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export JSON').click(),
    ]);
    return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
  };
  const original = await snapshot();
  for (const [mode, background, panel, accent] of [
    ['light', 'rgb(250, 249, 246)', 'rgb(255, 254, 250)', '#3d79fa'],
    ['dark', 'rgb(17, 19, 25)', 'rgb(25, 28, 36)', '#4485ff'],
  ]) {
    await theme.selectOption(mode);
    await expect(page.locator('body')).toHaveCSS('background-color', background);
    await expect(surface).toHaveCSS('background-color', background);
    await expect(page.locator('.workbench-sidebar')).toHaveCSS('background-color', panel);
    expect(
      await page
        .locator('body')
        .evaluate((element) => getComputedStyle(element).getPropertyValue('--blue').trim()),
    ).toBe(accent);
    expect(await snapshot()).toEqual(original);
    await page.screenshot({ path: output(`zloz-family-board-${mode}.png`) });
  }
  const frame = surface.locator('[data-flow-node="orders-api"]');
  const handle = surface.locator('[data-flow-handle="orders-api"]');
  await handle.click();
  const before = await frame.getAttribute('style');
  await handle.press('ArrowRight');
  await expect.poll(() => frame.getAttribute('style')).not.toBe(before);
  await button('Undo').click();
  expect(await snapshot()).toEqual(original);
  await page.reload();
  await expect(theme).toHaveValue('dark');
  await expect(surface).toHaveCSS('color-scheme', 'dark');
  await theme.selectOption('system');
  await expect(surface).toHaveCSS('color-scheme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(surface).toHaveCSS('color-scheme', 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await button('Hide controls').click();
  await expect(button('Show controls')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const box = await surface.boundingBox();
  expect(box.width).toBeGreaterThan(300);
  await page.screenshot({ path: output('zloz-family-board-mobile.png') });
  // First paint follows the system even when the saved preference is unavailable.
  const initial = await browser.newPage({ colorScheme: 'dark' });
  await initial.route('**/*', (route) =>
    route.request().resourceType() === 'script' ? route.abort() : route.continue(),
  );
  await initial.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    }),
  );
  await initial.goto(boardUrl);
  await expect(initial.locator('body')).toHaveCSS('background-color', 'rgb(17, 19, 25)');
  await initial.close();
  await page.goto(promoUrl);
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(page.locator('[data-final-identity]')).toHaveCount(2);
  await expect(page.locator('.proof-header')).toHaveCount(6);
  const downloads = await page
    .locator('.final-downloads a')
    .evaluateAll((elements) => elements.map((element) => element.href));
  expect(downloads).toHaveLength(5);
  for (const href of downloads) {
    const source = await page.evaluate(async (url) => (await fetch(url)).text(), href);
    expect(source).toContain('<svg');
    expect(source).not.toContain('<text');
    expect(source).not.toContain('<image');
  }
  for (const mode of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== mode)
      await page.locator('#theme-toggle').click();
    await page
      .locator('.final-identity')
      .screenshot({ path: output(`zloz-family-identity-${mode}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await writeFile(
    output('zloz-family-browser.json'),
    JSON.stringify(
      {
        result: 'pass',
        boardUrl,
        promoUrl,
        palettes: 'Viz / Three / Zloz neutral and blue',
        localInter: true,
        graphPreservedAcrossThemes: true,
        undo: 'pass',
        systemAndPersistedTheme: 'pass',
        firstPaintBlockedStorage: 'pass',
        mobileWidth: 390,
        svgDownloads: 5,
        pageErrors: errors,
        externalRequests: external,
      },
      null,
      2,
    ) + '\n',
  );
})().finally(() => browser.close());
