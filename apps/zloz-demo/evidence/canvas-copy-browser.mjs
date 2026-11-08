import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { chromium, expect } from '@playwright/test';
const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  await readFile('../zloz-demo/dist' + path)
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
const qualify = async () => {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 2000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const surface = page.locator('[data-flow-surface]');
    const help = page.locator('[data-flow-help]');
    const status = page.locator('[data-flow-status]');
    const design = page.getByRole('combobox', { name: 'Canvas help and status', exact: true });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await expect(help).toHaveText(/Drag a node title/);
    await expect(status).toHaveText('3 nodes, 1 connections');
    await design.selectOption('card');
    await expect(help.locator('.canvas-help-card')).toBeVisible();
    await expect(status.locator('.canvas-status-card')).toHaveText('3 nodes · 1 connection');
    await expect(surface).toHaveAccessibleDescription(
      /Canvas controls.*Shift-drag to select nodes/,
    );
    await expect(button('Select Draft')).toHaveAccessibleDescription(
      /Canvas controls.*Scroll to zoom/,
    );
    await button('Box select').click();
    await expect(surface).toHaveAccessibleDescription(/Drag the background to select nodes/);
    await button('Box select').click();
    await page.locator('#flow-demo').screenshot({ path: '/tmp/foldkit-zloz-canvas-copy.png' });

    const region = await status.elementHandle();
    await button('Select Draft').click();
    await button('Duplicate').click();
    await expect(status).toHaveText('Selection duplicated');
    expect(await status.evaluate((element, original) => element === original, region)).toBe(true);
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await button('Undo').click();
    await expect(status).toHaveText('Undone');
    expect(await exportGraph()).toEqual(initial);

    await button('Diagnostics').click();
    const instructions = page.getByRole('checkbox', { name: 'Instructions', exact: true });
    const visibleStatus = page.getByRole('checkbox', { name: 'Visible status', exact: true });
    await instructions.uncheck();
    await expect(help).toHaveCSS('position', 'absolute');
    await expect(status).toHaveCSS('position', 'static');
    await expect(surface).toHaveAccessibleDescription(/Canvas controls/);
    await visibleStatus.uncheck();
    await expect(status).toHaveCSS('position', 'absolute');
    await expect(status).toHaveText('Undone');
    await instructions.check();
    await visibleStatus.check();

    await button('Minimal mode').click();
    await expect(help).toHaveCSS('position', 'absolute');
    await expect(status).toHaveCSS('position', 'absolute');
    await expect(surface).toHaveAccessibleDescription(/Canvas controls.*Escape cancels/);
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveText('Undone');
    expect(await status.evaluate((element, original) => element === original, region)).toBe(true);
    await button('Minimal mode').click();
    await expect(help).toHaveCSS('position', 'static');
    await expect(status).toHaveCSS('position', 'static');
    await region.dispose();
    expect(errors).toEqual([]);
    console.log(
      'Custom help, selection-aware descriptions, stable live status, and diagnostics passed',
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
