import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { parseGraph } from '@opsydyn/foldkit-flow';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const origin = process.env.ZLOZ_PROMO_REVIEW_URL ?? 'http://127.0.0.1:4329/';
const base = new URL(origin);
const output = (name) => fileURLToPath(new URL(name, import.meta.url));
const browser = await chromium.launch();
await (async () => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const errors = [],
    external = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== base.origin) external.push(request.url());
  });
  const response = await page.goto(base.href);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('Compose');
  expect(html).toContain('data-preview-node="orders"');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 249, 246)');
  expect(await page.locator('[data-preview-node]').count()).toBe(4);
  await expect(page.locator('.context-preview')).toContainText('Static package-generated preview');
  expect(await page.locator('.hero-actions a').first().getAttribute('href')).toContain(
    'http://127.0.0.1:4323/',
  );
  await page.screenshot({ path: output('promo-light.png'), fullPage: true });
  await page.locator('#theme-toggle').click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 19, 25)');
  await page.screenshot({ path: output('promo-dark.png'), fullPage: true });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const sibling = await page.context().newPage();
  await sibling.goto(new URL('docs/', base).href);
  await expect(sibling.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#theme-toggle').click();
  await expect(sibling.locator('html')).toHaveAttribute('data-theme', 'light');
  await sibling.close();
  await page.evaluate(() => localStorage.removeItem('foldkit-zloz-theme'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const details = page.locator('.mermaid-source');
  await details.locator('summary').click();
  await expect(details.locator('code')).toContainText('flowchart LR');
  await expect(details.locator('.conversion-notes')).toContainText('layout');
  const jsonResponse = await page.request.get(new URL('downloads/order-context.json', base).href);
  expect(jsonResponse.status()).toBe(200);
  const graph = parseGraph(await jsonResponse.text());
  expect(graph.nodes.map((node) => node.id)).toEqual([
    'customer',
    'orders',
    'payments',
    'delivery',
  ]);
  const bundleResponse = await page.request.get(
    new URL('downloads/order-context.mermaid.json', base).href,
  );
  expect(bundleResponse.status()).toBe(200);
  const bundle = await bundleResponse.json();
  expect(bundle.identity.nodes.map((node) => node.flowId)).toEqual(
    graph.nodes.map((node) => node.id),
  );
  expect(bundle.identity.edges).toHaveLength(3);
  expect(bundle.diagnostics.some((item) => item.code === 'layout-omitted')).toBe(true);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download this C4 model', exact: false }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('order-context.json');
  await page.setViewportSize({ width: 390, height: 844 });
  await details.locator('summary').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('h1').scrollIntoViewIfNeeded();
  await page.locator('h1').click();
  await page.screenshot({ path: output('promo-mobile.png'), fullPage: true });
  await page.goto(new URL('docs/', base).href);
  await expect(
    page.getByRole('heading', { name: 'Start with the model.', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.code-panel')).toContainText("from '@opsydyn/foldkit-flow'");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const keyword = page.locator('.code-panel .pl-k').first();
  await expect(keyword).toHaveCSS('color', 'rgb(255, 123, 114)');
  await page.screenshot({ path: output('promo-docs.png'), fullPage: true });
  await page.locator('#theme-toggle').click();
  await expect(keyword).toHaveCSS('color', 'rgb(207, 34, 46)');
  await page.screenshot({ path: output('promo-docs-light.png'), fullPage: true });
  const localLinks = await page
    .locator('a[href]')
    .evaluateAll((elements) => elements.map((element) => element.href));
  for (const href of new Set(localLinks.filter((href) => new URL(href).origin === base.origin))) {
    expect((await page.request.get(href)).status()).toBe(200);
  }
  const noJs = await browser.newPage({ javaScriptEnabled: false });
  await noJs.goto(base.href);
  await expect(noJs.locator('[data-preview-node]')).toHaveCount(4);
  await noJs.locator('.mermaid-source summary').click();
  await expect(noJs.locator('.conversion-notes')).toBeVisible();
  await noJs.close();
  const firstPaint = await browser.newPage({ colorScheme: 'dark' });
  await firstPaint.route('**/*', async (route) => {
    if (route.request().isNavigationRequest()) {
      const response = await route.fetch();
      const html = await response.text();
      await route.fulfill({
        response,
        body: html.replace(/<script type="module"[\s\S]*?<\/script>/gu, ''),
      });
    } else if (route.request().resourceType() === 'script') await route.abort();
    else await route.continue();
  });
  await firstPaint.goto(base.href);
  await expect(firstPaint.locator('script[type="module"]')).toHaveCount(0);
  await expect(firstPaint.locator('body')).toHaveCSS('background-color', 'rgb(17, 19, 25)');
  await firstPaint.close();
  const blocked = await browser.newPage({ colorScheme: 'dark' });
  await blocked.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    }),
  );
  await blocked.goto(base.href);
  await expect(blocked.locator('html')).toHaveAttribute('data-theme', 'dark');
  await blocked.locator('#theme-toggle').click();
  await expect(blocked.locator('html')).toHaveAttribute('data-theme', 'light');
  await blocked.close();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await writeFile(
    output('promo-browser.json'),
    JSON.stringify(
      {
        result: 'pass',
        origin: base.href,
        themes: ['light', 'dark'],
        savedTheme: true,
        liveSystemTheme: true,
        crossTabTheme: true,
        blockedStorage: true,
        staticContentWithoutJavaScript: true,
        firstPaintWithoutModule: true,
        nativeMermaidDisclosure: true,
        syntaxHighlighting: 'shared Viz/Three tokens; light and dark colors verified',
        downloads: 'canonical graph plus Mermaid identity and loss report',
        mobileWidth: 390,
        internalLinks: 'HTTP 200',
        pageErrors: errors,
        externalRequests: external,
      },
      null,
      2,
    ) + '\n',
  );
})().finally(() => browser.close());
