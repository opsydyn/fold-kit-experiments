import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const directory = process.env.ZLOZ_PREFIX_DIST;
if (!directory) throw new Error('Set ZLOZ_PREFIX_DIST to the prefixed build directory');
const root = resolve(directory);
const prefix = '/preview/zloz/';
const mime = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  if (!route.startsWith(prefix)) {
    response.writeHead(404).end();
    return;
  }
  const relative = route.slice(prefix.length);
  const path = resolve(
    root,
    relative.endsWith('/') || relative === '' ? relative + 'index.html' : relative,
  );
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  await readFile(path).then(
    (body) => {
      response.setHeader('Content-Type', mime[extname(path)] ?? 'text/html');
      response.end(body);
    },
    () => response.writeHead(404).end(),
  );
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const browser = await chromium.launch();
await (async () => {
  const page = await browser.newPage({ colorScheme: 'light' });
  const errors = [],
    failed = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin + prefix);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('740 25px "Inter Variable"'))).toBe(true);
  await expect(page.locator('[data-preview-node]')).toHaveCount(4);
  const compose = page.locator('.compose-example');
  await expect(compose.locator('[data-flow-node]')).toHaveCount(3);
  await compose
    .getByRole('combobox', { name: 'New connection source' })
    .selectOption({ label: 'Review: Output' });
  await compose
    .getByRole('combobox', { name: 'New connection target' })
    .selectOption({ label: 'Publish: Input' });
  await expect(compose.locator('[data-flow-edge]')).toHaveCount(2);
  await compose.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(compose.locator('[data-flow-edge]')).toHaveCount(1);
  expect(await page.locator('.hero-actions a').first().getAttribute('href')).toBe(
    'http://127.0.0.1:4323/?from=zloz',
  );
  const local = await page
    .locator('a[href], link[href], script[src]')
    .evaluateAll((elements) =>
      elements.map((element) => element.href ?? element.src).filter(Boolean),
    );
  for (const href of local.filter((href) => new URL(href).origin === origin)) {
    expect(new URL(href).pathname.startsWith(prefix)).toBe(true);
    expect((await page.request.get(href)).status()).toBe(200);
  }
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Docs' })
    .click();
  await expect(page).toHaveURL(origin + prefix + 'docs/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('h1')).toHaveText('Start with the model.');
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  await writeFile(
    new URL('./basepath-browser.json', import.meta.url),
    JSON.stringify(
      {
        result: 'pass',
        basePath: prefix,
        configurableWorkbenchUrl: 'pass',
        localPageAssetsAndDownloads: 'HTTP 200 under prefix',
        font: 'local Inter loaded',
        navigation: 'home to docs with retained theme',
        composeIsland: 'hydrated; connection creation and Undo pass under prefix',
        pageErrors: errors,
        failedResponses: failed,
      },
      null,
      2,
    ) + '\n',
  );
})()
  .finally(() => browser.close())
  .finally(() => new Promise((resolve) => server.close(resolve)));
