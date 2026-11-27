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
  const response = await page.goto(
    'http://127.0.0.1:' + server.address().port + '/qualification/architecture/',
  );
  expect(response?.status()).toBe(200);
  const button = (name) => page.getByRole('button', { name, exact: true });
  const sections = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
  const section = (name) => sections.getByRole('button', { name, exact: true }).click();
  const canvas = page.getByRole('region', { name: 'Workflow editor', exact: true });
  const snapshot = async () => {
    await section('Diagram');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export JSON').click(),
    ]);
    return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
  };
  await expect(canvas).toHaveClass(/zloz-ui-surface/);
  await section('Appearance');
  await page.getByRole('combobox', { name: 'Node toolbar', exact: true }).selectOption('standard');
  const initial = await snapshot();
  const draft = button('Select Draft');
  await draft.press('Enter');
  await expect(page.getByRole('group', { name: 'Actions for Draft', exact: true })).toBeVisible();
  await draft.press('ArrowRight');
  expect((await snapshot()).nodes[0].position.x).toBe(initial.nodes[0].position.x + 5);
  await button('Undo').click();
  expect(await snapshot()).toEqual(initial);

  const rename = page.getByRole('textbox', { name: 'Label for source', exact: true });
  await rename.fill('Revised Draft');
  await expect(button('Select Revised Draft')).toBeVisible();
  expect((await snapshot()).nodes[0].label).toBe('Revised Draft');
  await button('Undo').click();
  expect(await snapshot()).toEqual(initial);

  await button('More actions for Draft').click();
  const panel = canvas.locator('[data-flow-context-panel]');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await draft.press('Enter');
  const actions = page.getByRole('group', { name: 'Actions for Draft', exact: true });
  await actions.getByRole('button', { name: 'Duplicate node', exact: true }).click();
  expect((await snapshot()).nodes).toHaveLength(initial.nodes.length + 1);
  await button('Undo').click();
  expect(await snapshot()).toEqual(initial);

  const background = page.getByRole('combobox', { name: 'Background style', exact: true });
  await background.selectOption('squares');
  await expect(canvas.locator('[data-flow-background="squares"]')).toHaveCSS(
    'pointer-events',
    'none',
  );
  await background.selectOption('custom');
  await expect(canvas.locator('[data-custom-flow-grid="graph-paper"]')).toHaveCount(1);
  await background.selectOption('none');
  await expect(canvas.locator('[data-flow-background]')).toHaveCount(0);
  await background.selectOption('dots');
  const snap = button('Snap to nodes');
  if ((await snap.getAttribute('aria-pressed')) !== 'true') await snap.click();
  const reviewHandle = canvas.locator('[data-flow-handle="review"]');
  await canvas.scrollIntoViewIfNeeded();
  await reviewHandle.scrollIntoViewIfNeeded();
  await expect(reviewHandle).toBeVisible();
  const point = await reviewHandle.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(canvas).toHaveAttribute('data-flow-gesture', 'node-drag');
  await page.mouse.move(point.x, point.y - 77, { steps: 6 });
  await expect(canvas.locator('[data-flow-alignment-guide="y"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(canvas.locator('[data-flow-alignment-guide]')).toHaveCount(0);
  expect(await snapshot()).toEqual(initial);

  await section('Ports');
  await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Lock Draft output', exact: true }).check();
  const draftOutput = button('Connect from Draft: out');
  await expect(draftOutput).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Lock Draft output', exact: true }).uncheck();
  await expect(draftOutput).toBeEnabled();

  await button('Connect from Draft: out').press('Enter');
  await button('Connect to Publish: in').press('Enter');
  expect((await snapshot()).edges).toHaveLength(initial.edges.length + 1);
  await button('Undo').click();
  expect(await snapshot()).toEqual(initial);

  await section('Appearance');
  await page.getByRole('combobox', { name: 'Node design', exact: true }).selectOption('orbits');
  await expect(canvas.locator('[data-orbit-body="source"] circle').first()).toBeVisible();
  await expect(button('Select Draft')).toBeVisible();
  if (process.env.ZLOZ_ARCHITECTURE_SCREENSHOT)
    await canvas.screenshot({ path: process.env.ZLOZ_ARCHITECTURE_SCREENSHOT });
  expect(errors).toEqual([]);
  console.log(
    engine + ': native Architecture canvas shares the working model, actions, export and Undo',
  );
}
await qualify().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
