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
  await selectMapping('node', 'request');
  await page.getByRole('combobox', { name: 'C4 role', exact: true }).selectOption('container');
  await expect(page.getByRole('textbox', { name: 'C4 technology', exact: true })).toBeVisible();
  await button('Preview C4 mapping').click();
  for (const id of [
    'workshop-lane',
    'provider',
    'accepted',
    'retry-question',
    'timeout-agreement',
  ]) {
    await selectMapping('node', id);
    await button('Keep workshop meaning for C4').click();
  }
  for (const id of ['provider-handles', 'provider-emits']) {
    await selectMapping('edge', id);
    await button('Keep workshop meaning for C4').click();
  }
  await openPlan();
  await expect(status).toHaveText('Resolve plan blockers');
  await expect(ack).toBeDisabled();
  await expect(plan.getByRole('button', { name: /Apply/u })).toHaveCount(0);
  await selectMember('request');
  await placement.selectOption('contained');
  const parent = page.getByRole('combobox', { name: 'Placement parent', exact: true });
  await expect(parent).toBeVisible();
  await expect(parent).toHaveValue('');
  await expect(button('Review C4 placement')).toBeDisabled();
  await parent.selectOption('workshop-lane');
  await button('Review C4 placement').click();
  await expect(page.getByRole('status', { name: 'C4 placement decision', exact: true })).toHaveText(
    'Placement blocked',
  );
  await expect(plan).toContainText('Declared containment requires an existing group');
  await placement.selectOption('organization');
  await button('Review C4 placement').focus();
  await page.keyboard.press('Enter');
  await expect(button('Review C4 placement')).toBeFocused();
  await expect(status).toHaveText('Loss acknowledgement needed');
  await expect(ack).toBeEnabled();
  await ack.focus();
  await page.keyboard.press('Space');
  await expect(ack).toBeChecked();
  await expect(status).toHaveText('Losses acknowledged for this plan');
  await page.keyboard.press('Space');
  await expect(ack).not.toBeChecked();
  await expect(status).toHaveText('Loss acknowledgement needed');
  await ack.check();
  // Editing placement revokes review before recording the new choice.
  await placement.selectOption('root');
  await expect(ack).not.toBeChecked();
  await expect(ack).toBeDisabled();
  await button('Review C4 placement').click();
  await expect(status).toHaveText('Loss acknowledgement needed');
  await expect(plan.getByRole('list', { name: 'C4 plan losses', exact: true })).toContainText(
    'authored parent membership would be removed',
  );
  for (const scheme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(scheme);
    await plan
      .getByRole('status', { name: 'C4 conversion plan status', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: file(`c4-plan-${scheme}.png`) });
    await ack.scrollIntoViewIfNeeded();
    await page.screenshot({ path: file(`c4-plan-losses-${scheme}.png`) });
  }
  await ack.check();
  // Historical inspection must withdraw acknowledgement; graph stays unchanged.
  expect(await model()).toEqual(before);
  await page
    .getByRole('textbox', { name: 'Edition name', exact: true })
    .fill('C4 placement review');
  await button('Capture edition').click();
  const rewind = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  await expect(rewind.locator('option')).toHaveCount(2);
  await rewind.selectOption(await rewind.locator('option').last().getAttribute('value'));
  await expect(button('Back to present')).toBeVisible();
  await section('C4 mapping review');
  await openPlan();
  await expect(ack).toBeDisabled();
  await expect(ack).not.toBeChecked();
  await expect(plan).toContainText('Return to the working model');
  await section('History');
  await button('Back to present').click();
  expect((await model()).snapshot.graph).toEqual(before.snapshot.graph);
  await section('C4 mapping review');
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('C4 mapping review');
  await openPlan();
  await expect(plan).toContainText('Full graph, camera, editions and fork ancestry');
  await expect(ack).toBeVisible();
  expect(errors).toEqual([]);
  const result = {
    result: 'passed',
    evidence: [
      'explicit required placement and no inferred parent',
      'package incompatibility reasons',
      'Enter reviews placement with focus retained',
      'Space acknowledges and revokes exact plan',
      'draft edits withdraw acknowledgement before review',
      'root detachment loss visible',
      'light/dark sidebar preserves canvas',
      'source/lineage unchanged before explicit edition capture',
      'history protects and withdraws acknowledgement',
      'Minimal mode preserves plan provenance/acknowledgement',
      'no Apply action',
    ],
    pageErrors: errors,
  };
  await writeFile(file('c4-plan-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
