import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseEventStormingDddConversion,
  parseModelDocument,
} from '../../../packages/foldkit-zloz/dist/index.mjs';
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
    viewport: { width: 1600, height: 1400 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const errors = [];
  let receiptBytes = '';
  page.on('pageerror', (error) => errors.push(String(error)));
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const panel = page.getByRole('region', { name: 'Workshop mapping preview', exact: true });
  const item = panel.getByRole('combobox', { name: 'Review mapping', exact: true });
  const choice = panel.getByRole('combobox', { name: 'Preview choice', exact: true });
  const plan = panel.getByRole('region', { name: 'Conversion plan review', exact: true });
  const ack = plan.getByRole('checkbox', { name: 'Acknowledge plan losses', exact: true });
  const apply = plan.getByRole('button', { name: 'Apply DDD conversion', exact: true });
  const receipts = panel.getByRole('region', { name: 'Retained conversion receipts', exact: true });
  const openPlan = async () => {
    const details = page.locator('#mapping-conversion-plan');
    if ((await details.getAttribute('open')) === null)
      await details.locator(':scope > summary').click();
    await plan.scrollIntoViewIfNeeded();
  };
  const selectItem = async (key) => {
    await item.selectOption(key);
    const label = (await item.locator('option:checked').textContent()).split(' · ')[1];
    await expect(
      panel.getByLabel('Mapping decision', { exact: true }).getByRole('heading', { level: 3 }),
    ).toHaveText(label);
  };
  const resolveMappings = async () => {
    await section('Mapping review');
    for (const key of [
      'node:note:0',
      'node:note:1',
      'node:note:4',
      'node:note:5',
      'edge:step:0',
      'edge:step:1',
      'edge:step:3',
      'edge:step:4',
    ]) {
      await selectItem(key);
      await choice.selectOption('retain');
      await expect(panel.getByLabel('Mapping decision', { exact: true })).toHaveAttribute(
        'data-mapping-state',
        'retained',
      );
    }
  };
  const downloadModel = async () => {
    await section('History');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return parseModelDocument(await readFile(await file.path(), 'utf8'));
  };
  const openReceipt = async () => {
    await section('Mapping review');
    await expect(receipts).toBeVisible();
    const details = receipts.locator('details').first();
    if ((await details.getAttribute('open')) === null)
      await details.locator(':scope > summary').click();
    await receipts.scrollIntoViewIfNeeded();
  };
  const downloadReceipt = async () => {
    await openReceipt();
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      receipts.getByRole('button', { name: 'Download conversion receipt 1', exact: true }).click(),
    ]);
    expect(file.suggestedFilename()).toBe('foldkit-zloz.conversion-1.json');
    receiptBytes = await readFile(await file.path(), 'utf8');
    return parseEventStormingDddConversion(receiptBytes);
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open event-storming example').click();
  await expect(page.locator('[data-zloz-event-storming-type="command"]')).toHaveCount(2);
  await section('History');
  await page.getByRole('textbox', { name: 'Edition name', exact: true }).fill('Discovery source');
  await button('Capture edition').click();
  const rewind = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  await expect(rewind.getByRole('option', { name: 'Discovery source', exact: true })).toHaveCount(
    1,
  );
  await rewind.selectOption(
    await rewind
      .getByRole('option', { name: 'Discovery source', exact: true })
      .getAttribute('value'),
  );
  await page.getByRole('textbox', { name: 'New model name', exact: true }).fill('Orders DDD Apply');
  await button('Fork edition').click();
  await expect(page.getByLabel('Active model', { exact: true })).toContainText('Orders DDD Apply');
  const original = await downloadModel();
  await section('Mapping review');
  await openPlan();
  await expect(apply).toBeDisabled();
  await resolveMappings();
  await openPlan();
  await expect(apply).toBeDisabled();
  await ack.focus();
  await ack.press('Space');
  await expect(plan.getByLabel('Conversion plan status', { exact: true })).toHaveText(
    'Losses acknowledged for this plan',
  );
  await expect(apply).toBeEnabled();
  const protect = plan.getByRole('checkbox', { name: 'Protect conversion Apply', exact: true });
  await protect.check();
  await expect(apply).toBeDisabled();
  await expect(plan.locator('#mapping-apply-reason')).toContainText('protected');
  expect(await downloadModel()).toEqual(original);
  await section('Mapping review');
  await openPlan();
  await protect.uncheck();
  await expect(apply).toBeEnabled();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await expect(page.locator('[data-flow-workbench-color-scheme="light"]')).toHaveCount(1);
  await plan.scrollIntoViewIfNeeded();
  await apply.click();
  await expect(page.locator('[data-flow-ddd-node="domain-event"]')).toHaveCount(1);
  await expect(receipts).toBeVisible();
  const receipt = await downloadReceipt();
  expect(receipt.source.document).toEqual(original);
  // Reopen in a fresh page: no retained receipt or source-model session is present.
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const working = await downloadModel();
  await section('Mapping review');
  const review = page.getByRole('region', { name: 'Portable receipt comparison', exact: true });
  const upload = () => review.getByLabel('Open conversion receipt', { exact: true });
  const reopen = () =>
    upload().setInputFiles({
      name: 'downloaded.conversion.json',
      mimeType: 'application/json',
      buffer: Buffer.from(receiptBytes),
    });
  await reopen();
  await expect(review.getByRole('status')).toContainText('Receipt opened');
  await expect(review).toContainText('Orders DDD Apply');
  await expect(review).toContainText('Discovery source');
  await expect(review).toContainText('not verified authorship');
  await expect(review).toContainText('Meaning changed');
  await expect(page.getByRole('button', { name: 'Apply DDD conversion', exact: true })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name: 'Diagram', exact: true }),
  ).toBeDisabled();
  const canvas = page.getByRole('group', { name: 'Read-only receipt diagram', exact: true });
  await expect(canvas).toBeVisible();
  const focus = (entity, name, side) =>
    review.getByRole('button', { name: `Focus ${entity} ${name} ${side} conversion`, exact: true });
  const centered = async (selectors) => {
    const frame = await canvas.boundingBox();
    expect(frame).not.toBeNull();
    const boxes = await Promise.all(
      selectors.map((selector) => canvas.locator(selector).boundingBox()),
    );
    expect(boxes.every(Boolean)).toBe(true);
    const minX = Math.min(...boxes.map((box) => box.x)),
      maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const minY = Math.min(...boxes.map((box) => box.y)),
      maxY = Math.max(...boxes.map((box) => box.y + box.height));
    expect(Math.abs((minX + maxX) / 2 - (frame.x + frame.width / 2))).toBeLessThan(3);
    expect(Math.abs((minY + maxY) / 2 - (frame.y + frame.height / 2))).toBeLessThan(3);
  };
  const position = review.locator('#receipt-change-position');
  const side = (value) =>
    review.getByRole('button', {
      name: value === 'before' ? 'Before conversion' : 'After conversion',
      exact: true,
    });
  const next = review.getByRole('button', { name: 'Next receipt change', exact: true });
  const previous = review.getByRole('button', { name: 'Previous receipt change', exact: true });
  const overview = review.getByRole('button', { name: 'Show receipt overview', exact: true });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(position).toHaveText('Change 1 of 2');
  await side('before').focus();
  await side('before').press('Enter');
  await expect(side('before')).toBeFocused();
  await expect(side('before')).toHaveAttribute('aria-pressed', 'true');
  await expect(position).toHaveText('Change 1 of 2');
  await expect(focus('node', 'Order placed', 'before')).toHaveAttribute('aria-pressed', 'true');
  await centered(['[data-zloz-event-storming-body="note:3"] svg']);
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await focus('node', 'Order placed', 'before').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('receipt-side-light.png', import.meta.url)),
  });
  await side('after').click();
  await expect(side('after')).toHaveAttribute('aria-pressed', 'true');
  await expect(position).toHaveText('Change 1 of 2');
  await centered(['[data-flow-ddd-node="domain-event"]']);
  await next.click();
  await expect(position).toHaveText('Change 2 of 2');
  await side('before').click();
  await expect(side('before')).toHaveAttribute('aria-pressed', 'true');
  await expect(position).toHaveText('Change 2 of 2');
  await centered([
    '[data-flow-ddd-node="aggregate-root"]',
    '[data-zloz-event-storming-body="note:3"] svg',
  ]);
  await side('after').click();
  await expect(side('after')).toHaveAttribute('aria-pressed', 'true');
  await expect(position).toHaveText('Change 2 of 2');
  await centered(['[data-flow-ddd-node="aggregate-root"]', '[data-flow-ddd-node="domain-event"]']);
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await expect(page.locator('[data-flow-workbench-color-scheme="dark"]')).toHaveCount(1);
  await focus('connection', 'Emits', 'after').scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('receipt-side-dark.png', import.meta.url)) });
  await overview.click();
  await expect(position).toContainText('No change selected');
  await expect(review.locator('.receipt-change--focused')).toHaveCount(0);
  await expect(side('after')).toHaveAttribute('aria-pressed', 'true');
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  const frame = await canvas.boundingBox();
  expect(frame).not.toBeNull();
  await expect(canvas.locator('[data-flow-node]')).toHaveCount(6);
  for (const node of await canvas.locator('[data-flow-node]').all()) {
    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(frame.x - 2);
    expect(box.y).toBeGreaterThanOrEqual(frame.y - 2);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 2);
    expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 2);
  }
  await next.click();
  await expect(position).toHaveText('Change 1 of 2');
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('Mapping review');
  await side('before').click();
  await expect(side('before')).toHaveAttribute('aria-pressed', 'true');
  await expect(position).toHaveText('Change 1 of 2');
  await centered(['[data-zloz-event-storming-body="note:3"] svg']);
  await overview.click();
  await expect(position).toContainText('No change selected');
  await expect(side('before')).toHaveAttribute('aria-pressed', 'true');
  await review.getByRole('button', { name: 'Return to working model', exact: true }).click();
  expect(await downloadModel()).toEqual(working);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'actual downloaded receipt reopened in a fresh session',
          'keyboard side switching retains DOM focus and selected change',
          'node and connection framing follows the same identity across both sides',
          'position and Previous/Next continuity',
          'explicit overview clears selection, keeps side and fits all nodes',
          'minimal diagnostics preserve side continuity and overview',
          'closing preserves exported working model exactly',
          'light/dark captures',
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
