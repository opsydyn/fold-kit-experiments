import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const url = process.env.ZLOZ_WORKBENCH_REVIEW_URL ?? 'http://127.0.0.1:4323/';
const output = (name) => fileURLToPath(new URL(name, import.meta.url));
const browser = await chromium.launch();
await (async () => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(url);
  const nav = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
  const section = async (name) => {
    await nav.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('region', { name: name + ' settings', exact: true })).toBeVisible();
  };
  const snapshot = async () => {
    await section('Diagram');
    await page.getByRole('checkbox', { name: 'Include camera', exact: true }).check();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export JSON', exact: true }).click(),
    ]);
    return JSON.parse(await readFile(await download.path(), 'utf8'));
  };
  const selected = page.getByRole('button', { name: 'Select Review', exact: true });
  await selected.click();
  const before = await snapshot();
  await section('Navigation');
  const toggle = page.getByRole('checkbox', { name: 'Mini map', exact: true });
  const map = page.getByRole('button', { name: 'Diagram overview', exact: true });
  await expect(toggle).toBeChecked();
  await expect(map).toBeVisible();
  await toggle.uncheck();
  await expect(map).toHaveCount(0);
  expect(await snapshot()).toEqual(before);
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await section('Navigation');
  await toggle.check();
  await expect(map).toBeVisible();
  await page.screenshot({ path: output('minimap-toggle-light.png') });
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await page.screenshot({ path: output('minimap-toggle-dark.png') });
  await section('Diagnostics');
  await expect(page.getByRole('checkbox', { name: 'Overview', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
  await section('Navigation');
  await expect(toggle).toBeDisabled();
  await expect(toggle).toBeChecked();
  await expect(toggle).toHaveAccessibleDescription(/Hidden by Minimal mode/);
  await expect(map).toHaveCount(0);
  await page.screenshot({ path: output('minimap-toggle-minimal.png') });
  await page.getByRole('button', { name: 'Open diagnostics', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Diagnostics settings', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).uncheck();
  await section('Navigation');
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAccessibleDescription(/Diagnostics are disabled/);
  await expect(map).toHaveCount(0);
  await page.getByRole('button', { name: 'Open diagnostics', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show diagnostics', exact: true }).check();
  await section('Navigation');
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeChecked();
  await expect(map).toBeVisible();
  expect(await snapshot()).toEqual(before);
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
  await writeFile(
    output('minimap-toggle-browser.json'),
    JSON.stringify(
      {
        result: 'pass',
        url,
        controlLocation: 'Navigation / Mini map',
        localToggle: 'show/hide',
        minimalAndGlobalMasks: 'disabled control with visible reason and diagnostics link',
        storedChoiceRestored: true,
        graphCameraAndSelectionPreserved: true,
        oldOverviewCheckboxRemoved: true,
        pageErrors: errors,
      },
      null,
      2,
    ) + '\n',
  );
})().finally(() => browser.close());
