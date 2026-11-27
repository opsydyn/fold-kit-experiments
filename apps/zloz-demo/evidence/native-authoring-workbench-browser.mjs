import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const { chromium, firefox, webkit, expect } = require('@playwright/test');
const browserName = process.env.ZLOZ_HISTORY_BROWSER ?? 'chromium';
const engine = { chromium, firefox, webkit }[browserName];
assert(engine, `Unsupported browser: ${browserName}`);
const base = process.env.ZLOZ_NATIVE_URL ?? 'http://127.0.0.1:4388';
const browser = await engine.launch();
const output = process.env.ZLOZ_HISTORY_EVIDENCE_DIR
  ? pathToFileURL(resolve(process.env.ZLOZ_HISTORY_EVIDENCE_DIR) + '/')
  : new URL('./', import.meta.url);
const path = (name) => fileURLToPath(new URL(name, output));
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    hasTouch: browserName === 'chromium',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${base}/history/`);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Review chosen edition', exact: true }).click();
  await page.getByRole('button', { name: 'Portable review', exact: true }).click();
  await page.getByRole('button', { name: 'Return to working model', exact: true }).click();
  await page.getByRole('button', { name: 'Authoring', exact: true }).click();
  const canvas = page.getByRole('region', { name: 'Working history canvas' });
  const palette = page.getByRole('group', { name: 'Placement palette' });
  const person = palette.getByRole('button', { name: 'C4 person', exact: true });
  const context = palette.getByRole('button', { name: 'DDD bounded context', exact: true });
  const preview = canvas.locator('[data-zloz-placement-preview]');
  const placed = canvas.getByRole('button', { name: 'Select New person', exact: true });
  const placedContext = canvas.getByRole('button', { name: 'Select New context', exact: true });
  const readout = palette.locator('[data-zloz-placement-readout]');
  const protect = page.getByLabel('Protect placement', { exact: true });
  await expect(person).toBeEnabled();
  await person.press('Enter');
  await expect(preview).toBeVisible();
  await expect(page.getByLabel('History workflow status')).toBeHidden();
  const startPosition = await readout.textContent();
  await person.press('Shift+ArrowRight');
  await expect(readout).not.toHaveText(startPosition);
  await expect(placed).toHaveCount(0);
  await person.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(placed).toHaveCount(0);

  await person.press('Enter');
  await expect(preview).toBeVisible();
  await protect.check();
  await expect(palette.getByRole('button', { name: 'Place fragment' })).toBeDisabled();
  await expect(palette).toContainText('Placement is protected.');
  await expect(person).toBeDisabled();
  await expect(placed).toHaveCount(0);
  await protect.uncheck();
  await expect(preview).toBeVisible();
  await person.press('Enter');
  await expect(placed).toBeVisible();
  await expect(preview).toHaveCount(0);
  await canvas.press('Control+z');
  await expect(placed).toHaveCount(0);

  await context.scrollIntoViewIfNeeded();
  const source = await context.boundingBox();
  const target = await canvas.boundingBox();
  assert(source && target);
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  const destination = { x: target.x + target.width / 2, y: target.y + target.height / 3 };
  await page.mouse.move(destination.x, destination.y, { steps: 10 });
  await expect(preview).toBeVisible();
  await expect(placedContext).toHaveCount(0);
  await page.screenshot({ path: path('native-authoring-placement.png') });
  await page.mouse.up();
  await expect(placedContext).toBeVisible();
  const placedBounds = await placedContext.locator('xpath=..').boundingBox();
  assert(placedBounds);
  assert(Math.abs(placedBounds.x - destination.x) < 2);
  assert(Math.abs(placedBounds.y - destination.y) < 2);
  await expect(preview).toHaveCount(0);
  await canvas.press('Control+z');
  await expect(placedContext).toHaveCount(0);

  if (browserName === 'chromium') {
    await person.scrollIntoViewIfNeeded();
    const card = await person.boundingBox();
    assert(card);
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: card.x + card.width / 2, y: card.y + card.height / 2 }],
    });
    await expect(person).toHaveAttribute('aria-pressed', 'true');
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: destination.x, y: destination.y }],
    });
    await expect(preview).toBeVisible();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(placed).toBeVisible();
    await canvas.press('Control+z');
    await expect(placed).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Prepare rename example', exact: true }).click();
  await page.getByRole('button', { name: 'Review proposal', exact: true }).click();
  const apply = page.getByRole('button', { name: 'Apply reviewed proposal', exact: true });
  await expect(apply).toBeDisabled();
  await page.getByLabel('I reviewed this exact proposal', { exact: true }).check();
  await page.getByLabel('I accept the listed authored losses', { exact: true }).check();
  await expect(apply).toBeEnabled();
  await page.getByLabel('Protect patch Apply', { exact: true }).check();
  await expect(apply).toBeDisabled();
  await expect(
    page.getByRole('status').filter({ hasText: 'Patch Apply is protected.' }),
  ).toBeVisible();
  await page.getByLabel('Protect patch Apply', { exact: true }).uncheck();
  await page.getByLabel('I reviewed this exact proposal', { exact: true }).check();
  await page.getByLabel('I accept the listed authored losses', { exact: true }).check();
  for (const scheme of ['light', 'dark']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(scheme);
    await apply.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path(`native-authoring-workbench-${scheme}.png`),
      fullPage: true,
    });
  }
  await apply.click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Applied with one Undo.' }),
  ).toBeVisible();
  async function download(label, filename) {
    const waiting = page.waitForEvent('download');
    await page.getByRole('button', { name: label, exact: true }).click();
    const file = await waiting;
    await file.saveAs(path(filename));
    return JSON.parse(await readFile(path(filename), 'utf8'));
  }
  const receiptName = 'native-authoring-workbench-receipt.json';
  const receipt = await download('Download latest patch receipt', receiptName);
  assert.equal(receipt.version, 2);
  assert.equal(receipt.snapshot.graph.nodes[0].label, 'Orders — reviewed');
  await page.getByRole('button', { name: 'Portable review', exact: true }).click();
  await page
    .getByLabel('I reviewed and accept these packet projection losses', { exact: true })
    .check();
  const packetName = 'native-authoring-workbench-packet.json';
  const packet = await download('Download v2 review packet', packetName);
  assert.equal(packet.version, 2);
  await page.getByLabel('Open v2 receipt', { exact: true }).setInputFiles(path(receiptName));
  await expect(page.getByLabel('Artifact comparison side')).toHaveText('After · strict');
  await page.getByRole('button', { name: 'Before', exact: true }).click();
  await expect(page.getByLabel('Artifact comparison side')).toHaveText('Before · strict');
  await page.getByRole('button', { name: 'After', exact: true }).click();
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await page
    .getByRole('button', { name: 'Return to working model', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: path('native-authoring-workbench-receipt.png'), fullPage: true });
  await page.getByRole('button', { name: 'Return to working model', exact: true }).click();
  await page.getByLabel('Open v2 review packet', { exact: true }).setInputFiles(path(packetName));
  await expect(page.getByRole('heading', { name: /^Review packet:/ })).toBeVisible();
  await page.getByRole('button', { name: 'Before', exact: true }).click();
  await page.getByRole('button', { name: 'Return to working model', exact: true }).click();
  await page.getByRole('button', { name: 'Restore / Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Undo working edit', exact: true }).click();
  await page.getByRole('button', { name: 'Authoring', exact: true }).click();
  const afterUndo = await download(
    'Download latest patch receipt',
    'native-authoring-workbench-retained.json',
  );
  assert.deepEqual(afterUndo, receipt);
  await page.getByRole('button', { name: 'Capture / files', exact: true }).click();
  await page
    .getByLabel('Open v2 model', { exact: true })
    .setInputFiles(
      fileURLToPath(
        new URL(
          '../../../packages/foldkit-zloz/test/fixtures/model-native-v2.json',
          import.meta.url,
        ),
      ),
    );
  await expect(page.getByLabel('Working connection mode')).toHaveText('Working mode: loose');
  await page.getByRole('button', { name: 'Authoring', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare rename example', exact: true }).click();
  await page.getByRole('button', { name: 'Review proposal', exact: true }).click();
  await page.getByLabel('I reviewed this exact proposal', { exact: true }).check();
  await page.getByLabel('I accept the listed authored losses', { exact: true }).check();
  await page.getByRole('button', { name: 'Apply reviewed proposal', exact: true }).click();
  const looseReceipt = await download(
    'Download latest patch receipt',
    'native-authoring-workbench-loose-receipt.json',
  );
  assert.equal(looseReceipt.snapshot.connectionMode, 'loose');
  assert.deepEqual(looseReceipt.snapshot.graph.edges, looseReceipt.patch.source.graph.edges);
  await page.getByRole('button', { name: 'Portable review', exact: true }).click();
  for (const family of ['c4', 'ddd']) {
    await page
      .getByLabel('Open v2 receipt', { exact: true })
      .setInputFiles(
        fileURLToPath(
          new URL(
            `../../../packages/foldkit-zloz/test/fixtures/${family}-conversion-v2.json`,
            import.meta.url,
          ),
        ),
      );
    await expect(
      page.getByRole('heading', {
        name: `${family.toUpperCase()} conversion receipt`,
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Before', exact: true }).click();
    await page.getByRole('button', { name: 'Return to working model', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Authoring', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('heading', { name: 'Native v2 authoring', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: path('native-authoring-workbench-narrow.png'), fullPage: true });
  assert.deepEqual(errors, []);
  const result = {
    base,
    browser: browserName,
    viewport: [1440, 1000],
    narrow: [390, 844],
    checks: [
      'native hydration',
      'return from edition review before opening portable evidence',
      'scoped palette pointer and keyboard placement, live protection, Escape and one Undo',
      ...(browserName === 'chromium' ? ['touch placement and one Undo'] : []),
      'exact review and loss consent',
      'live protection clears consent',
      'atomic Apply',
      'receipt download',
      'packet loss review/download',
      'receipt before/after',
      'packet read-only reopening',
      'working Undo after reopening',
      'retained receipt after Undo',
      'loose model authoring preserves ordered input-to-input edges',
      'C4 and DDD v2 conversion receipts reopen through actual file controls',
      'light/dark and narrow screenshots',
      'no page errors',
    ],
    errors,
  };
  await writeFile(
    path('native-authoring-workbench-browser.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result));
}
// oxlint-disable-next-line linteffect/no-try-catch -- This standalone Playwright evidence script owns the launched browser and closes it on every outcome.
try {
  await run();
} finally {
  await browser.close();
}
