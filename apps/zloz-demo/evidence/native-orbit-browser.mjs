import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, firefox, webkit, expect } = require('@playwright/test');
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  const path = resolve(root, '.' + (route.endsWith('/') ? route + 'index.html' : route));
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  await readFile(path).then(
    (body) => {
      response.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
      );
      response.end(body);
    },
    () => response.writeHead(404).end(),
  );
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const engine = process.env.ZLOZ_BROWSER ?? 'chromium';
const browser = await { chromium, firefox, webkit }[engine].launch();
async function qualify() {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const sections = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
  const section = (name) => sections.getByRole('button', { name, exact: true }).click();
  const button = (name) => page.getByRole('button', { name, exact: true });
  const graph = async () => {
    await section('Diagram');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export JSON').click(),
    ]);
    return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
  };
  await page.goto('http://127.0.0.1:' + server.address().port);
  await section('Appearance');
  const design = page.getByRole('combobox', { name: 'Node design', exact: true });
  await design.selectOption('orbits');
  const artwork = page.locator('[data-flow-node="source"] [data-orbit-body]');
  const draft = button('Select Draft');
  await expect(artwork.locator('circle').first()).toHaveAttribute('stroke', '#38bdf8');
  const initial = await graph();
  await section('Diagnostics');
  await draft.focus();
  const previous = await draft.elementHandle();
  await button('Retain node views').evaluate((element) => element.click());
  await expect(button('Retain node views')).toHaveAttribute('aria-pressed', 'true');
  await expect(draft).toBeFocused();
  expect(await draft.evaluate((element, before) => element === before, previous)).toBe(true);
  await draft.press('Enter');
  await expect(artwork.locator('circle').first()).toHaveAttribute('stroke', '#f97316');
  if (process.env.ZLOZ_ORBIT_SCREENSHOT)
    await page
      .locator('[data-flow-surface]')
      .screenshot({ path: process.env.ZLOZ_ORBIT_SCREENSHOT });
  await draft.press('ArrowRight');
  const moved = await graph();
  expect(moved.nodes.find(({ id }) => id === 'source').position.x).toBe(
    initial.nodes.find(({ id }) => id === 'source').position.x + 5,
  );
  await button('Undo').click();
  expect(await graph()).toEqual(initial);
  await section('Appearance');
  await design.selectOption('cards');
  await expect(artwork).toHaveCount(0);
  await section('Diagram');
  await button('Open grouped Onion Architecture').click();
  await section('Appearance');
  await design.selectOption('orbits');
  const group = page
    .locator('[data-flow-group]')
    .filter({ has: page.locator('[data-orbit-body]') })
    .first();
  await expect(group.locator('[data-orbit-body]')).toBeVisible();
  const groupId = await group.getAttribute('data-flow-group');
  const groupLabel = await group.locator('[data-orbit-body]').textContent();
  await expect(button('Select ' + groupLabel)).toBeVisible();
  await button('Collapse ' + groupLabel).click();
  await expect(page.locator('[data-flow-group="' + groupId + '"]')).toHaveAttribute(
    'data-flow-group-collapsed',
    'true',
  );
  await button('Expand ' + groupLabel).click();
  await expect(page.locator('[data-flow-group="' + groupId + '"]')).toHaveAttribute(
    'data-flow-group-collapsed',
    'false',
  );
  expect(errors).toEqual([]);
  console.log(
    engine +
      ': native Orbit artwork, retained focus, keyboard editing, exact Undo and group collapse passed',
  );
}
await qualify().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
