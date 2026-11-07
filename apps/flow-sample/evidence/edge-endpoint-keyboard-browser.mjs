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

async function qualify() {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const inspector = page.getByRole('group', { name: 'Selected connection', exact: true });
    const toolbar = page.getByRole('group', { name: 'Selected edge actions', exact: true });
    const target = inspector.getByRole('combobox', { name: 'Target port', exact: true });
    const source = inspector.getByRole('combobox', { name: 'Source port', exact: true });
    const targetValue = (node) => JSON.stringify([node, 'in']);
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('source:out → review:in').press('Enter');
    await expect(button('source:out → review:in')).toHaveAttribute('aria-pressed', 'true');
    await target.focus();
    // Native select type-ahead exercises real keyboard selection on macOS.
    await target.press('p');
    await expect(target).toHaveValue(targetValue('publish'));
    await expect(target).toBeFocused();
    await expect(button('source:out → publish:in')).toHaveAttribute('aria-pressed', 'true');
    await target.press('Shift+Tab');
    await expect(target).not.toBeFocused();
    await button('Undo').press('Enter');
    await expect(button('source:out → review:in')).toBeVisible();
    await button('Redo').press('Enter');
    await expect(button('source:out → publish:in')).toBeVisible();
    await button('Undo').press('Enter');

    await button('source:out → review:in').press('Enter');
    await expect(button('source:out → review:in')).toHaveAttribute('aria-pressed', 'true');
    // Existing package focus handoff reaches the toolbar, then native Tab finds its chooser.
    await button('source:out → review:in').press('ArrowUp');
    await expect(toolbar.getByRole('button', { name: 'Rename', exact: true })).toBeFocused();
    const toolbarTarget = toolbar.getByRole('combobox', { name: 'Target port', exact: true });
    for (
      let step = 0;
      step < 5 && !(await toolbarTarget.evaluate((element) => element === document.activeElement));
      step++
    )
      await page.keyboard.press('Tab');
    await expect(toolbarTarget).toBeFocused();
    await toolbarTarget.press('p');
    await expect(toolbarTarget).toHaveValue(targetValue('publish'));
    await expect(toolbarTarget).toBeFocused();
    await expect(target).toHaveValue(targetValue('publish'));
    await toolbarTarget.press('Tab');
    await expect(toolbarTarget).not.toBeFocused();
    await button('Undo').press('Enter');

    await button('source:out → review:in').press('Enter');
    await expect(button('source:out → review:in')).toHaveAttribute('aria-pressed', 'true');
    const lock = page.getByRole('combobox', { name: 'Draft to Review reconnection' });
    await lock.selectOption('source');
    await expect(source).toBeDisabled();
    await expect(source).toHaveAccessibleDescription(/Source reconnection is locked/);
    await expect(
      toolbar.getByRole('combobox', { name: 'Source port', exact: true }),
    ).toBeDisabled();
    await expect(target).toBeEnabled();
    await inspector.screenshot({ path: '../flow-sample/evidence/edge-endpoint-inspector.png' });
    await page.getByRole('checkbox', { name: 'Lock Publish input', exact: true }).check();
    await expect(target.locator('option', { hasText: 'Publish: in' })).toBeDisabled();
    await expect(
      inspector.getByText('Publish: in: Publish input is closed to new connections.', {
        exact: true,
      }),
    ).toBeVisible();
    await target.focus();
    // Native select type-ahead exercises real keyboard selection on macOS.
    await target.press('p');
    await expect(target).toHaveValue(targetValue('review'));
    await expect(target).toBeFocused();
    await page.getByRole('checkbox', { name: 'Lock Publish input', exact: true }).uncheck();
    await expect(target.locator('option', { hasText: 'Publish: in' })).toBeEnabled();
    await target.focus();
    // Native select type-ahead exercises real keyboard selection on macOS.
    await target.press('p');
    await expect(target).toHaveValue(targetValue('publish'));
    await expect(target).toBeFocused();
    await button('Undo').press('Enter');

    await button('source:out → review:in').press('Enter');
    await expect(button('source:out → review:in')).toHaveAttribute('aria-pressed', 'true');
    await lock.selectOption('none');
    await expect(source).toBeEnabled();
    const draftLock = page.getByRole('checkbox', { name: 'Lock Draft output', exact: true });
    await draftLock.check();
    await expect(button('Connect from Draft: out')).toBeDisabled();
    await expect(source).toBeEnabled();
    await source.focus();
    await source.press('r');
    await expect(source).toHaveValue(JSON.stringify(['review', 'out']));
    await expect(source).toBeFocused();
    await expect(source).toHaveAccessibleDescription(/No other eligible ports/);
    await button('Undo').press('Enter');
    await expect(button('source:out → review:in')).toBeVisible();
    await draftLock.uncheck();
    await button('source:out → review:in').press('Enter');
    await expect(button('source:out → review:in')).toHaveAttribute('aria-pressed', 'true');
    await button('Fit view').press('Enter');
    await toolbar.scrollIntoViewIfNeeded();
    const box = await page.locator('[data-flow-surface]').boundingBox();
    const toolbarBox = await toolbar.boundingBox();
    expect(toolbarBox.x).toBeGreaterThanOrEqual(box.x);
    expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(box.y + box.height);
    expect(toolbarBox.width).toBeLessThanOrEqual(box.width);
    await page.screenshot({
      path: '../flow-sample/evidence/edge-endpoint-keyboard.png',
      clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    });
    // Optional diagnostics must not remove the choosers or their required protection copy.
    await button('Minimal mode').press('Enter');
    await expect(toolbarTarget).toBeVisible();
    await lock.selectOption('source');
    await expect(
      toolbar.getByRole('combobox', { name: 'Source port', exact: true }),
    ).toHaveAccessibleDescription(/Source reconnection is locked/);
    await lock.selectOption('none');
    const toolbarSource = toolbar.getByRole('combobox', { name: 'Source port', exact: true });
    await expect(toolbarSource).toBeEnabled();
    await page.getByRole('combobox', { name: 'Edge actions', exact: true }).selectOption('compact');
    await expect(toolbar.locator('.compact-edge-actions')).toBeVisible();
    await toolbarSource.focus();
    await toolbarSource.press('r');
    await expect(toolbarSource).toHaveValue(JSON.stringify(['review', 'out']));
    await expect(toolbarSource).toBeFocused();
    expect(errors).toEqual([]);
    console.log(
      'Keyboard endpoint changes, focus retention/Tab exit, toolbar handoff, protection reasons, minimal mode, custom toolbar and Undo/Redo passed.',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
