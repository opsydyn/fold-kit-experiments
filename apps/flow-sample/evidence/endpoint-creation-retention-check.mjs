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
      viewport: { width: 1280, height: 1100 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto('http://127.0.0.1:' + server.address().port);
    const surface = page.locator('[data-flow-surface]');
    const group = page.getByRole('group', { name: 'Create a connection', exact: true });
    const source = group.getByRole('combobox', { name: 'New connection source', exact: true });
    const target = group.getByRole('combobox', { name: 'New connection target', exact: true });
    const pressed = surface.locator('[data-flow-port][aria-pressed="true"]');
    const toggle = page.getByRole('button', { name: 'Retain node views', exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await source.selectOption(JSON.stringify(['source', 'out']));
    await expect(pressed).toHaveCount(1);
    await expect(pressed).toHaveAttribute('data-flow-owner', 'source');
    await source.selectOption(JSON.stringify(['review', 'out']));
    await expect(pressed).toHaveCount(1);
    await expect(pressed).toHaveAttribute('data-flow-owner', 'review');
    const query = page.getByRole('searchbox', {
      name: 'Search new connection targets',
      exact: true,
    });
    await query.fill('publish');
    await expect(target.locator('option')).toHaveCount(2);
    await expect(query).toBeFocused();
    await expect(pressed).toHaveAttribute('data-flow-owner', 'review');
    await query.fill('');
    const lock = page.getByRole('checkbox', { name: 'Lock Publish input', exact: true });
    const publishPort = surface.locator('[data-flow-owner="publish"][data-flow-port="in"]');
    await lock.check();
    await expect(publishPort).toBeDisabled();
    await expect(publishPort).toHaveAttribute(
      'title',
      'Publish input is closed to new connections.',
    );
    await expect(pressed).toHaveCount(0);
    await expect(source).toHaveValue('');
    await source.selectOption(JSON.stringify(['review', 'out']));
    await expect(pressed).toHaveAttribute('data-flow-owner', 'review');
    await expect(publishPort).toBeDisabled();
    await lock.uncheck();
    await expect(publishPort).toBeEnabled();
    await expect(publishPort).not.toHaveAttribute(
      'title',
      'Publish input is closed to new connections.',
    );
    await expect(pressed).toHaveCount(0);
    await source.selectOption(JSON.stringify(['review', 'out']));
    await expect(pressed).toHaveAttribute('data-flow-owner', 'review');
    await group.getByRole('button', { name: 'Cancel choice', exact: true }).click();
    await expect(pressed).toHaveCount(0);
    await expect(source).toHaveValue('');
    await source.selectOption(JSON.stringify(['review', 'out']));
    await target.selectOption(JSON.stringify(['publish', 'in']));
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(2);
    await expect(pressed).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(1);
    await expect(pressed).toHaveCount(0);
    await surface.locator('[data-flow-owner="review"][data-flow-port="out"]').press('Enter');
    await expect(pressed).toHaveCount(1);
    await expect(pressed).toHaveAttribute('data-flow-owner', 'review');
    await expect(surface.locator('[data-flow-node]')).toHaveCount(3);
    await surface.screenshot({ path: '../flow-sample/evidence/endpoint-creation-retention.png' });
    expect(errors).toEqual([]);
    console.log(
      JSON.stringify(
        {
          browser: browser.version(),
          result: 'passed',
          checks: [
            'source switching',
            'native port aria-pressed',
            'filter focus and feedback',
            'policy fallback and restored eligibility',
            'cancellation',
            'creation',
            'Undo',
            'native keyboard restaging',
          ],
          screenshot: 'endpoint-creation-retention.png',
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
  };
  await execute().finally(() => browser.close());
}
await main().finally(() => new Promise((resolve) => server.close(resolve)));
