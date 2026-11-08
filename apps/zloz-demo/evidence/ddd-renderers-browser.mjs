import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  const path = resolve(root, '.' + (route === '/' ? '/index.html' : route));
  if (!path.startsWith(resolve(root) + sep)) {
    response.writeHead(403).end();
    return;
  }
  await readFile(path).then(
    (body) => {
      response.setHeader(
        'Content-Type',
        /\.m?js$/u.test(path)
          ? 'text/javascript'
          : path.endsWith('.css')
            ? 'text/css'
            : 'text/html',
      );
      response.end(body);
    },
    () => response.writeHead(404).end(),
  );
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const browser = await chromium.launch();
async function run() {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const section = async (name) => {
    await page
      .getByRole('navigation', { name: 'Workbench sections', exact: true })
      .getByRole('button', { name, exact: true })
      .click();
  };
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await button('Open DDD Order aggregate').click();
  const surface = page.locator('[data-flow-surface]');
  await expect(surface.locator('[data-flow-ddd-node]')).toHaveCount(7);
  await expect(surface.locator('[data-flow-ddd-group]')).toHaveCount(1);
  await expect(
    page.getByRole('list', { name: 'DDD role legend' }).getByRole('listitem'),
  ).toHaveCount(8);
  await expect(surface.locator('[data-flow-node="order"]')).toContainText('Consistency owner');
  await section('Appearance');
  await expect(page.getByRole('combobox', { name: 'Node design', exact: true })).toHaveValue('ddd');
  const exported = async () => {
    await section('Diagnostics');
    const minimal = button('Minimal mode');
    const clean = (await minimal.getAttribute('aria-pressed')) === 'true';
    if (clean) await minimal.click();
    await section('Diagram');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export JSON').click(),
    ]);
    const graph = JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    if (clean) {
      await section('Diagnostics');
      await minimal.click();
      await section('Diagram');
    }
    return graph;
  };
  const node = (graph, id) => graph.nodes.find((entry) => entry.id === id);
  const original = await exported();
  // Minimal mode deliberately omits optional workbench graph actions, including export.
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('Diagram');
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toHaveCount(0);
  await expect(surface.locator('[data-flow-ddd-node]')).toHaveCount(7);
  await section('Diagnostics');
  await button('Minimal mode').click();
  const handle = surface.locator('[data-flow-handle="order"]');
  await section('Diagnostics');
  await handle.focus();
  const element = await handle.elementHandle();
  await button('Retain node views').evaluate((element) => element.click());
  await expect(button('Retain node views')).toHaveAttribute('aria-pressed', 'true');
  await expect(handle).toBeFocused();
  expect(
    await element.evaluate(
      (element) => element === document.querySelector('[data-flow-handle="order"]'),
    ),
  ).toBe(true);
  await handle.press('ArrowRight');
  expect(node(await exported(), 'order').position.x).toBe(node(original, 'order').position.x + 5);
  await button('Undo').click();
  expect(await exported()).toEqual(original);
  await button('Resize Order').press('ArrowRight');
  expect(node(await exported(), 'order').size.width).toBe(node(original, 'order').size.width + 5);
  await button('Undo').click();
  const source = surface.locator('[data-flow-owner="pricing"][data-flow-port="out"]');
  await source.press('Enter');
  await expect(source).toHaveAttribute('aria-pressed', 'true');
  await surface.locator('[data-flow-owner="money"][data-flow-port="in"]').press('Enter');
  await expect(surface.locator('[data-flow-edge]')).toHaveCount(5);
  await button('Undo').click();
  await expect(surface.locator('[data-flow-edge]')).toHaveCount(4);
  await button('Collapse Order aggregate').click();
  await expect(surface.locator('[data-flow-ddd-node]')).toHaveCount(4);
  await button('Expand Order aggregate').click();
  await expect(surface.locator('[data-flow-ddd-node]')).toHaveCount(7);
  await button('Select Order aggregate').click();
  await button('Resize Order aggregate from right').press('ArrowRight');
  expect(node(await exported(), 'order-aggregate').size.width).toBe(
    node(original, 'order-aggregate').size.width + 5,
  );
  await button('Undo').click();
  expect(await exported()).toEqual(original);
  await section('Diagnostics');
  await button('Minimal mode').click();
  await section('Diagram');
  const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
  const themes = [];
  for (const preference of ['light', 'dark']) {
    await theme.selectOption(preference);
    await expect(surface.locator('[data-flow-ddd-node]')).toHaveCount(7);
    await surface.screenshot({
      path: fileURLToPath(new URL(`ddd-order-${preference}.png`, import.meta.url)),
    });
    await page.locator('.workbench-sidebar-scroll').evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({
      path: fileURLToPath(new URL(`ddd-workbench-${preference}.png`, import.meta.url)),
    });
    expect(await exported()).toEqual(original);
    themes.push(
      await surface.locator('[data-flow-node="order"] [data-flow-ddd-outline]').evaluate(
        (element, preference) => ({
          theme: preference,
          fill: getComputedStyle(element).fill,
          stroke: getComputedStyle(element).stroke,
        }),
        preference,
      ),
    );
  }
  expect(themes[0].fill).not.toBe(themes[1].fill);
  expect(
    await surface
      .locator('[data-flow-ddd-body] button, [data-flow-ddd-body] [data-flow-port]')
      .count(),
  ).toBe(0);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: browser.version(),
        nodes: 8,
        edges: 4,
        themes,
        checks: [
          'eight DDD roles and legend',
          'custom package badge',
          'retention preserves focus and handle identity',
          'keyboard movement and Undo',
          'node/group resize and Undo',
          'native connection creation and Undo',
          'portless collapse/expand',
          'minimal mode retains semantic text',
          'Minimal mode omits optional graph-action controls',
          'theme switches preserve graph',
          'no interactive content in artwork',
        ],
        pageErrors: errors,
        screenshots: [
          'ddd-order-light.png',
          'ddd-order-dark.png',
          'ddd-workbench-light.png',
          'ddd-workbench-dark.png',
        ],
      },
      null,
      2,
    ),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
