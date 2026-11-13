import { readFile } from 'node:fs/promises';
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
  const input = () => page.getByLabel('Open review packet', { exact: true });
  const fixture = fileURLToPath(
    new URL(
      '../../../packages/foldkit-zloz-mermaid/test/fixtures/review-packet-v1.json',
      import.meta.url,
    ),
  );
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('[data-flow-node="review"]').waitFor();
  const workingNodes = await page
    .locator('[data-flow-node]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-flow-node')));
  await section('Review packets');
  await input().setInputFiles(fixture);
  await expect(
    page.getByText('Packet opened read-only. Working model and Undo preserved.', { exact: true }),
  ).toBeVisible();
  await button('Fit packet').click();
  await expect(page.locator('[data-flow-node="note:2"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Diagram', exact: true })).toBeDisabled();
  await expect(page.locator('[aria-label="Packet findings"]')).toContainText('Introduced');
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await page.screenshot({
    path: fileURLToPath(new URL('review-reader-light.png', import.meta.url)),
  });
  const baseline = page.getByRole('button', { name: /^Baseline:/ });
  await baseline.click();
  await expect(baseline).toHaveAttribute('aria-pressed', 'true');
  await button('Fit packet').click();
  const previous = await page
    .locator('[data-flow-node]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-flow-node')));
  await input().setInputFiles({
    name: 'malformed.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  });
  await expect(page.getByRole('status').filter({ hasText: 'invalid-json' })).toBeVisible();
  await expect(baseline).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page
      .locator('[data-flow-node]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-flow-node'))),
  ).toEqual(previous);
  const forged = JSON.parse(await readFile(fixture, 'utf8'));
  forged.projections.selected.source += ' changed';
  await input().setInputFiles({
    name: 'forged.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(forged)),
  });
  await expect(page.getByRole('status').filter({ hasText: 'inconsistent-packet' })).toBeVisible();
  await input().setInputFiles({
    name: 'bad-utf8.json',
    mimeType: 'application/json',
    buffer: Buffer.from([0xc3]),
  });
  await expect(page.getByRole('status').filter({ hasText: 'Could not read UTF-8' })).toBeVisible();
  await expect(baseline).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('checkbox', { name: 'Protect packet opening', exact: true }).check();
  await expect(input()).toBeDisabled();
  await expect(
    page.getByRole('status').filter({ hasText: 'Packet opening is protected' }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await page.screenshot({
    path: fileURLToPath(new URL('review-reader-dark-protected.png', import.meta.url)),
  });
  await page.getByRole('checkbox', { name: 'Protect packet opening', exact: true }).uncheck();
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('Review packets');
  await expect(page.locator('[data-review-reader-counts]')).toHaveCount(0);
  await expect(page.locator('[aria-label="Packet findings"]')).toContainText('Introduced');
  await expect(input()).toBeEnabled();
  await page.screenshot({
    path: fileURLToPath(new URL('review-reader-minimal.png', import.meta.url)),
  });
  await button('Close packet review').click();
  await expect(page.locator('[data-flow-node="review"]')).toBeVisible();
  expect(
    await page
      .locator('[data-flow-node]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-flow-node'))),
  ).toEqual(workingNodes);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      browser: browser.version(),
      viewport: '1600x1100',
      checks:
        'native file opening, detached read-only canvas, chosen side retention, malformed/forged/invalid UTF-8 recovery, protection, light/dark/minimal, working graph restored',
      pageErrors: errors,
    }),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
