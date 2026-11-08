/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts, not structural placeholders. */
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
  const run = async () => {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1100 },
      reducedMotion: 'reduce',
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true }).first();
    const exported = async () => {
      const minimal = button('Minimal mode');
      const clean = (await minimal.getAttribute('aria-pressed')) === 'true';
      if (clean) {
        await minimal.click();
        await expect(minimal).toHaveAttribute('aria-pressed', 'false');
      }
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      const graph = JSON.parse(await readFile(await download.path(), 'utf8')).graph;
      if (clean) {
        await minimal.click();
        await expect(minimal).toHaveAttribute('aria-pressed', 'true');
      }
      return graph;
    };
    const node = (graph, id) => graph.nodes.find((entry) => entry.id === id);
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Open C4 system context').click();
    const surface = page.locator('[data-flow-surface]');
    await expect(surface.locator('[data-flow-c4-node]')).toHaveCount(4);
    await expect(page.getByRole('combobox', { name: 'Node design', exact: true })).toHaveValue(
      'c4',
    );
    const original = await exported();
    expect(node(original, 'orders').size.height).toBe(190);
    const handle = surface.locator('[data-flow-handle="orders"]');
    await handle.focus();
    const nativeHandle = await handle.elementHandle();
    const retention = button('Retain node views');
    await retention.evaluate((element) => element.click());
    await expect(retention).toHaveAttribute('aria-pressed', 'true');
    await expect(handle).toBeFocused();
    expect(
      await nativeHandle.evaluate(
        (element) => element === document.querySelector('[data-flow-handle="orders"]'),
      ),
    ).toBe(true);
    await handle.press('ArrowRight');
    expect(node(await exported(), 'orders').position.x).toBe(
      node(original, 'orders').position.x + 5,
    );
    await button('Undo').click();
    expect((await exported()).nodes).toEqual(original.nodes);
    await button('Resize Order platform').press('ArrowRight');
    expect(node(await exported(), 'orders').size.width).toBe(
      node(original, 'orders').size.width + 5,
    );
    await button('Undo').click();
    expect(node(await exported(), 'orders').size).toEqual(node(original, 'orders').size);
    const source = surface.locator('[data-flow-owner="customer"][data-flow-port="out"]');
    await source.press('Enter');
    await expect(source).toHaveAttribute('aria-pressed', 'true');
    await surface.locator('[data-flow-owner="identity"][data-flow-port="in"]').press('Enter');
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(4);
    await button('Undo').click();
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(3);
    const beforeDrag = await exported();
    await surface.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 16, { steps: 4 });
    await page.mouse.up();
    expect(node(await exported(), 'orders').position).not.toEqual(
      node(beforeDrag, 'orders').position,
    );
    await button('Undo').click();
    await button('Minimal mode').click();
    await expect(button('Minimal mode')).toHaveAttribute('aria-pressed', 'true');
    const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
    const themeEvidence = [];
    const documentBeforeTheme = await exported();
    for (const preference of ['light', 'dark']) {
      await theme.selectOption(preference);
      await surface.scrollIntoViewIfNeeded();
      await expect(surface.locator('[data-flow-c4-node]')).toHaveCount(4);
      await surface.screenshot({ path: `../flow-sample/evidence/c4-context-${preference}.png` });
      expect(await exported()).toEqual(documentBeforeTheme);
      themeEvidence.push(
        await surface.locator('[data-flow-node="orders"] [data-flow-c4-outline]').evaluate(
          (element, preference) => ({
            theme: preference,
            fill: getComputedStyle(element).fill,
            stroke: getComputedStyle(element).stroke,
          }),
          preference,
        ),
      );
    }
    expect(themeEvidence[0].fill).not.toBe(themeEvidence[1].fill);
    await button('Minimal mode').click();
    await expect(button('Minimal mode')).toHaveAttribute('aria-pressed', 'false');
    await button('Open C4 container view').click();
    await expect(surface.locator('[data-flow-c4-group]')).toHaveCount(1);
    await button('Minimal mode').click();
    await expect(button('Minimal mode')).toHaveAttribute('aria-pressed', 'true');
    await expect(surface.locator('[data-flow-c4-group]')).toHaveCount(1);
    await expect(surface.locator('[data-flow-c4-node]')).toHaveCount(4);
    await expect(surface.locator('[data-flow-c4-cap]')).toHaveCount(1);
    const detail = await exported();
    expect(node(detail, 'orders-db').appearance).toEqual({ shape: 'cylinder' });
    const curvedAnchor = await surface
      .locator('[data-flow-owner="orders-db"][data-flow-port="in"]')
      .evaluate((element) => ({
        left: parseFloat(element.style.left),
        top: parseFloat(element.style.top),
      }));
    expect(curvedAnchor.left).toBeCloseTo(25, 3);
    expect(curvedAnchor.top).toBeCloseTo((100 * 16 * (1 - Math.sqrt(0.75))) / 180, 3);
    for (const preference of ['light', 'dark']) {
      await theme.selectOption(preference);
      await surface.scrollIntoViewIfNeeded();
      await surface.screenshot({ path: `../flow-sample/evidence/c4-containers-${preference}.png` });
    }
    await button('Collapse Order platform').click();
    await expect(surface.locator('[data-flow-c4-node]')).toHaveCount(2);
    await button('Expand Order platform').click();
    await expect(surface.locator('[data-flow-c4-node]')).toHaveCount(4);
    await button('Select Order platform').click();
    await button('Resize Order platform from right').press('ArrowRight');
    expect(node(await exported(), 'platform-boundary').size).not.toEqual(
      node(detail, 'platform-boundary').size,
    );
    await button('Undo').click();
    await expect(surface.locator('[data-flow-c4-group]')).toHaveCount(1);
    expect(await exported()).toEqual(detail);
    expect(
      await surface
        .locator('[data-flow-c4-body] button,[data-flow-c4-body] [data-flow-port]')
        .count(),
    ).toBe(0);
    expect(errors).toEqual([]);
    console.log(
      JSON.stringify(
        {
          result: 'passed',
          browser: browser.version(),
          contextNodes: 4,
          contextEdges: 3,
          containerNodes: 5,
          themeEvidence,
          checks: [
            'package presets in both C4 views',
            'native handle focus/identity through retention',
            'keyboard movement and Undo',
            'width resize and Undo',
            'native connection creation and Undo',
            'pointer drag and Undo',
            'theme changes preserve document',
            'cylinder cap, curved anchor and portless C4 boundary',
            'collapse/expand retain authored graph',
            'group resize and Undo',
            'artwork contains no interactive controls',
          ],
          pageErrors: errors,
          screenshots: [
            'c4-context-light.png',
            'c4-context-dark.png',
            'c4-containers-light.png',
            'c4-containers-dark.png',
          ],
        },
        null,
        2,
      ),
    );
  };
  await run().finally(() => browser.close());
}
await main().finally(() => new Promise((resolve) => server.close(resolve)));
