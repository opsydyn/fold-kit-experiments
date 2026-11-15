import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const svg = await readFile(new URL('svg-font-embedded.svg', import.meta.url));
const server = createServer((request, response) => {
  if (request.url !== '/font.svg') return response.writeHead(404).end();
  response.setHeader('Content-Type', 'image/svg+xml');
  response.end(svg);
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const browser = await chromium.launch();
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  const errors = [],
    external = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (
      !request.url().startsWith(`http://127.0.0.1:${server.address().port}/`) &&
      !request.url().startsWith('data:font/ttf;base64,')
    )
      external.push(request.url());
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/font.svg`);
  await expect(page.locator('parsererror')).toHaveCount(0);
  const font = await page.evaluate(async () => {
    const faces = await document.fonts.load('16px zloz-export-font', 'Orders');
    await document.fonts.ready;
    return faces.map((face) => ({ family: face.family, status: face.status }));
  });
  expect(font).toEqual([{ family: 'zloz-export-font', status: 'loaded' }]);
  await expect(page.locator('svg')).toHaveAttribute('font-family', 'zloz-export-font');
  await expect(page.locator('[data-zloz-export-node]')).toHaveCount(2);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page
    .locator('svg')
    .screenshot({ path: fileURLToPath(new URL('svg-font-embedded.png', import.meta.url)) });
  console.log(
    JSON.stringify({
      browser: browser.version(),
      font,
      pageErrors: errors,
      externalRequests: external,
    }),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
