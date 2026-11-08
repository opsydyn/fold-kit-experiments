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
    const button = (name) => page.getByRole('button', { name, exact: true }).first();
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const node = (graph, id) => graph.nodes.find((entry) => entry.id === id);
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByRole('combobox', { name: 'Node design', exact: true }).selectOption('orbits');
    const surface = page.locator('[data-flow-surface]');
    await expect(surface.locator('.orbit-node')).toHaveCount(3);
    await expect
      .poll(async () => (await exportGraph()).nodes.every(({ size }) => size.width === size.height))
      .toBe(true);
    const initial = await exportGraph();
    const handle = button('Select Review');
    const originalHandle = await handle.elementHandle();
    const sameHandle = async () =>
      expect(
        await originalHandle.evaluate(
          (element) => element === document.querySelector('[data-flow-handle="review"]'),
        ),
      ).toBe(true);
    const toggle = button('Retain node views');
    await handle.focus();
    await toggle.evaluate((element) => element.click());
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(handle).toBeFocused();
    await sameHandle();
    expect(
      await surface
        .locator(
          '[data-orbit-body] button,[data-orbit-body] input,[data-orbit-body] [data-flow-port]',
        )
        .count(),
    ).toBe(0);
    const lock = page.getByRole('checkbox', { name: 'Lock Publish input', exact: true });
    const publish = surface.locator('[data-flow-owner="publish"][data-flow-port="in"]');
    await lock.evaluate((element) => element.click());
    await expect(publish).toBeDisabled();
    await expect(publish).toHaveAttribute('title', 'Publish input is closed to new connections.');
    await expect(handle).toBeFocused();
    await sameHandle();
    const reviewPort = surface.locator('[data-flow-owner="review"][data-flow-port="out"]');
    await reviewPort.press('Enter');
    await expect(reviewPort).toHaveAttribute('aria-pressed', 'true');
    const query = page.getByRole('searchbox', {
      name: 'Search new connection targets',
      exact: true,
    });
    await query.fill('publish');
    await expect(query).toBeFocused();
    await expect(reviewPort).toHaveAttribute('aria-pressed', 'true');
    await query.fill('');
    await handle.focus();
    await lock.evaluate((element) => element.click());
    await expect(publish).toBeEnabled();
    await expect(handle).toBeFocused();
    await sameHandle();
    await reviewPort.press('Enter');
    await publish.press('Enter');
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(2);
    await button('Undo').click();
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(1);
    await handle.press('ArrowRight');
    expect(node(await exportGraph(), 'review').position.x).toBe(
      node(initial, 'review').position.x + 5,
    );
    await expect(handle).toHaveAttribute('aria-pressed', 'true');
    await expect(
      surface.locator('[data-flow-node="review"] .orbit-node-body circle').first(),
    ).toHaveAttribute('stroke', '#f97316');
    await button('Undo').click();
    const beforeDrag = await exportGraph();
    await surface.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 18, box.y + box.height * 0.4 + 12, { steps: 4 });
    await page.mouse.up();
    expect(node(await exportGraph(), 'review').position).not.toEqual(
      node(beforeDrag, 'review').position,
    );
    await button('Undo').click();
    await button('Resize Review').press('ArrowRight');
    await expect
      .poll(async () => node(await exportGraph(), 'review').size.width)
      .toBe(node(initial, 'review').size.width + 5);
    await expect
      .poll(async () => node(await exportGraph(), 'review').size.height)
      .toBe(node(initial, 'review').size.width + 5);
    await button('Undo').click();
    await handle.focus();
    // Compare the live control before each cache transition, after the graph edits.
    const currentHandle = await handle.elementHandle();
    await toggle.evaluate((element) => element.click());
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(handle).toBeFocused();
    expect(
      await currentHandle.evaluate(
        (element) => element === document.querySelector('[data-flow-handle="review"]'),
      ),
    ).toBe(true);
    await toggle.evaluate((element) => element.click());
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(handle).toBeFocused();
    expect(
      await currentHandle.evaluate(
        (element) => element === document.querySelector('[data-flow-handle="review"]'),
      ),
    ).toBe(true);
    await lock.check();
    await reviewPort.press('Enter');
    await expect(reviewPort).toHaveAttribute('aria-pressed', 'true');
    await expect(publish).toBeDisabled();
    await surface.screenshot({ path: '../zloz-demo/evidence/orbit-body-cache.png' });
    await button('Open grouped Onion Architecture').click();
    await page.getByRole('combobox', { name: 'Node design', exact: true }).selectOption('orbits');
    await expect(surface.locator('.orbit-node')).toHaveCount(4);
    expect(await surface.locator('.orbit-group-body').count()).toBeGreaterThan(0);
    expect(await surface.locator('.orbit-group-body button').count()).toBe(0);
    await button('Collapse Application core').click();
    await expect(page.getByRole('button', { name: 'Select Application', exact: true })).toHaveCount(
      0,
    );
    await button('Expand Application core').click();
    await expect(button('Select Application')).toBeVisible();
    const grouped = await exportGraph();
    await button('Select Application core').click();
    await button('Resize Application core from bottom right').press('ArrowRight');
    expect(node(await exportGraph(), 'core').size.width).toBe(node(grouped, 'core').size.width + 5);
    await button('Undo').click();
    expect(node(await exportGraph(), 'core').size.width).toBe(node(grouped, 'core').size.width);
    expect(errors).toEqual([]);
    console.log(
      JSON.stringify(
        {
          result: 'passed',
          browser: browser.version(),
          checks: [
            'cache toggling preserves live handle identity/focus',
            'native port protections and source feedback',
            'filter focus',
            'creation and Undo',
            'keyboard selection and artwork highlight',
            'pointer drag and Undo',
            'circle resize/measurement and Undo',
            'group collapse/expand',
            'group resize and Undo',
            'no controls or sockets inside retained artwork',
          ],
          pageErrors: errors,
          screenshot: 'orbit-body-cache.png',
        },
        null,
        2,
      ),
    );
  };
  await execute().finally(() => browser.close());
}
await main().finally(() => new Promise((resolve) => server.close(resolve)));
