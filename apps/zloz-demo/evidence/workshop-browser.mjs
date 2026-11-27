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
    viewport: { width: 1600, height: 1200 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections', exact: true })
      .getByRole('button', { name, exact: true })
      .click();
  const download = async () => {
    await section('History');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return JSON.parse(await readFile(await file.path(), 'utf8')).document;
  };
  const panel = page.locator('[data-architecture-effect-ui="workshop-inspector"]');
  const convention = page.getByRole('checkbox', {
    name: 'Use workshop relationship convention',
    exact: true,
  });
  const protection = page.getByRole('checkbox', { name: 'Protect facilitator note', exact: true });
  const inspector = page.getByRole('combobox', { name: 'Inspect workshop node', exact: true });
  const status = page.getByRole('button', { name: 'Set hotspot status to Resolved', exact: true });
  const openStatus = page.getByRole('button', {
    name: 'Set hotspot status to Open question',
    exact: true,
  });
  const retry = page.locator('[data-flow-node="retry-question"]');
  const agreement = page.locator('[data-flow-node="timeout-agreement"]');
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open workshop semantics example').click();
  const lane = page.locator('[data-zloz-event-storming-group="workshop-lane"]');
  await expect(lane).toBeVisible();
  const collapse = lane.getByRole('button', { name: 'Collapse Payment discovery', exact: true });
  const more = lane.getByRole('button', {
    name: 'More actions for Payment discovery',
    exact: true,
  });
  await expect(more).toBeVisible();
  const collapseBounds = await collapse.boundingBox();
  const moreBounds = await more.boundingBox();
  if (!collapseBounds || !moreBounds) throw new Error('Lane buttons do not have bounds.');
  expect(collapseBounds.x + collapseBounds.width).toBeLessThan(moreBounds.x);
  await expect(page.locator('[data-flow-node="provider"] [data-flow-port]')).toHaveCount(2);
  await expect(retry.locator('[data-flow-port]')).toHaveCount(0);
  await expect(page.locator('[data-flow-group="workshop-lane"] [data-flow-port]')).toHaveCount(0);
  await expect(retry.getByText('Discuss · open', { exact: true })).toBeVisible();
  await expect(agreement.getByText('Agreed · resolved', { exact: true })).toBeVisible();
  const original = await download();
  await section('Inspect');
  await expect(panel.getByRole('heading', { name: 'Workshop meaning', exact: true })).toBeVisible();
  await expect(convention).toBeChecked();
  await convention.uncheck();
  await expect(convention).not.toBeChecked();
  await convention.check();
  await inspector.selectOption('retry-question');
  await expect(openStatus).toHaveAttribute('aria-pressed', 'true');
  await expect(button('Add input port')).toHaveCount(0);
  await status.focus();
  await status.press('Enter');
  await expect(status).toHaveAttribute('aria-pressed', 'true');
  await expect(status).toBeFocused();
  await expect(retry.getByText('Agreed · resolved', { exact: true })).toBeVisible();
  await section('Diagram');
  await button('Undo').click();
  await expect(retry.getByText('Discuss · open', { exact: true })).toBeVisible();
  expect((await download()).snapshot.graph).toEqual(original.snapshot.graph);
  await section('Inspect');
  await inspector.selectOption('timeout-agreement');
  await expect(status).toBeDisabled();
  await expect(
    page.getByRole('list', { name: 'Workshop restrictions', exact: true }),
  ).toContainText('facilitator');
  await protection.uncheck();
  await expect(status).toBeEnabled();
  await openStatus.click();
  await expect(agreement.getByText('Discuss · open', { exact: true })).toBeVisible();
  await section('Diagram');
  await button('Undo').click();
  await collapse.click();
  await expect(page.locator('[data-zloz-hotspot-status], [data-workbench-hotspot]')).toHaveCount(0);
  await button('Expand Payment discovery').press('Enter');
  await expect(retry.getByText('Discuss · open', { exact: true })).toBeVisible();
  await section('Inspect');
  await inspector.selectOption('provider');
  const role = page.getByRole('combobox', { name: 'Workshop role', exact: true });
  await expect(role.locator('option[value="hotspot"]')).toBeDisabled();
  await expect(
    page.getByRole('list', { name: 'Workshop restrictions', exact: true }),
  ).toContainText('Remove ports');
  await inspector.selectOption('retry-question');
  await expect(role).toHaveValue('hotspot');
  await expect(openStatus).toHaveAttribute('aria-pressed', 'true');
  await role.focus();
  await role.selectOption('command');
  await expect(role).toHaveValue('command');
  await expect(role).toBeFocused();
  await expect(status).toHaveCount(0);
  await expect(retry.locator('[data-zloz-event-storming-type="command"]')).toBeVisible();
  await expect(
    page.locator('[data-flow-node="provider"] [data-zloz-event-storming-type="external-system"]'),
  ).toBeVisible();
  await expect(retry.getByText('Discuss · open', { exact: true })).toHaveCount(0);
  await section('Diagram');
  await button('Undo').click();
  await expect(retry.getByText('Discuss · open', { exact: true })).toBeVisible();
  await section('Inspect');
  await inspector.selectOption('retry-question');
  await section('Diagnostics');
  await button('Minimal mode').click();
  await expect(retry.getByText('Discuss · open', { exact: true })).toBeVisible();
  await section('Inspect');
  await expect(status).toBeEnabled();
  await section('Diagnostics');
  await button('Minimal mode').click();
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).uncheck();
  await expect(retry.getByText('Discuss · open', { exact: true })).toBeVisible();
  await section('Inspect');
  await expect(status).toBeEnabled();
  await section('Diagnostics');
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).check();
  await section('Inspect');
  await protection.check();
  await inspector.selectOption('timeout-agreement');
  await expect(status).toBeDisabled();
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
    await page
      .getByRole('heading', { name: 'Workshop meaning', exact: true })
      .evaluate((e) => e.scrollIntoView({ block: 'start' }));
    if (process.env.ZLOZ_CAPTURE_DIR) {
      await page.screenshot({
        path: resolve(process.env.ZLOZ_CAPTURE_DIR, `workshop-${engine}-${theme}.png`),
      });
    }
  }
  expect((await download()).snapshot.graph).toEqual(original.snapshot.graph);
  await page.getByRole('textbox', { name: 'Edition name', exact: true }).fill('Workshop review');
  await button('Capture edition').click();
  const rewind = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  await expect(rewind.locator('option')).toHaveCount(2);
  const option = await rewind.locator('option').last().getAttribute('value');
  await rewind.selectOption(option);
  await expect(button('Back to present')).toBeVisible();
  await section('Inspect');
  await inspector.selectOption('retry-question');
  await expect(status).toBeDisabled();
  await expect(role).toBeDisabled();
  await expect(convention).toBeDisabled();
  await expect(protection).toBeDisabled();
  await expect(
    page.getByRole('list', { name: 'Workshop restrictions', exact: true }),
  ).toContainText('read-only');
  expect((await download()).snapshot.graph).toEqual(original.snapshot.graph);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'public starter and optional node/lane renderers',
          'external sockets live; hotspots and lanes portless',
          'custom semantic status and keyboard activation with retained focus',
          'role and status updates preserve focus and Undo restores the original graph',
          'live facilitator lock and visible port/kind restrictions',
          'lane collapse and context controls do not overlap; keyboard expansion still works',
          'status and editing remain independent of numeric diagnostics',
          'light/dark screenshots',
          'historical review status is read-only and working graph preserved',
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
