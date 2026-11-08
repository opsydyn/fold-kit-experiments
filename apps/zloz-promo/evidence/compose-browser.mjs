import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const url = process.env.ZLOZ_PROMO_REVIEW_URL ?? 'http://127.0.0.1:4329/';
const output = (name) => fileURLToPath(new URL(name, import.meta.url));
const browser = await chromium.launch();
await (async () => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    colorScheme: 'light',
  });
  const errors = [],
    failed = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto(url);
  const example = page.locator('.compose-example');
  const surface = example.locator('[data-flow-surface="promo-compose"]');
  const nodes = surface.locator('[data-flow-node]');
  const edges = surface.locator('[data-flow-edge]');
  const button = (name) => example.getByRole('button', { name, exact: true });
  await expect(nodes).toHaveCount(3);
  await expect(edges).toHaveCount(1);
  await expect(button('Undo')).toBeDisabled();
  await expect(button('Redo')).toBeDisabled();
  await expect(page).toHaveTitle('Foldkit Zloz — Compose systems. Connect ideas.');
  await button('Select Review').click();
  await expect(button('Select Review')).toHaveAttribute('aria-pressed', 'true');
  await expect(example.locator('[aria-label="Current selection"]')).toHaveText('Selected: Review');
  await expect(button('Undo')).toBeDisabled();
  const source = example.getByRole('combobox', { name: 'New connection source', exact: true });
  const target = example.getByRole('combobox', { name: 'New connection target', exact: true });
  await source.selectOption({ label: 'Review: Output' });
  await expect(button('Connect from Review: Output')).toHaveAttribute('aria-pressed', 'true');
  await expect(button('Undo')).toBeDisabled();
  await target.selectOption({ label: 'Publish: Input' });
  await expect(edges).toHaveCount(2);
  await expect(button('Undo')).toBeEnabled();
  const connectedIds = await edges.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-flow-edge')),
  );
  await button('Connections').click();
  const connectionList = example.getByRole('group', { name: 'Connections', exact: true });
  const selectedConnection = connectionList.getByRole('button', {
    name: 'Review → Publish',
    exact: true,
  });
  await selectedConnection.focus();
  await selectedConnection.press('Enter');
  await expect(example.locator('[aria-label="Current selection"]')).toHaveText(
    'Selected: Review → Publish',
  );
  await button('Select Review').click();
  const mountedSurface = await surface.elementHandle();
  await page.locator('#compose').screenshot({ path: output('compose-light.png') });
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(button('Select Review')).toHaveAttribute('aria-pressed', 'true');
  await expect(edges).toHaveCount(2);
  expect(
    await mountedSurface.evaluate(
      (element) => element === document.querySelector('[data-flow-surface="promo-compose"]'),
    ),
  ).toBe(true);
  await page.locator('#compose').screenshot({ path: output('compose-dark.png') });
  await button('Undo').click();
  await expect(edges).toHaveCount(1);
  await expect(button('Undo')).toBeDisabled();
  await expect(button('Redo')).toBeEnabled();
  await button('Redo').click();
  await expect(edges).toHaveCount(2);
  expect(
    await edges.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-flow-edge')),
    ),
  ).toEqual(connectedIds);
  await button('Undo').click();
  const out = button('Connect from Review: Output');
  const input = button('Connect to Publish: Input');
  await out.focus();
  await out.press('Enter');
  await expect(out).toHaveAttribute('aria-pressed', 'true');
  await target.focus();
  await target.press('Escape');
  await expect(out).toHaveAttribute('aria-pressed', 'false');
  await expect(edges).toHaveCount(1);
  await out.focus();
  await out.press('Enter');
  await input.focus();
  await input.press('Enter');
  await expect(edges).toHaveCount(2);
  await out.focus();
  await out.press('Enter');
  await input.focus();
  await input.press('Enter');
  await expect(edges).toHaveCount(2);
  await expect(example.locator('.compose-notice')).toContainText(/already|duplicate/i);
  await expect(button('Cancel connection')).toBeDisabled();
  await button('Undo').click();
  await expect(edges).toHaveCount(1);
  await expect(button('Undo')).toBeDisabled();
  const start = await out.boundingBox(),
    end = await input.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(edges).toHaveCount(2);
  await button('Undo').click();
  await expect(edges).toHaveCount(1);
  await expect(page).toHaveTitle('Foldkit Zloz — Compose systems. Connect ideas.');
  await page.locator('.compose-source summary').click();
  await expect(page.locator('.compose-source .pl-k').first()).toHaveCSS(
    'color',
    'rgb(255, 123, 114)',
  );
  await page.locator('.compose-source summary').click();
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
  });
  mobile.on('pageerror', (error) => errors.push(String(error)));
  await mobile.goto(url);
  const mobileExample = mobile.locator('.compose-example');
  const mobileSurface = mobileExample.locator('[data-flow-surface]');
  await expect(mobileSurface.locator('[data-flow-node]')).toHaveCount(3);
  // Wait for the initial measurement/fit and ensure every frame is actually on canvas.
  await mobileExample.getByRole('button', { name: 'Fit view', exact: true }).click();
  const canvas = await mobileSurface.boundingBox();
  for (const frame of await mobileSurface.locator('[data-flow-node]').all()) {
    const box = await frame.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(canvas.x);
    expect(box.y).toBeGreaterThanOrEqual(canvas.y);
    expect(box.x + box.width).toBeLessThanOrEqual(canvas.x + canvas.width);
    expect(box.y + box.height).toBeLessThanOrEqual(canvas.y + canvas.height);
  }
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    390,
  );
  await mobileExample
    .getByRole('combobox', { name: 'New connection source' })
    .selectOption({ label: 'Review: Output' });
  await mobileExample
    .getByRole('combobox', { name: 'New connection target' })
    .selectOption({ label: 'Publish: Input' });
  await expect(mobileSurface.locator('[data-flow-edge]')).toHaveCount(2);
  await mobile.locator('#compose').screenshot({ path: output('compose-mobile.png') });
  await mobileExample.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(mobileSurface.locator('[data-flow-edge]')).toHaveCount(1);
  await mobile.close();
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  await writeFile(
    output('compose-browser.json'),
    JSON.stringify(
      {
        result: 'pass',
        url,
        selectionWithoutHistory: true,
        keyboardConnectionSelection: true,
        nativeChooser: true,
        keyboardPorts: true,
        pointerConnection: true,
        cancelAndDuplicateRejection: true,
        undoRedoStableIdentity: true,
        themeRetainsMountedEditor: true,
        astroMetadataRetained: true,
        highlightedSource: true,
        mobile: '390px; all nodes visible; chooser and Undo pass',
        pageErrors: errors,
        failedResponses: failed,
      },
      null,
      2,
    ) + '\n',
  );
})().finally(() => browser.close());
