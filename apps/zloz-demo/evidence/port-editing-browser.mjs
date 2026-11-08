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
    const input = button('Connect to Review: Input 1');
    const connection = button('source:out → review:input-1');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Review').click();
    await expect(inspector).toBeVisible();
    await page.getByRole('checkbox', { name: 'Port labels' }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets' }).check();
    await button('Add input port').dblclick();
    await expect(input).toHaveCount(1);
    await expect(button('Connect to Review: Input 2')).toHaveCount(1);
    await button('Undo').click();
    await expect(button('Connect to Review: Input 2')).toHaveCount(0);
    await expect(input).toHaveCount(1);
    await button('Undo').click();
    await expect(input).toHaveCount(0);

    await button('Select Review').click();
    await button('Add input port').click();
    await expect(input).toBeVisible();
    await button('Connect from Draft: out').press('Enter');
    await input.press('Enter');
    await expect(connection).toBeVisible();
    await button('Protect required items').click();
    await expect(button('Remove in port from Review')).toBeDisabled();
    await expect(button('Remove in port from Review')).toHaveAccessibleDescription(
      'This connection is required.',
    );
    const remove = button('Remove Input 1 port from Review');
    await expect(remove).toBeEnabled();

    const screenshot = process.env.FLOW_PORT_EDITING_SCREENSHOT;
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

    await remove.click();
    await expect(input).toHaveCount(0);
    await expect(connection).toHaveCount(0);
    await expect(button('source:out → review:in')).toBeVisible();
    await button('Undo').click();
    await expect(input).toBeVisible();
    await expect(connection).toBeVisible();
    await button('Redo').click();
    await expect(input).toHaveCount(0);
    await expect(connection).toHaveCount(0);
    await button('Undo').click();
    await button('Select Review').click();
    await button('Remove out port from Review').click();
    await expect(button('Connect from Review: out')).toHaveCount(0);
    await button('Undo').click();
    await expect(button('Connect from Review: out')).toBeVisible();

    await button('Select Review').click();
    await button('Add output port').click();
    await expect(button('Connect from Review: Output 1')).toBeVisible();
    await button('Undo').click();
    await expect(button('Connect from Review: Output 1')).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      'Rapid port additions, wiring, protected removal, atomic Undo/Redo and isolated output editing passed',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
