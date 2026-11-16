import { readFile } from 'node:fs/promises';
declare global {
  interface Window {
    axe: typeof axe;
    __qualifiedServerNode?: Element;
  }
}

import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type axe from 'axe-core';

test('native resize/anchor keyboard focus, protected minimal controls, atomic review/download/reopening', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/groups');
  const surface = page.locator('#group-v3-canvas');
  await expect(surface).toBeVisible();
  const node = surface.locator('[data-flow-node="orders"]');
  await surface.locator('[data-flow-handle="orders"]').click();
  const width = await node.evaluate((el) => el.getBoundingClientRect().width);
  const resize = surface.getByRole('button', {
    name: 'Resize Orders boundary, bottom-right',
    exact: true,
  });
  await resize.focus();
  await resize.press('ArrowRight');
  await expect
    .poll(() => node.evaluate((el) => el.getBoundingClientRect().width))
    .toBeGreaterThan(width);
  await expect(resize).toBeFocused();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => node.evaluate((el) => el.getBoundingClientRect().width)).toBe(width);
  const anchor = surface.locator('[data-flow-anchor-node="orders"][data-flow-anchor-port="api"]');
  await anchor.focus();
  await anchor.press('ArrowUp');
  await expect(anchor).toBeFocused();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Protect service and interface', exact: true }).click();
  await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
  await expect(anchor).toBeDisabled();
  await expect(
    page.getByText('The published interface is protected.', { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  await page.screenshot({ path: info.outputPath('protected-minimal-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Disable protection', exact: true }).click();
  await page.getByText('Native mapping, patches and portable review', { exact: true }).click();
  await page.getByRole('button', { name: 'Generate sample patch', exact: true }).click();
  await page
    .getByText('I reviewed the proposed changes and accept the disclosed losses.', { exact: true })
    .click();
  await page.getByRole('button', { name: 'Apply reviewed patch', exact: true }).click();
  await expect(surface.locator('[data-flow-handle="orders"]')).toContainText('reviewed');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download retained artifact', exact: true }).click();
  const file = await downloaded,
    path = await file.path();
  if (!path) throw new Error('Download missing');
  const receipt = JSON.parse(await readFile(path, 'utf8'));
  expect(receipt.version).toBe(3);
  expect(receipt.reviewed).toBe(true);
  await page.getByLabel('Open native evidence file', { exact: true }).setInputFiles(path);
  await expect(page.getByRole('region', { name: 'Read-only evidence canvas' })).toBeVisible();
  await page.getByRole('button', { name: 'Before', exact: true }).click();
  await expect(surface.locator('[data-flow-handle="orders"]')).not.toContainText('reviewed');
  await expect(surface).toHaveAttribute('data-flow-readonly', 'true');
  await page.getByRole('button', { name: 'Return to working canvas', exact: true }).click();
  await expect(surface.locator('[data-flow-handle="orders"]')).toContainText('reviewed');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(surface.locator('[data-flow-handle="orders"]')).not.toContainText('reviewed');
  // Corrupt, duplicate-key and invalid UTF-8 recovery preserve the working canvas.
  for (const buffer of [Buffer.from('{"version":3,"version":3}'), Buffer.from([0xff, 0xfe])]) {
    await page
      .getByLabel('Open native evidence file', { exact: true })
      .setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer });
    await expect(surface).toHaveAttribute('data-flow-readonly', 'false');
  }
  await page.screenshot({ path: info.outputPath('review-recovery.png'), fullPage: true });
  expect(errors).toEqual([]);
});

for (const count of [100, 1000])
  for (const nested of [false, true]) {
    test(`SSR hydration and keyboard paint observations ${count} ${nested ? 'nested' : 'flat'}`, async ({
      page,
      request,
    }, info) => {
      const path = `/qualification/${count}-${nested ? 'nested' : 'flat'}`;
      const response = await request.get(path),
        html = await response.text();
      expect((html.match(/data-flow-node=/g) ?? []).length).toBe(count);
      // Hold the exact server DOM node reference across hydration: count equality alone cannot prove reuse.
      await page.addInitScript(() => {
        document.addEventListener(
          'DOMContentLoaded',
          () => {
            const node = document.querySelector('[data-flow-node="n0"]');
            if (node)
              Object.defineProperty(window, '__qualifiedServerNode', {
                value: node,
                configurable: true,
              });
          },
          { once: true },
        );
      });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const started = Date.now();
      await page.goto(path);
      const surface = page.locator('#qualification-canvas'),
        state = page.locator('[data-qualification-revision]');
      await expect(surface.locator('[data-flow-node]')).toHaveCount(count);
      await page.locator('astro-island').evaluate(async (el) => {
        while (el.hasAttribute('ssr')) await new Promise((r) => setTimeout(r, 10));
      });
      const mountedMs = Date.now() - started;
      // Server node identity may be captured before client:load or skipped if hydration finished first;
      // the response assertion above always proves server-rendered graph markup.
      const reused = await page.evaluate(() => {
        const before = window.__qualifiedServerNode;
        return before ? before === document.querySelector('[data-flow-node="n0"]') : null;
      });
      if (reused !== null) expect(reused).toBe(true);
      const handle = surface.locator('[data-flow-handle="n1"]');
      await handle.focus();
      await handle.press('Enter');
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await handle.press('ArrowRight');
        await expect(state).toHaveAttribute('data-qualification-revision', String(i + 1));
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        samples.push(Date.now() - start);
      }
      await page.getByRole('button', { name: 'Toggle protection', exact: true }).click();
      await handle.press('ArrowRight');
      await expect(state).toHaveAttribute('data-qualification-revision', '5');
      await page.getByRole('button', { name: 'Toggle protection', exact: true }).click();
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(state).toHaveAttribute('data-qualification-revision', '6');
      await expect(state).toHaveAttribute('data-qualification-history', '4');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
      await page.getByRole('button', { name: 'Toggle minimal mode', exact: true }).click();
      await expect(surface).toBeVisible();
      expect(errors).toEqual([]);
      await info.attach('observations.json', {
        body: JSON.stringify(
          {
            project: info.project.name,
            count,
            nested,
            mountedMs,
            keyboardToTwoFramesMs: samples,
            serverNodeReused: reused,
            notes:
              'Five sequential samples including Playwright scheduling and two animation frames; no agreed numeric performance threshold.',
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });
      if (count === 100 && nested)
        await page.screenshot({ path: info.outputPath('native-nested-dark.png'), fullPage: true });
    });
  }

test('WCAG automation covers the native light/dark/minimal/protected surface and review forms', async ({
  page,
}, info) => {
  await page.goto('/groups');
  await expect(page.locator('#group-v3-canvas [data-flow-node]')).toHaveCount(3);
  await page.locator('[data-flow-handle="service"]').click();
  await page.getByText('Native mapping, patches and portable review', { exact: true }).click();
  for (const dark of [false, true]) {
    if (dark) await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
    await page.addScriptTag({ path: fileURLToPath(import.meta.resolve('axe-core/axe.min.js')) });
    const results = await page.evaluate(() =>
      window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      }),
    );
    await info.attach(`axe-${dark ? 'dark' : 'light'}.json`, {
      body: JSON.stringify(
        {
          violations: results.violations,
          incomplete: results.incomplete,
          passes: results.passes.map((p) => p.id),
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    expect(results.violations).toEqual([]);
  }
  await page.getByRole('button', { name: 'Protect service and interface', exact: true }).click();
  await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
  const results = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    }),
  );
  await info.attach('axe-protected-minimal.json', {
    body: JSON.stringify(
      { violations: results.violations, incomplete: results.incomplete },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(results.violations).toEqual([]);
});

test('native pointer resize, anchor drag, reconnection and box selection use the live scoped input', async ({
  page,
}) => {
  await page.goto('/groups');
  const surface = page.locator('#group-v3-canvas');
  await expect(surface.locator('[data-flow-node]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await surface.locator('[data-flow-handle="orders"]').click();
  const node = surface.locator('[data-flow-node="orders"]');
  const geometry = () =>
    node.evaluate((el) => ({
      width: parseFloat(getComputedStyle(el).width),
      height: parseFloat(getComputedStyle(el).height),
    }));
  const before = await geometry();
  const resize = surface.locator('[data-flow-resize="orders"]'),
    r = await resize.boundingBox();
  if (!r) throw new Error('Resize missing');
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 25, r.y + r.height / 2 + 15, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await geometry()).width).toBeGreaterThan(before.width);
  await expect.poll(async () => (await geometry()).height).toBeGreaterThan(before.height);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(geometry).toEqual(before);
  const anchor = surface.locator('[data-flow-anchor-node="orders"]'),
    a = await anchor.boundingBox(),
    port = surface.locator('[data-flow-owner="orders"][data-flow-port="api"]'),
    portBefore = await port.getAttribute('style');
  if (!a) throw new Error('Anchor missing');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 - 20, { steps: 4 });
  await page.mouse.up();
  await expect(port).not.toHaveAttribute('style', portBefore!);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const edge = surface.locator('[data-flow-edge="service-events"]');
  await edge.focus();
  await edge.press('Enter');
  const d = await edge.getAttribute('d'),
    reconnect = surface.locator(
      '[data-flow-reconnect="service-events"][data-flow-edge-end="source"]',
    ),
    e = await reconnect.boundingBox(),
    target = await port.boundingBox();
  if (!e || !target) throw new Error('Reconnect endpoints missing');
  await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2);
  await page.mouse.down();
  await page.mouse.move(e.x + e.width / 2 + 6, e.y + e.height / 2, { steps: 2 });
  await port.hover();
  await page.mouse.up();
  await expect(edge).not.toHaveAttribute('d', d!);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(edge).toHaveAttribute('d', d!);
  const bounds = await surface.boundingBox();
  if (!bounds) throw new Error('Surface missing');
  await page.keyboard.down('Shift');
  await page.mouse.move(bounds.x + bounds.width - 6, bounds.y + bounds.height - 6);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 6, bounds.y + 6, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(surface.locator('[data-flow-resize]')).toHaveCount(2);
});

test('Chromium synthetic multitouch pinch changes only the camera and leaves Undo untouched', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Native multitouch protocol is available through Chromium CDP; other real-device pinch remains a human gate.',
  );
  await page.goto('/qualification/100-flat');
  const surface = page.locator('#qualification-canvas');
  await expect(surface.locator('[data-flow-node]')).toHaveCount(100);
  await expect(page.getByRole('status').filter({ hasText: 'Gesture cancelled.' })).toBeVisible();
  const bounds = await surface.boundingBox();
  if (!bounds) throw new Error('Surface missing');
  const world = surface.locator(':scope > div').first(),
    before = await world.getAttribute('style');
  const session = await context.newCDPSession(page),
    x = bounds.x + bounds.width / 2,
    y = bounds.y + Math.min(bounds.height, page.viewportSize()!.height - bounds.y) / 2;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: x - 30, y, id: 1 },
      { x: x + 30, y, id: 2 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: x - 50, y, id: 1 },
      { x: x + 50, y, id: 2 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(world).not.toHaveAttribute('style', before!);
  await expect(page.locator('[data-qualification-revision]')).toHaveAttribute(
    'data-qualification-revision',
    '0',
  );
  await expect(page.locator('[data-qualification-history]')).toHaveAttribute(
    'data-qualification-history',
    '0',
  );
  await session.detach();
});

for (const family of ['c4', 'ddd'] as const)
  test(`${family} conversion requires relation decisions, publishes one receipt and reopens read-only`, async ({
    page,
  }, info) => {
    await page.goto('/groups');
    await expect(page.locator('#group-v3-canvas [data-flow-node]')).toHaveCount(3);
    await page.getByText('Native mapping, patches and portable review', { exact: true }).click();
    await page
      .getByRole('button', {
        name: family === 'c4' ? 'C4 system at root' : 'DDD domain service',
        exact: true,
      })
      .click();
    const accepted = page.getByLabel('Accept native proposal and loss findings', { exact: true });
    await expect(accepted).toBeDisabled();
    await page.getByRole('button', { name: 'Keep relation: Order placed', exact: true }).click();
    await expect(accepted).toBeEnabled();
    await accepted.check();
    await page.screenshot({
      path: info.outputPath(`${family}-mapping-review.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Apply reviewed conversion', exact: true }).click();
    const waiting = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download retained artifact', exact: true }).click();
    const download = await waiting,
      path = await download.path();
    if (!path) throw new Error('Missing conversion receipt');
    const receipt = JSON.parse(await readFile(path, 'utf8'));
    expect(receipt.version).toBe(3);
    expect(receipt.lossesAccepted).toBe(true);
    await page.getByLabel('Open native evidence file', { exact: true }).setInputFiles(path);
    await expect(page.getByRole('region', { name: 'Read-only evidence canvas' })).toBeVisible();
    await expect(page.locator('#group-v3-canvas')).toHaveAttribute('data-flow-readonly', 'true');
    await page.screenshot({
      path: info.outputPath(`${family}-receipt-reopened.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Return to working canvas', exact: true }).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    // A fresh mapping control proves one Undo restores the original workshop semantic node.
    await expect(
      page.getByRole('button', { name: 'C4 system at root', exact: true }),
    ).toBeVisible();
  });
