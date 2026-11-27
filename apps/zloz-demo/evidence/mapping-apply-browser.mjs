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
const evidence = (name) =>
  process.env.ZLOZ_CAPTURE_DIR
    ? resolve(process.env.ZLOZ_CAPTURE_DIR, `${engine}-${name}`)
    : fileURLToPath(new URL(name, import.meta.url));
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1400 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const errors = [];
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
    const label = (await item.locator(`option[value="${key}"]`).textContent()).split(' · ')[1];
    await item.selectOption(key);
    await expect(item).toHaveValue(key);
    await expect(
      panel.getByLabel('Mapping decision', { exact: true }).getByRole('heading', { level: 3 }),
    ).toHaveText(label);
  };
  const resolveMappings = async () => {
    await section('Mapping review');
    await expect(page.locator('[data-architecture-effect-ui="mapping-review"]')).toBeVisible();
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
    return parseEventStormingDddConversion(await readFile(await file.path(), 'utf8'));
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
  await protect.click();
  await expect(protect).toBeChecked();
  await expect(apply).toBeDisabled();
  await expect(plan.locator('#mapping-apply-reason')).toContainText('protected');
  expect(await downloadModel()).toEqual(original);
  await section('Mapping review');
  await openPlan();
  await protect.click();
  await expect(protect).not.toBeChecked();
  await expect(apply).toBeEnabled();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await expect(page.locator('[data-flow-workbench-color-scheme="light"]')).toHaveCount(1);
  await plan.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: evidence('mapping-apply-light.png'),
  });
  await apply.click();
  await expect(
    page.locator('[data-flow-node="note:3"]:has([data-flow-ddd-type="domain-event"])'),
  ).toHaveCount(1);
  await expect(receipts).toBeVisible();
  const receipt = await downloadReceipt();
  expect(receipt.source.document).toEqual(original);
  const converted = await downloadModel();
  expect(receipt.document).toEqual(converted);
  expect(converted.origin).toEqual(original.origin);
  expect(converted.editions).toEqual(original.editions);
  expect(
    converted.snapshot.graph.nodes.find((node) => node.id === 'note:3').architecture.family,
  ).toBe('ddd');
  expect(
    converted.snapshot.graph.edges.find((edge) => edge.id === 'step:2').architecture.family,
  ).toBe('ddd');
  await section('Diagram');
  await button('Undo').click();
  await expect(
    page.locator('[data-flow-node="note:3"]:has([data-flow-ddd-type="domain-event"])'),
  ).toHaveCount(0);
  expect((await downloadModel()).snapshot.graph).toEqual(original.snapshot.graph);
  expect(await downloadReceipt()).toEqual(receipt);
  await resolveMappings();
  await selectItem('node:note:1');
  await choice.selectOption('domain-service');
  await expect(panel.getByLabel('Mapping decision', { exact: true })).toHaveAttribute(
    'data-mapping-state',
    'proposed',
  );
  await openPlan();
  await ack.click();
  await expect(ack).toBeChecked();
  await expect(plan.getByLabel('Conversion plan status', { exact: true })).toHaveText(
    'Losses acknowledged for this plan',
  );
  await expect(apply).toBeDisabled();
  await expect(plan.locator('#mapping-apply-reason')).toContainText('Issues');
  await section('Diagram');
  await button('Redo').click();
  await expect(
    page.locator('[data-flow-node="note:3"]:has([data-flow-ddd-type="domain-event"])'),
  ).toHaveCount(1);
  expect((await downloadModel()).snapshot.graph).toEqual(converted.snapshot.graph);
  await section('History');
  const models = page.getByRole('combobox', { name: 'Working model', exact: true });
  await models.selectOption(original.origin.modelId);
  await section('Mapping review');
  await expect(receipts).toHaveCount(0);
  await section('History');
  await models.selectOption(original.id);
  await openReceipt();
  await expect(
    receipts.getByRole('button', { name: 'Download conversion receipt 1', exact: true }),
  ).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await expect(page.locator('[data-flow-workbench-color-scheme="dark"]')).toHaveCount(1);
  const planDetails = page.locator('#mapping-conversion-plan');
  if ((await planDetails.getAttribute('open')) !== null)
    await planDetails.locator(':scope > summary').click();
  await receipts.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: evidence('mapping-apply-dark.png'),
  });
  await section('Diagnostics');
  await button('Minimal mode').click();
  await openReceipt();
  await expect(
    receipts.getByRole('button', { name: 'Download conversion receipt 1', exact: true }),
  ).toBeEnabled();
  expect(await downloadReceipt()).toEqual(receipt);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'actual fork source and ancestry',
          'blocked and unacknowledged Apply guards',
          'live protection toggle and complete-final-state semantic veto',
          'atomic canvas conversion and portable receipt download',
          'complete original/target model equality and stable lineage/editions',
          'one Undo and Redo; retained receipt remains unchanged',
          'per-model receipt retention across switches',
          'native downloads with minimal diagnostics',
          'light/dark evidence',
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
