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
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const lock = page.getByRole('combobox', { name: 'Draft to Review reconnection' });
    const source = page
      .getByRole('group', { name: 'Selected connection', exact: true })
      .getByRole('combobox', { name: 'Source port' });
    const target = page
      .getByRole('group', { name: 'Selected connection', exact: true })
      .getByRole('combobox', { name: 'Target port' });
    const surface = page.locator('[data-flow-surface]');
    const handles = surface.locator('[data-flow-reconnect="draft-review"]');
    const sourceHandle = handles.and(surface.locator('[data-flow-edge-end="source"]'));
    const targetHandle = handles.and(surface.locator('[data-flow-edge-end="target"]'));

    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('source:out → review:in').click();
    await expect(handles).toHaveCount(2);
    await lock.selectOption('source');
    await expect(sourceHandle).toHaveCount(0);
    await expect(targetHandle).toBeVisible();
    await expect(source).toBeDisabled();
    await expect(source).toHaveAccessibleDescription(/Source reconnection is locked\./);
    await expect(target).toBeEnabled();

    await button('Fit view').click();
    await surface.scrollIntoViewIfNeeded();
    const canvas = await surface.boundingBox();
    const selector = await lock.boundingBox();
    await page.screenshot({
      path: '/tmp/foldkit-flow-reconnect-permission.png',
      clip: {
        x: canvas.x - 12,
        y: selector.y - 12,
        width: canvas.width + 24,
        height: canvas.y + canvas.height - selector.y + 34,
      },
    });

    const handle = await targetHandle.boundingBox();
    expect(
      await targetHandle.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return document
          .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          ?.closest('[data-flow-reconnect]')
          ?.getAttribute('data-flow-reconnect');
      }),
    ).toBe('draft-review');
    const port = await button('Connect to Publish: in').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(port.x + port.width / 2, port.y + port.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(button('source:out → publish:in')).toBeVisible();

    await lock.selectOption('target');
    await expect(sourceHandle).toBeVisible();
    await expect(targetHandle).toHaveCount(0);
    await expect(source).toBeEnabled();
    await expect(target).toBeDisabled();
    await expect(target).toHaveAccessibleDescription(/Target reconnection is locked\./);
    await source.selectOption({ label: 'Review: out' });
    await expect(button('review:out → publish:in')).toBeVisible();
    await button('Undo').click();
    await expect(button('source:out → publish:in')).toBeVisible();
    await button('Undo').click();
    await button('source:out → review:in').click();

    await lock.selectOption('both');
    await expect(handles).toHaveCount(0);
    await expect(source).toBeDisabled();
    await expect(target).toBeDisabled();
    await button('Connect from Review: out').press('Enter');
    await button('Connect to Publish: in').press('Enter');
    await button('review:out → publish:in').click();
    await expect(surface.locator('[data-flow-reconnect]')).toHaveCount(2);
    await expect(source).toBeEnabled();
    await expect(target).toBeEnabled();
    expect(errors).toEqual([]);
    console.log(
      'Source and target locks matched the inspector and handles. Both edit paths, Undo and an unrestricted edge passed.',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
