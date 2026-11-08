import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { chromium, expect } from '@playwright/test';

const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  await readFile('../flow-sample/dist' + path)
    .then((body) => {
      res.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
      );
      res.end(body);
    })
    .catch(() => res.writeHead(404).end());
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
async function main() {
  const browser = await chromium.launch();
  const execute = async () => {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1100 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page
      .getByRole('button', { name: 'Open protected Orbit workflow (320 nodes)', exact: true })
      .click();
    const surface = page.locator('[data-flow-surface]');
    await expect(surface.locator('.orbit-node')).toHaveCount(320);
    const guards = page.getByRole('checkbox', {
      name: 'Apply fixture socket policies',
      exact: true,
    });
    const reasons = page.getByRole('checkbox', { name: 'Visible socket reasons', exact: true });
    const cache = page.getByRole('button', { name: 'Retain node views', exact: true });
    await expect(guards).toBeChecked();
    await expect(reasons).toBeChecked();
    await expect(cache).toHaveAttribute('aria-pressed', 'true');
    await expect(surface.locator('[data-flow-port]:disabled')).toHaveCount(140);
    await expect(surface.locator('[data-socket-reason]')).toHaveCount(140);
    expect(
      await surface
        .locator('[data-orbit-body] [data-socket-reason],[data-orbit-body] [data-flow-port]')
        .count(),
    ).toBe(0);
    const locked = surface.locator('[data-flow-owner="load-1-2"][data-flow-port="in"]');
    const lockedOutput = surface.locator('[data-flow-owner="load-1-4"][data-flow-port="out"]');
    const origin = surface.locator('[data-flow-owner="load-1-1"][data-flow-port="out"]');
    await expect(locked).toHaveAccessibleDescription('Approval required for this input.');
    await expect(lockedOutput).toHaveAccessibleDescription('Output reserved for automation.');
    await origin.press('Enter');
    const panel = page.getByRole('group', { name: 'Create a connection', exact: true });
    const source = panel.getByRole('combobox', { name: 'New connection source', exact: true });
    const target = panel.getByRole('combobox', { name: 'New connection target', exact: true });
    await expect(target.locator('option').filter({ hasText: 'Lane 1 · Step 6:' })).toBeDisabled();
    await reasons.uncheck();
    await expect(surface.locator('[data-socket-reason]')).toHaveCount(0);
    await expect(locked).toBeDisabled();
    await expect(origin).toHaveAttribute('aria-pressed', 'true');
    await reasons.check();
    await expect(surface.locator('[data-socket-reason]')).toHaveCount(140);
    await expect(locked).toHaveAccessibleDescription('Approval required for this input.');
    const handle = surface.locator('[data-flow-handle="load-1-1"]');
    await handle.focus();
    const liveHandle = await handle.elementHandle();
    await cache.evaluate((element) => element.click());
    await expect(cache).toHaveAttribute('aria-pressed', 'false');
    await cache.evaluate((element) => element.click());
    await expect(cache).toHaveAttribute('aria-pressed', 'true');
    await expect(handle).toBeFocused();
    expect(
      await liveHandle.evaluate(
        (element) => element === document.querySelector('[data-flow-handle="load-1-1"]'),
      ),
    ).toBe(true);
    await expect(locked).toBeDisabled();
    await target.selectOption(JSON.stringify(['load-1-3', 'in']));
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(453);
    await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(452);
    await origin.press('Enter');
    await handle.focus();
    await guards.evaluate((element) => element.click());
    await expect(surface.locator('[data-flow-port]:disabled')).toHaveCount(0);
    await expect(surface.locator('[data-socket-reason]')).toHaveCount(0);
    await expect(handle).toBeFocused();
    expect(
      await liveHandle.evaluate(
        (element) => element === document.querySelector('[data-flow-handle="load-1-1"]'),
      ),
    ).toBe(true);
    await expect(source).toHaveValue('');
    await source.selectOption(JSON.stringify(['load-1-4', 'out']));
    await target.selectOption(JSON.stringify(['load-1-6', 'in']));
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(453);
    await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(452);
    await guards.check();
    await expect(surface.locator('[data-flow-port]:disabled')).toHaveCount(140);
    await expect(surface.locator('[data-socket-reason]')).toHaveCount(140);
    await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
    await expect(surface.locator('[data-socket-reason]')).toHaveCount(140);
    await origin.press('Enter');
    await surface.screenshot({ path: '../flow-sample/evidence/protected-orbit-overview.png' });
    const detail = surface.locator('[data-flow-node="load-10-4"]');
    const detailBox = await detail.boundingBox();
    await page.mouse.move(detailBox.x + detailBox.width / 2, detailBox.y + detailBox.height / 2);
    await page.keyboard.down('Control');
    for (let step = 0; step < 2; step++) await page.mouse.wheel(0, -450);
    await page.keyboard.up('Control');
    await expect.poll(async () => (await detail.boundingBox()).width).toBeGreaterThan(80);
    await surface.screenshot({ path: '../flow-sample/evidence/protected-orbit.png' });
    expect(errors).toEqual([]);
    console.log(
      JSON.stringify(
        {
          result: 'passed',
          browser: browser.version(),
          nodes: 320,
          edges: 452,
          disabledSockets: 140,
          renderedReasons: 140,
          checks: [
            'native descriptions for both guard types',
            'disabled target choice',
            'badge toggle preserves guards and source',
            'cache toggle preserves live control focus/identity',
            'allowed creation and Undo',
            'policy toggle cancels pending source and updates live sockets',
            'previously guarded creation after relaxation and Undo',
            'minimal mode retains semantic reasons',
          ],
          pageErrors: errors,
          screenshot: 'protected-orbit.png',
        },
        null,
        2,
      ),
    );
  };
  await execute().finally(() => browser.close());
}
await main().finally(() => new Promise((resolve) => server.close(resolve)));
