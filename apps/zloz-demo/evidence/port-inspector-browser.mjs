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

async function qualify() {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1500 },
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const inspector = page.getByRole('group', { name: 'Ports for Review', exact: true });
    const reason = 'Review input is managed upstream.';
    const labelInput = () =>
      page.getByRole('textbox', { name: 'Label for in port on Review', exact: true });
    const edit = () => button('Edit label for in port on Review');
    const protection = () => button('Protect Review input');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Review').click();
    await expect(inspector).toHaveAttribute('data-flow-port-inspector-demo', 'composable');
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await edit().click();
    await labelInput().fill('Preserved draft');
    await protection().click();
    await expect(labelInput()).toBeDisabled();
    await expect(button('Save port label')).toBeDisabled();
    await expect(button('Save port label')).toHaveAccessibleDescription(reason);
    await expect(inspector.getByText(reason, { exact: true })).toHaveCount(1);
    await expect(inspector.getByText(reason, { exact: true })).toHaveCSS('border-radius', '999px');
    await button('Cancel port label').press('Escape');
    await expect(labelInput()).toHaveCount(0);
    await expect(edit()).toBeDisabled();
    await expect(edit()).toHaveAccessibleDescription(reason);
    await expect(button('Remove in port from Review')).toHaveAccessibleDescription(reason);
    const ids = await inspector
      .locator('[id]')
      .evaluateAll((elements) => elements.map((element) => element.id));
    expect(new Set(ids).size).toBe(ids.length);
    await button('Minimal mode').click();
    await expect(inspector).toHaveCount(0);
    await button('Minimal mode').click();
    await expect(edit()).toBeDisabled();
    await expect(inspector.getByText(reason, { exact: true })).toHaveCount(1);
    const screenshot = process.env.FLOW_PORT_INSPECTOR_SCREENSHOT;
    if (screenshot) {
      await inspector.scrollIntoViewIfNeeded();
      const panel = await inspector.boundingBox();
      const canvas = await surface.boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvas.x,
          y: canvas.y - 4,
          width: canvas.width,
          height: panel.y + panel.height - canvas.y + 8,
        },
      });
    }
    await protection().click();
    await edit().click();
    await labelInput().fill('Approved');
    await labelInput().press('Enter');
    await expect(button('Connect to Review: Approved')).toBeVisible();
    await expect(button('source:out → review:in')).toBeVisible();
    await button('Undo').click();
    await expect(button('Connect to Review: in')).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      'Composable package inspector retains custom badges, shared reasons, locked Escape, minimal visibility and keyboard Save/Undo',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
