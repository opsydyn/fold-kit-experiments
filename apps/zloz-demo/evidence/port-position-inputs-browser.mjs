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
  const run = async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1500 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const inspector = page
      .locator('[data-architecture-effect-ui="port-inspector"]')
      .getByRole('group', { name: 'Ports for Review', exact: true });
    const section = (name) =>
      page
        .getByRole('navigation', { name: 'Workbench sections', exact: true })
        .getByRole('button', { name, exact: true })
        .click();
    const diagramAction = async (name) => {
      await section('Diagram');
      await button(name).click();
      await section('Inspect');
    };
    const reason = 'Review input is managed upstream.';
    const mode = () =>
      page.getByRole('combobox', { name: 'Position mode for in port on Review', exact: true });
    const side = () =>
      page.getByRole('combobox', { name: 'Side for in port on Review', exact: true });
    const field = (name) =>
      page.getByRole('spinbutton', { name: name + ' for in port on Review', exact: true });
    const edit = () => button('Edit position for in port on Review');
    const input = () => button('Connect to Review: in');
    const relativeCenter = async () => {
      const box = await input().boundingBox();
      const canvas = await surface.boundingBox();
      return { x: box.x + box.width / 2 - canvas.x, y: box.y + box.height / 2 - canvas.y };
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Review').click();
    await section('Ports');
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await section('Inspect');
    await expect(inspector).toBeVisible();
    const before = await relativeCenter();
    await edit().click();
    await expect(mode()).toHaveValue('offset');
    await expect(field('Offset')).toHaveValue('0.5');
    await field('Offset').fill('');
    await button('Save position').click();
    await expect(mode()).toBeVisible();
    expect(await field('Offset').evaluate((element) => element.validity.valueMissing)).toBe(true);
    await field('Offset').fill('1.5');
    await button('Save position').click();
    expect(await field('Offset').evaluate((element) => element.validity.rangeOverflow)).toBe(true);
    await expect.poll(relativeCenter).toEqual(before);
    await field('Offset').fill('0.25');
    await side().selectOption('bottom');
    await mode().selectOption('anchor');
    await expect(field('Anchor X')).toHaveValue('0.25');
    await expect(field('Anchor Y')).toHaveValue('1');
    await field('Anchor X').fill('0.55');
    await field('Anchor Y').fill('0');
    await side().selectOption('top');
    await expect.poll(relativeCenter).toEqual(before);
    await diagramAction('Protect Review input');
    await expect(field('Anchor X')).toBeDisabled();
    await expect(field('Anchor X')).toHaveValue('0.55');
    await expect(button('Save position')).toBeDisabled();
    await expect(button('Save position')).toHaveAccessibleDescription(reason);
    await expect(button('Cancel position')).toBeEnabled();
    await diagramAction('Protect Review input');
    await button('Save position').click();
    await expect(mode()).toHaveCount(0);
    await expect(button('source:out → review:in')).toBeVisible();
    const saved = await relativeCenter();
    expect(saved.x).toBeGreaterThan(before.x + 50);
    await diagramAction('Undo');
    await expect.poll(relativeCenter).toEqual(before);
    await diagramAction('Redo');
    await expect.poll(relativeCenter).toEqual(saved);
    await button('Select Review').click();
    await edit().click();
    await expect(mode()).toHaveValue('anchor');
    await expect(field('Anchor X')).toHaveValue('0.55');
    await expect(field('Anchor Y')).toHaveValue('0');
    const screenshot = process.env.FLOW_PORT_POSITION_SCREENSHOT;
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
    await mode().selectOption('offset');
    await expect(field('Offset')).toHaveValue('0.55');
    await button('Cancel position').press('Escape');
    await expect(mode()).toHaveCount(0);
    await expect.poll(relativeCenter).toEqual(saved);
    await edit().click();
    await field('Anchor X').fill('0.1');
    await button('Add input port').click();
    await expect(mode()).toHaveCount(0);
    await expect.poll(relativeCenter).toEqual(saved);
    expect(errors).toEqual([]);
    console.log(
      engine +
        ': native port positions retain validation, mode conversion, policy locks, wiring and Undo/Redo',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
