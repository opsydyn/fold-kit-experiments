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
    const labelInput = () =>
      page.getByRole('textbox', { name: 'Label for in port on Review', exact: true });
    const edit = () => button('Edit label for in port on Review');
    const connection = button('source:out → review:in');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Review').click();
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await button('Protect required items').click();
    await edit().click();
    await labelInput().fill('Approval required');
    await expect(button('Connect to Review: in')).toBeVisible();
    await expect(connection).toBeVisible();
    await labelInput().press('Enter');
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await expect(labelInput()).toHaveCount(0);
    await expect(connection).toBeVisible();
    await button('Undo').click();
    await expect(button('Connect to Review: in')).toBeVisible();
    await button('Redo').click();
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await button('Select Review').click();
    await edit().click();
    await labelInput().fill('Discard me');
    await labelInput().press('Escape');
    await expect(labelInput()).toHaveCount(0);
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await edit().click();
    await labelInput().fill('Also discarded');
    await button('Cancel port label').click();
    await expect(labelInput()).toHaveCount(0);
    await edit().click();
    await labelInput().fill('');
    await button('Save port label').click();
    await expect(button('Connect to Review: in')).toBeVisible();
    await expect(connection).toBeVisible();
    await button('Undo').click();
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await button('Select Review').click();
    await expect(button('Remove Approval required port from Review')).toBeDisabled();

    const screenshot = process.env.FLOW_PORT_LABEL_EDITING_SCREENSHOT;
    if (screenshot) {
      await edit().click();
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
      await button('Cancel port label').click();
    }
    await edit().click();
    await labelInput().fill('Stale draft');
    await button('Add input port').click();
    await expect(labelInput()).toHaveCount(0);
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await expect(button('Connect to Review: Input 1')).toBeVisible();
    await edit().click();
    await labelInput().fill('Wrong node');
    await button('Select Draft').click();
    await expect(labelInput()).toHaveCount(0);
    await button('Select Review').click();
    await edit().click();
    await expect(labelInput()).toHaveValue('Approval required');
    await button('Cancel port label').click();
    expect(errors).toEqual([]);
    console.log(
      'Port label save, draft isolation, cancellation, clearing, stable wiring and Undo/Redo passed',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
