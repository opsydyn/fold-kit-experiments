import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const check = () =>
    page.getByRole('checkbox', { name: 'Accept the reported SVG losses', exact: true });
  const download = () => page.locator('[data-zloz-svg-download]');
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('[data-flow-node="review"]').waitFor();
  await section('SVG export');
  const nativePanel = page.locator('[data-architecture-effect-ui-review="svg"]');
  await expect(nativePanel.getByRole('group', { name: 'SVG export review' })).toBeVisible();
  await expect(download()).toBeEnabled();
  await expect(page.getByRole('img', { name: 'SVG export preview' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'SVG findings' })).toContainText('unverified');
  const canvas = await page.locator('[data-flow-surface]').boundingBox();
  expect(canvas.x).toBeGreaterThan(350);
  expect(canvas.width).toBeGreaterThan(1000);
  await page.screenshot({ path: fileURLToPath(new URL('svg-review-native.png', import.meta.url)) });
  const choose = async (name, value) => {
    const preview = page.getByRole('img', { name: 'SVG export preview' });
    const before = await preview.getAttribute('src');
    const control = page.getByRole('combobox', { name, exact: true });
    await control.focus();
    await control.selectOption(value);
    await expect(preview).not.toHaveAttribute('src', before);
    await expect(control).toHaveValue(value);
    await expect(control).toBeFocused();
  };
  await choose('SVG region', 'viewport');
  await choose('SVG theme', 'dark');
  await choose('SVG background', 'transparent');
  const oldPanel = await nativePanel.elementHandle();
  await section('PNG export');
  await expect(nativePanel).toHaveCount(0);
  await expect(page.locator('[data-architecture-effect-ui-review="png"]')).toBeVisible();
  await section('SVG export');
  await expect(nativePanel.getByRole('combobox', { name: 'SVG background' })).toHaveValue(
    'transparent',
  );
  expect(await oldPanel.evaluate((host) => host.isConnected)).toBe(false);
  await oldPanel.dispose();
  const previewUri = await page
    .getByRole('img', { name: 'SVG export preview' })
    .getAttribute('src');
  const reviewedViewport = decodeURIComponent(previewUri.slice(previewUri.indexOf(',') + 1));
  const [viewportFile] = await Promise.all([page.waitForEvent('download'), download().click()]);
  const viewportXml = await readFile(await viewportFile.path(), 'utf8');
  expect(viewportXml).toBe(reviewedViewport);
  const parsed = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
    return {
      errors: doc.querySelectorAll('parsererror').length,
      width: Number(doc.documentElement.getAttribute('width')),
      background: doc.querySelector('svg > g > rect') !== null,
    };
  }, viewportXml);
  expect(parsed.errors).toBe(0);
  // The measured surface excludes its two CSS border pixels.
  const surfaceWidth = await page.locator('[data-flow-surface]').evaluate((el) => el.clientWidth);
  expect(parsed.width).toBe(surfaceWidth);
  expect(parsed.background).toBe(false);
  await writeFile(fileURLToPath(new URL('svg-review-viewport.svg', import.meta.url)), viewportXml);
  await expect(download()).toBeEnabled();
  await choose('SVG region', 'model');
  await choose('SVG background', 'theme');
  await choose('SVG theme', 'source');
  // A semantic context map needs explicit acknowledgement of both shell and relationship losses.
  await section('Diagram');
  await button('Open DDD context map').click();
  await section('SVG export');
  await expect(download()).toBeDisabled();
  await expect(check()).not.toBeChecked();
  await check().click();
  await expect(check()).toBeChecked();
  await expect(download()).toBeEnabled();
  await choose('SVG theme', 'dark');
  await expect(check()).not.toBeChecked();
  await expect(download()).toBeDisabled();
  await check().click();
  await expect(check()).toBeChecked();
  // Edit then Undo restores graph data but advances source revision: consent must still reset.
  await section('Diagram');
  await button('Insert C4 context pattern').click();
  await button('Undo').click();
  await section('SVG export');
  await expect(check()).not.toBeChecked();
  await expect(download()).toBeDisabled();
  await check().click();
  await expect(check()).toBeChecked();
  await page.getByRole('checkbox', { name: 'Protect SVG downloads', exact: true }).check();
  await expect(download()).toBeDisabled();
  await expect(check()).toBeChecked();
  await expect(
    page.getByRole('status').filter({ hasText: 'SVG downloads are protected' }),
  ).toBeVisible();
  await page.screenshot({
    path: fileURLToPath(new URL('svg-review-protected.png', import.meta.url)),
  });
  await page.getByRole('checkbox', { name: 'Protect SVG downloads', exact: true }).uncheck();
  await expect(download()).toBeEnabled();
  const finalPreviewUri = await page
    .getByRole('img', { name: 'SVG export preview' })
    .getAttribute('src');
  const reviewedSvg = decodeURIComponent(finalPreviewUri.slice(finalPreviewUri.indexOf(',') + 1));
  const [file] = await Promise.all([page.waitForEvent('download'), download().click()]);
  expect(file.suggestedFilename()).toBe('zloz-workbench.svg');
  const xml = await readFile(await file.path(), 'utf8');
  expect(xml).toBe(reviewedSvg);
  expect(xml).toContain('<svg');
  expect(xml).toContain('#111827');
  expect(xml).not.toContain('<script');
  await writeFile(fileURLToPath(new URL('svg-review-downloaded.svg', import.meta.url)), xml);
  await expect(download()).toBeEnabled();
  await button('Use custom SVG controls').click();
  await expect(page.locator('.svg-finding-card').first()).toBeVisible();
  await expect(download()).toHaveText('↓ Download reviewed SVG');
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await check().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('svg-review-custom-light.png', import.meta.url)),
  });
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await page.screenshot({
    path: fileURLToPath(new URL('svg-review-custom-dark.png', import.meta.url)),
  });
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('SVG export');
  await expect(page.locator('[data-zloz-svg-readout]')).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'SVG findings' })).toContainText('canonical');
  await expect(check()).toBeChecked();
  await expect(download()).toBeEnabled();
  await check().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('svg-review-minimal.png', import.meta.url)),
  });
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      browser: browser.version(),
      viewport: '1600x1100',
      checks:
        'native/custom, actual SVG download, visible findings, explicit losses, settings reset, edit+Undo reset, live protection, preview, light/dark/minimal, canvas visibility',
      pageErrors: errors,
    }),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
