import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch();
await (async () => {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(
    process.env.ZLOZ_REVIEW_URL ?? 'http://127.0.0.1:4328/brand/zloz/',
  );
  assert.equal(response.status(), 200);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.proof-header').count(), 6);
  assert.equal(await page.locator('.proof-header .proof-brand svg').count(), 18);
  const marks = await page
    .locator('.proof-header svg')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  assert.ok(marks.every((width) => width === 32));
  for (const size of [16, 24, 32]) {
    const widths = await page
      .locator(`[data-logo-size="${size}"] svg`)
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
    assert.equal(widths.length, 6);
    assert.ok(widths.every((width) => width === size));
  }
  const colors = await page
    .locator('[data-logo-concept="a"] .proof-brand-zloz path:first-child')
    .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).fill));
  assert.deepEqual(colors, ['rgb(61, 121, 250)', 'rgb(68, 133, 255)']);
  assert.equal(await page.locator('[data-logo-mono]').count(), 6);
  const downloads = await page
    .locator('.asset-links a')
    .evaluateAll((elements) => elements.map((element) => element.href));
  assert.equal(downloads.length, 6);
  for (const url of downloads) {
    const svg = await page.evaluate(async (href) => (await fetch(href)).text(), url);
    const viewBox = await page.evaluate(
      (source) =>
        new DOMParser()
          .parseFromString(source, 'image/svg+xml')
          .documentElement.getAttribute('viewBox'),
      svg,
    );
    assert.equal(viewBox, '0 0 32 32');
  }
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert.ok(await noOverflow());
  await page.screenshot({
    path: new URL('./zloz-logos-light.png', import.meta.url).pathname,
    fullPage: true,
  });
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.screenshot({
    path: new URL('./zloz-logos-dark.png', import.meta.url).pathname,
    fullPage: true,
  });
  await page
    .locator('#concept-a .theme-pair')
    .screenshot({ path: new URL('./zloz-family-headers.png', import.meta.url).pathname });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('h1').click();
  assert.ok(await noOverflow());
  const mobileMarks = await page
    .locator('.proof-header svg')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  assert.ok(mobileMarks.every((width) => width === 24));
  await page.screenshot({
    path: new URL('./zloz-logos-mobile.png', import.meta.url).pathname,
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await writeFile(
    new URL('./zloz-logos-browser.json', import.meta.url),
    `${JSON.stringify({ result: 'pass', url: page.url(), headers: 6, familyMarks: 18, downloads: 6, desktop: '1600px; 32px family marks', mobile: '390px; 24px family marks', smallSizes: [16, 24, 32], themeToggle: 'pass', overflow: 'none at tested widths', pageErrors: errors }, null, 2)}\n`,
  );
})().finally(() => browser.close());
