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
    viewport: { width: 1600, height: 1200 },
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const file = (name) => fileURLToPath(new URL(name, import.meta.url));
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const picker = page.getByRole('combobox', { name: 'Review C4 mapping', exact: true });
  const mappingTarget = page.getByRole('status', { name: 'C4 mapping target', exact: true });
  const target = {
    request: 'Request payment',
    provider: 'Payment provider',
    accepted: 'Payment accepted',
    'workshop-lane': 'Payment discovery',
    'retry-question': 'Who owns retries?',
    'timeout-agreement': 'Timeout contract agreed',
    'provider-handles': 'Handled by',
    'provider-emits': 'Emits',
  };
  const selectMapping = async (kind, id) => {
    await picker.selectOption(`${kind}:${id}`);
    await expect(mappingTarget).toHaveText(target[id]);
  };
  const model = async () => {
    await section('History');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return JSON.parse(await readFile(await download.path(), 'utf8')).document;
  };
  const plan = page.getByRole('region', { name: 'C4 conversion plan review', exact: true });
  const status = page.getByRole('status', { name: 'C4 conversion plan status', exact: true });
  const openPlan = async () => {
    if (!(await plan.isVisible()))
      await page.getByText('C4 conversion plan review', { exact: true }).click();
    await expect(plan).toBeVisible();
  };
  const ack = page.getByRole('checkbox', { name: 'Acknowledge exact C4 plan losses', exact: true });
  const placement = page.getByRole('combobox', { name: 'Placement kind', exact: true });
  const selectMember = async (id) => {
    await page.getByRole('combobox', { name: 'Review C4 placement', exact: true }).selectOption(id);
    await expect(page.getByRole('status', { name: 'C4 placement target', exact: true })).toHaveText(
      target[id],
    );
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open workshop semantics example').click();
  const before = await model();
  await section('C4 mapping review');
  for (const [id, role] of [
    ['request', 'container'],
    ['provider', 'software-system'],
    ['accepted', 'component'],
  ]) {
    await selectMapping('node', id);
    await page.getByRole('combobox', { name: 'C4 role', exact: true }).selectOption(role);
    await button('Preview C4 mapping').click();
  }
  for (const id of ['workshop-lane', 'retry-question', 'timeout-agreement']) {
    await selectMapping('node', id);
    await button('Keep workshop meaning for C4').click();
  }
  for (const [id, name] of [
    ['provider-handles', 'Calls'],
    ['provider-emits', 'Reports'],
  ]) {
    await selectMapping('edge', id);
    await page.getByRole('textbox', { name: 'C4 communication label', exact: true }).fill(name);
    await button('Preview C4 mapping').click();
  }
  await openPlan();
  const apply = button('Apply C4 conversion');
  await expect(apply).toBeDisabled();
  for (const id of ['request', 'provider', 'accepted']) {
    await selectMember(id);
    await placement.selectOption('organization');
    await button('Review C4 placement').click();
  }
  await expect(status).toHaveText('Loss acknowledgement needed');
  await expect(apply).toBeDisabled();
  await ack.focus();
  await page.keyboard.press('Space');
  await expect(ack).toBeChecked();
  await expect(apply).toBeEnabled();
  const lock = page.getByRole('checkbox', { name: 'Protect C4 conversion Apply', exact: true });
  await lock.check();
  await expect(apply).toBeDisabled();
  await expect(
    page.getByRole('status', { name: 'C4 Apply availability', exact: true }),
  ).toContainText('protected');
  await expect(ack).not.toBeChecked();
  await lock.uncheck();
  await expect(apply).toBeDisabled();
  await ack.check();
  await expect(apply).toBeEnabled();
  await apply.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'C4 Apply result', exact: true })).toContainText(
    'C4 conversion applied',
  );
  await expect(ack).not.toBeChecked();
  const records = page.getByRole('region', { name: 'Retained C4 conversions', exact: true });
  await records.locator('summary').click();
  await expect(records).toContainText('Source meaning: event-storming');
  await expect(records).toContainText('Target meaning: C4');
  const [receiptDownload] = await Promise.all([
    page.waitForEvent('download'),
    button('Download C4 receipt 1').click(),
  ]);
  const receiptText = await readFile(await receiptDownload.path(), 'utf8');
  const receipt = JSON.parse(receiptText);
  const converted = await model();
  expect(receipt.format).toBe('foldkit-zloz-c4-conversion');
  expect(receipt.source.document).toEqual(before);
  expect(receipt.document).toEqual(converted);
  expect(converted.editions).toEqual(before.editions);
  expect(converted.origin).toEqual(before.origin);
  expect(converted.id).toEqual(before.id);
  for (const id of ['request', 'provider', 'accepted']) {
    const source = before.snapshot.graph.nodes.find((node) => node.id === id);
    const targetNode = converted.snapshot.graph.nodes.find((node) => node.id === id);
    expect(targetNode.architecture.family).toBe('c4');
    expect(targetNode.position).toEqual(source.position);
    expect(targetNode.ports).toEqual(source.ports);
    expect(targetNode.parentId).toEqual(source.parentId);
  }
  for (const edge of converted.snapshot.graph.edges) expect(edge.architecture).toBeUndefined();
  await section('Diagram');
  await button('Undo').click();
  expect((await model()).snapshot.graph).toEqual(before.snapshot.graph);
  await section('C4 mapping review');
  await expect(records.locator('summary')).toHaveCount(1);
  await expect(records).toContainText('Target meaning: C4');
  await section('Diagram');
  await button('Redo').click();
  expect((await model()).snapshot.graph).toEqual(converted.snapshot.graph);
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('C4 mapping review');
  await expect(records).toContainText('Source meaning');
  const receiptPanel = page.getByRole('region', {
    name: 'Portable receipt comparison',
    exact: true,
  });
  await page.getByLabel('Open conversion receipt', { exact: true }).setInputFiles({
    name: 'c4-receipt.json',
    mimeType: 'application/json',
    buffer: Buffer.from(receiptText),
  });
  await expect(page.getByRole('status', { name: 'Receipt model type', exact: true })).toHaveText(
    'C4 conversion receipt · read-only',
  );
  for (const scheme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(scheme);
    await button('Before conversion').click();
    await expect(page.locator('.receipt-canvas-banner')).toContainText('Before conversion');
    await receiptPanel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: file(`c4-receipt-before-${scheme}.png`) });
    await button('After conversion').click();
    await expect(page.locator('.receipt-canvas-banner')).toContainText('After conversion');
    await page.screenshot({ path: file(`c4-receipt-after-${scheme}.png`) });
  }
  await button('Next receipt change').click();
  await button('Before conversion').click();
  await expect(page.locator('.receipt-canvas-banner')).toContainText('Before conversion');
  const wrong = { ...receipt, document: { ...receipt.document, name: 'Forged target' } };
  await page.getByLabel('Open conversion receipt', { exact: true }).setInputFiles({
    name: 'invalid-c4.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(wrong)),
  });
  await expect(
    page.getByRole('status', { name: 'Receipt review feedback', exact: true }),
  ).toContainText('Could not open');
  await expect(page.locator('.receipt-canvas-banner')).toContainText('Before conversion');
  await button('Return to working model').click();
  await expect(records.locator('summary')).toHaveCount(1);
  expect((await model()).snapshot.graph).toEqual(converted.snapshot.graph);
  expect(errors).toEqual([]);
  const result = {
    result: 'passed',
    evidence: [
      'explicit mapping/placement/loss review',
      'live protection disables Apply and withdraws consent',
      'protection round trip requires fresh acknowledgement',
      'Space acknowledges; Enter applies',
      'one Undo/Redo restores full source/target graphs',
      'record survives Undo',
      'retained source/target meaning visible in Minimal mode',
      'light/dark sidebar preserves canvas',
      'model identity, editions, ancestry, ports and geometry preserved',
      'validated C4 download equals exported source and target documents',
      'receipt opens before/after read-only in Minimal mode in light and dark',
      'Next change and side navigation use detached comparison',
      'forged target rejection preserves last valid comparison and working Undo',
      'closing preserves exact working graph and retained record collection',
    ],
    pageErrors: errors,
  };
  await writeFile(file('c4-receipt-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
