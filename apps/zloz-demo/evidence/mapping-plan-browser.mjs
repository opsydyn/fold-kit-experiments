import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseModelDocument } from '../../../packages/foldkit-zloz/dist/index.mjs';
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
  const status = plan.getByLabel('Conversion plan status', { exact: true });
  const openPlan = async () => {
    const details = page.locator('#mapping-conversion-plan');
    if (!((await details.getAttribute('open')) !== null))
      await details.locator(':scope > summary').click();
    await plan.scrollIntoViewIfNeeded();
  };
  const download = async () => {
    await section('History');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return parseModelDocument(await readFile(await file.path(), 'utf8'));
  };
  const selectItem = async (key) => {
    await item.selectOption(key);
    const label = (await item.locator('option:checked').textContent()).split(' · ')[1];
    await expect(
      panel.getByLabel('Mapping decision', { exact: true }).getByRole('heading', { level: 3 }),
    ).toHaveText(label);
  };
  const accept = async () => {
    await ack.check();
    await expect(status).toHaveText('Losses acknowledged for this plan');
  };
  const resolveMappings = async () => {
    await section('Mapping review');
    for (const id of ['note:0', 'note:1', 'note:4', 'note:5']) {
      await selectItem(`node:${id}`);
      await choice.selectOption('retain');
      await expect(panel.getByLabel('Mapping decision', { exact: true })).toHaveAttribute(
        'data-mapping-state',
        'retained',
      );
    }
    for (const id of ['step:0', 'step:1', 'step:3', 'step:4']) {
      await selectItem(`edge:${id}`);
      await choice.selectOption('retain');
      await expect(panel.getByLabel('Mapping decision', { exact: true })).toHaveAttribute(
        'data-mapping-state',
        'retained',
      );
    }
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open event-storming example').click();
  await expect(page.locator('[data-zloz-event-storming-type="command"]')).toHaveCount(2);
  await section('History');
  await page.getByRole('textbox', { name: 'Edition name', exact: true }).fill('Discovery workshop');
  await button('Capture edition').click();
  const rewind = page.getByRole('combobox', { name: 'Rewind to edition', exact: true });
  await expect(rewind.getByRole('option', { name: 'Discovery workshop', exact: true })).toHaveCount(
    1,
  );
  await rewind.selectOption(
    await rewind
      .getByRole('option', { name: 'Discovery workshop', exact: true })
      .getAttribute('value'),
  );
  await page
    .getByRole('textbox', { name: 'New model name', exact: true })
    .fill('Orders DDD review');
  await button('Fork edition').click();
  await expect(page.getByLabel('Active model', { exact: true })).toContainText('Orders DDD review');
  const original = await download();
  await section('Mapping review');
  await openPlan();
  await expect(ack).toBeDisabled();
  await expect(status).toContainText('Resolve remaining mappings');
  await expect(plan).toContainText('Orders DDD review');
  await expect(plan).toContainText('Working model · Discovery workshop');
  await expect(plan.getByLabel('Conversion plan blockers', { exact: true })).toBeVisible();
  await resolveMappings();
  await openPlan();
  await expect(ack).toBeEnabled();
  await expect(ack).not.toBeChecked();
  await expect(
    plan.getByLabel('Plan semantic losses', { exact: true }).getByRole('listitem'),
  ).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await expect(page.locator('[data-flow-workbench-color-scheme="light"]')).toHaveCount(1);
  await plan.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL('mapping-plan-light.png', import.meta.url)),
  });
  await ack.focus();
  await ack.press('Space');
  await expect(ack).toBeChecked();
  await expect(status).toHaveText('Losses acknowledged for this plan');
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await expect(page.locator('[data-flow-workbench-color-scheme="dark"]')).toHaveCount(1);
  await plan.scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('mapping-plan-dark.png', import.meta.url)) });
  expect(await download()).toEqual(original);
  await section('Diagram');
  await expect(button('Undo')).toBeDisabled();
  await section('Mapping review');
  await openPlan();
  await expect(ack).toBeChecked();
  await ack.uncheck();
  await expect(status).toHaveText('Loss acknowledgement needed');
  await accept();
  await section('Navigation');
  await button('Zoom in').click();
  await section('Mapping review');
  await openPlan();
  await expect(ack).not.toBeChecked();
  await expect(status).toHaveText('Loss acknowledgement needed');
  await accept();
  await selectItem('node:note:1');
  await choice.selectOption('domain-service');
  await openPlan();
  await expect(ack).not.toBeChecked();
  await accept();
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('Mapping review');
  await openPlan();
  await expect(ack).toBeChecked();
  await expect(plan.getByRole('heading', { name: 'Source provenance', exact: true })).toBeVisible();
  await expect(plan.getByLabel('Plan semantic losses', { exact: true })).toBeVisible();
  await expect(panel.getByLabel('Mapping summary', { exact: true })).toHaveCount(0);
  await section('Diagnostics');
  await button('Minimal mode').click();
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).uncheck();
  await section('Mapping review');
  await openPlan();
  await expect(ack).toBeChecked();
  await expect(plan.getByLabel('Plan semantic losses', { exact: true })).toBeVisible();
  const afterChoices = await download();
  expect(afterChoices.snapshot.graph).toEqual(original.snapshot.graph);
  expect(afterChoices.origin).toEqual(original.origin);
  expect(afterChoices.editions).toEqual(original.editions);
  await page
    .getByRole('textbox', { name: 'Edition name', exact: true })
    .fill('Consent source edition');
  await button('Capture edition').click();
  await section('Mapping review');
  await openPlan();
  await expect(ack).not.toBeChecked();
  await accept();
  await section('History');
  await rewind.selectOption(
    await rewind
      .getByRole('option', { name: 'Consent source edition', exact: true })
      .getAttribute('value'),
  );
  await section('Mapping review');
  await openPlan();
  await expect(ack).toBeDisabled();
  await expect(ack).not.toBeChecked();
  await expect(plan).toContainText('Edition · Consent source edition');
  await expect(plan.locator('#mapping-plan-acknowledgement-reason')).toContainText(
    'Return to the working model',
  );
  await section('History');
  await button('Return to present').click();
  await section('Mapping review');
  await openPlan();
  await expect(ack).not.toBeChecked();
  expect(await page.getByRole('button', { name: 'Apply', exact: true }).count()).toBe(0);
  expect(await page.content()).not.toContain('&quot;provenance&quot;');
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        checks: [
          'fork provenance from actual edition workflow',
          'blocked plan disables acknowledgement with reasons',
          'all-loss review and native Space acknowledgement',
          'unchecked withdrawal and exact source/choice/camera/edition invalidation',
          'theme and diagnostic preferences preserve functional review',
          'read-only history keeps provenance inspectable and acknowledgement disabled',
          'unchanged model export, graph, origin, editions and Undo',
          'light/dark plan evidence; no Apply',
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
