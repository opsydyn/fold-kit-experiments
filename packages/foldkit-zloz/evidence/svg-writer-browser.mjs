import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const names = ['light', 'dark-custom', 'viewport', 'transparent'];
const server = createServer(async (request, response) => {
  const name = names.find((name) => request.url === `/svg-writer-${name}.svg`);
  if (!name) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('Content-Type', 'image/svg+xml');
  response.end(await readFile(new URL(`svg-writer-${name}.svg`, import.meta.url)));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 760 },
    reducedMotion: 'reduce',
  });
  const errors = [],
    external = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (!request.url().startsWith(`http://127.0.0.1:${server.address().port}/`))
      external.push(request.url());
  });
  for (const name of names) {
    await page.goto(`http://127.0.0.1:${server.address().port}/svg-writer-${name}.svg`);
    await expect(page.locator('parsererror')).toHaveCount(0);
    await expect(page.locator('svg')).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
    await expect(page.locator('[data-zloz-export-node]')).toHaveCount(4);
    await expect(page.locator('[data-zloz-export-edge]')).toHaveCount(1);
    await expect(page.locator('[data-zloz-export-port]')).toHaveCount(
      name === 'dark-custom' ? 1 : 2,
    );
    await expect(page.locator('title')).toHaveText('Zloz architecture <&> review');
    await expect(page.locator('text').filter({ hasText: 'Client <&>' })).toHaveCount(1);
    await expect(page.locator('text').filter({ hasText: 'Orders & stock' })).toHaveCount(1);
    await expect(page.locator('script,foreignObject,image,use')).toHaveCount(0);
    const lengths = await page
      .locator('path')
      .evaluateAll((paths) => paths.map((path) => path.getTotalLength()));
    expect(lengths.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
    const boxes = await page.locator('text').evaluateAll((nodes) =>
      nodes.map((node) => {
        const b = node.getBBox();
        return { width: b.width, height: b.height };
      }),
    );
    expect(boxes.every((box) => box.width > 0 && box.height > 0)).toBe(true);
    if (name === 'dark-custom') {
      await expect(page.locator('[data-zloz-export-node="client"] circle').last()).toHaveAttribute(
        'cx',
        '255',
      );
      await expect(page.locator('[data-zloz-export-node="client"] circle').last()).toHaveAttribute(
        'cy',
        '235',
      );
    }
    if (name !== 'viewport') {
      const root = await page.locator('svg').boundingBox();
      const ink = await page.locator('text').evaluateAll((nodes) =>
        nodes.map((node) => {
          const b = node.getBoundingClientRect();
          return { x: b.x, y: b.y, right: b.right, bottom: b.bottom };
        }),
      );
      expect(
        ink.every(
          (b) =>
            b.x >= root.x &&
            b.y >= root.y &&
            b.right <= root.x + root.width &&
            b.bottom <= root.y + root.height,
        ),
      ).toBe(true);
    }
    if (name === 'transparent') await expect(page.locator('svg > g > rect')).toHaveCount(0);
    if (name === 'viewport') {
      await expect(page.locator('svg')).toHaveAttribute('width', '780');
      await expect(page.locator('svg')).toHaveAttribute('height', '480');
    }
    await page.screenshot({
      path: fileURLToPath(new URL(`svg-writer-${name}.png`, import.meta.url)),
    });
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  console.log(
    JSON.stringify({
      browser: browser.version(),
      files: names,
      viewport: '1100x760',
      checks:
        'real SVG files, XML parsing, nested groups, ports, text, paths, custom vector adapter, light/dark, viewport crop, transparent background',
      pageErrors: errors,
      externalRequests: external,
    }),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
