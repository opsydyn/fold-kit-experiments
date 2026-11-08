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
    await button('Select Draft').click();
    await button('Add output port').click();
    await button('Select Review').click();
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await protection().click();
    await expect(edit()).toBeDisabled();
    await expect(edit()).toHaveAccessibleDescription(reason);
    await expect(button('Remove in port from Review')).toBeDisabled();
    await expect(button('Remove in port from Review')).toHaveAccessibleDescription(reason);
    await expect(button('Edit label for out port on Review')).toBeEnabled();
    await expect(button('Remove out port from Review')).toBeEnabled();
    await button('Connect from Draft: Output 1').press('Enter');
    await button('Connect to Review: in').press('Enter');
    await expect(button('source:output-1 → review:in')).toBeVisible();
    const anchors = page.getByRole('combobox', { name: 'Port anchors', exact: true });
    const presetBefore = await anchors.inputValue();
    const surfaceBefore = await surface.boundingBox();
    const inputBefore = await button('Connect to Review: in').boundingBox();
    const outputBefore = await button('Connect from Review: out').boundingBox();
    await anchors.selectOption('diagonal');
    await expect(page.getByRole('status').filter({ hasText: reason }).first()).toBeVisible();
    await expect(anchors).toHaveValue(presetBefore);
    const surfaceAfter = await surface.boundingBox();
    expect((await button('Connect to Review: in').boundingBox()).y - surfaceAfter.y).toBeCloseTo(
      inputBefore.y - surfaceBefore.y,
      0,
    );
    expect((await button('Connect from Review: out').boundingBox()).y).toBeCloseTo(
      outputBefore.y,
      0,
    );
    await protection().click();
    await edit().click();
    await labelInput().fill('Approval required');
    await protection().click();
    await expect(labelInput()).toBeDisabled();
    await expect(labelInput()).toHaveValue('Approval required');
    await expect(button('Save port label')).toBeDisabled();
    await expect(button('Save port label')).toHaveAccessibleDescription(reason);
    await expect(button('Cancel port label')).toBeEnabled();
    const screenshot = process.env.FLOW_PORT_EDIT_POLICY_SCREENSHOT;
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
    await expect(labelInput()).toBeEnabled();
    await labelInput().press('Enter');
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await expect(button('source:output-1 → review:in')).toBeVisible();
    await button('Undo').click();
    await expect(button('Connect to Review: in')).toBeVisible();
    await button('Select Review').click();
    await button('Protect required items').click();
    await expect(edit()).toBeEnabled();
    await expect(button('Remove in port from Review')).toHaveAccessibleDescription(
      'This connection is required.',
    );
    await protection().click();
    await expect(button('Remove in port from Review')).toHaveAccessibleDescription(reason);
    await protection().click();
    await expect(button('Remove in port from Review')).toHaveAccessibleDescription(
      'This connection is required.',
    );
    expect(errors).toEqual([]);
    console.log(
      'Per-port edit protection, visible reasons, atomic anchor veto, live draft locks and independent wiring passed',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
