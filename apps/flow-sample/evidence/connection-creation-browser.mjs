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
    const panel = page.getByRole('group', { name: 'Create a connection', exact: true });
    const source = panel.getByRole('combobox', { name: 'New connection source', exact: true });
    const target = panel.getByRole('combobox', { name: 'New connection target', exact: true });
    const value = (node, port) => JSON.stringify([node, port]);
    const wire = button('review:out → publish:in');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await expect(target).toBeEnabled();
    await expect(target).toHaveAccessibleDescription('Choose an output port first.');
    await source.focus();
    await source.press('r');
    await expect(source).toHaveValue(value('review', 'out'));
    await expect(panel.getByRole('button', { name: 'Cancel choice', exact: true })).toBeEnabled();
    await expect(source).toBeFocused();
    await button('Undo').press('Enter');
    await expect(button('source:out → review:in')).toBeVisible();
    await source.focus();
    await source.press('Tab');
    await expect(
      page.getByRole('searchbox', { name: 'Search new connection targets', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    await target.press('p');
    await expect(wire).toBeVisible();
    await expect(source).toHaveValue('');
    await expect(target).toHaveValue('');
    await expect(target).toBeFocused();
    await target.press('Tab');
    await expect(target).not.toBeFocused();
    await button('Undo').press('Enter');
    await expect(wire).toHaveCount(0);
    await button('Redo').press('Enter');
    await expect(wire).toBeVisible();
    await button('Undo').press('Enter');
    await expect(wire).toHaveCount(0);

    await source.focus();
    await source.press('r');
    await expect(source).toHaveValue(value('review', 'out'));
    await expect(panel.getByRole('button', { name: 'Cancel choice', exact: true })).toBeEnabled();
    await target.focus();
    await target.press('Escape');
    await expect(source).toHaveValue('');
    await expect(target).toBeFocused();
    await button('Undo').press('Enter');
    await expect(wire).toHaveCount(0);
    await expect(button('source:out → review:in')).toBeVisible();
    await source.focus();
    await source.press('r');
    await expect(source).toHaveValue(value('review', 'out'));
    await expect(panel.getByRole('button', { name: 'Cancel choice', exact: true })).toBeEnabled();
    await panel.getByRole('button', { name: 'Cancel choice', exact: true }).press('Enter');
    await expect(source).toHaveValue('');
    await button('Undo').press('Enter');
    await expect(wire).toHaveCount(0);
    await expect(button('source:out → review:in')).toBeVisible();

    // The same pending source is shared with native canvas port activation.
    await button('Connect from Draft: out').press('Enter');
    await expect(source).toHaveValue(value('source', 'out'));
    await expect(target.locator('option', { hasText: 'Review: in' })).toBeDisabled();
    await expect(target).toHaveAccessibleDescription(/These ports are already connected/);
    await page.getByRole('checkbox', { name: 'Lock Draft output', exact: true }).check();
    // The workbench intentionally cancels its pending source when port-lock settings change.
    await expect(source).toHaveValue('');
    await expect(source).toHaveAccessibleDescription(/Draft output is closed to new connections/);
    await expect(target).toHaveAccessibleDescription('Choose an output port first.');
    await source.focus();
    await source.press('r');
    await expect(source).toHaveValue(value('review', 'out'));
    await expect(panel.getByRole('button', { name: 'Cancel choice', exact: true })).toBeEnabled();
    await expect(target).toBeEnabled();
    await page.getByRole('checkbox', { name: 'Lock Publish input', exact: true }).check();
    await expect(source).toHaveValue('');
    await source.focus();
    await source.press('r');
    await expect(panel.getByRole('button', { name: 'Cancel choice', exact: true })).toBeEnabled();
    await expect(target.locator('option', { hasText: 'Publish: in' })).toBeDisabled();
    await expect(target).toHaveAccessibleDescription(/Publish input is closed to new connections/);
    await panel.screenshot({ path: '../flow-sample/evidence/connection-creation.png' });
    await target.focus();
    await target.press('p');
    await expect(target).toHaveValue('');
    await expect(target).toBeFocused();
    await expect(wire).toHaveCount(0);

    await button('Minimal mode').press('Enter');
    await expect(panel).toBeVisible();
    await expect(target).toHaveAccessibleDescription(/Publish input is closed to new connections/);
    await page.getByRole('checkbox', { name: 'Lock Publish input', exact: true }).uncheck();
    await expect(source).toHaveValue('');
    await source.focus();
    await source.press('r');
    await expect(panel.getByRole('button', { name: 'Cancel choice', exact: true })).toBeEnabled();
    await expect(target.locator('option', { hasText: 'Publish: in' })).toBeEnabled();
    await target.focus();
    await target.press('p');
    await expect(source).toHaveValue('');
    await expect(target).toHaveValue('');
    await expect(target).toBeFocused();
    await button('Connections').press('Enter');
    await expect(button('Review → Publish')).toBeVisible();
    await button('Undo').press('Enter');
    await expect(button('Review → Publish')).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      'Native keyboard creation, source sharing, policy descriptions, cancellation, focus/reset, Tab, minimal mode and Undo/Redo passed.',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
