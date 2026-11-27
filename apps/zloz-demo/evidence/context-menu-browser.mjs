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
async function qualify() {
  const browser = await { chromium, firefox, webkit }[engine].launch();
  await (async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const sections = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
    const section = (name) => sections.getByRole('button', { name, exact: true }).click();
    const button = (name) => page.getByRole('button', { name, exact: true });
    const exportGraph = async () => {
      await section('Diagram');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const surface = page.locator('[data-flow-surface]');
    const nodeMenu = page.getByRole('group', { name: 'Node context actions', exact: true });
    const edgeMenu = page.getByRole('group', { name: 'Edge context actions', exact: true });
    const design = page.getByRole('combobox', { name: 'Context menus', exact: true });
    const description = 'source:out → review:in';
    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await button('Select Draft').press('Shift+F10');
    await expect(nodeMenu.locator('[data-architecture-effect-ui="context-menu"]')).toBeVisible();
    await expect(nodeMenu.getByRole('button', { name: 'Duplicate node' })).toBeFocused();
    await expect(nodeMenu.getByRole('button', { name: 'Delete node' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(nodeMenu).toHaveCount(0);
    await expect(surface).toBeFocused();

    await section('Appearance');
    await design.selectOption('panel');
    await button('Select Draft').click({ button: 'right' });
    await expect(nodeMenu.locator('.custom-context-menu')).toBeVisible();
    await expect(nodeMenu.getByRole('button', { name: 'Duplicate node' })).toBeFocused();
    await expect(nodeMenu.getByRole('button', { name: 'Delete node' })).toHaveCount(0);

    await nodeMenu.getByRole('button', { name: 'Duplicate node' }).click();
    expect((await exportGraph()).nodes).toHaveLength(initial.nodes.length + 1);
    await button('Undo').click();
    expect(await exportGraph()).toEqual(initial);

    await section('Inspect');
    await button(description).press('Shift+F10');
    await expect(edgeMenu.getByRole('button', { name: 'Rename' })).toBeFocused();

    await edgeMenu.getByRole('button', { name: 'Rename' }).click();
    await expect(edgeMenu).toHaveCount(0);
    const label = page.getByRole('textbox', { name: 'Edge label for ' + description });
    await expect(label).toBeFocused();
    await label.press('Escape');
    await button('More actions for ' + description).click();
    await expect(edgeMenu).toBeVisible();
    await surface.click({ position: { x: 620, y: 25 } });
    await expect(edgeMenu).toHaveCount(0);

    await section('Diagram');
    await button('Open grouped Onion Architecture').click();
    const grouped = await exportGraph();
    await button('More actions for Application core').click();
    const width = nodeMenu.getByRole('spinbutton', { name: 'Width of Application core' });
    await expect(width).toBeFocused();
    const screenshot = process.env.ZLOZ_CONTEXT_SCREENSHOT;
    if (screenshot) await nodeMenu.screenshot({ path: screenshot });
    const oldWidth = grouped.nodes.find((node) => node.id === 'core').size.width;
    await width.fill(String(oldWidth + 40));
    // WebKit can skip buttons in its platform Tab order. Exercise a focus move
    // inside the menu so the number's change event is independent of that setting.
    await nodeMenu.getByRole('button', { name: 'Fit group to contents', exact: true }).focus();
    await expect(nodeMenu).toBeVisible();
    await expect(width).toHaveValue(String(oldWidth + 40));
    await nodeMenu.getByRole('button', { name: 'Close' }).click();
    await expect(nodeMenu).toHaveCount(0);
    await expect(surface).toBeFocused();
    expect((await exportGraph()).nodes.find((node) => node.id === 'core').size.width).toBe(
      oldWidth + 40,
    );
    await button('Undo').click();
    expect(await exportGraph()).toEqual(grouped);

    await button('More actions for Application core').click();
    await expect(width).toBeFocused();
    await sections.getByRole('button', { name: 'Navigation' }).focus();
    await expect(sections.getByRole('button', { name: 'Navigation' })).toBeFocused();
    await expect(nodeMenu).toHaveCount(0);
    await button('Collapse Application core').click();
    await button('More actions for Application core').click();
    await expect(width).toBeDisabled();
    await expect(nodeMenu.getByRole('button', { name: 'Fit group to contents' })).toBeFocused();
    await page.goto('http://127.0.0.1:' + server.address().port + '/history/');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    const nativeCanvas = page.getByRole('region', { name: 'Working history canvas' });
    await nativeCanvas
      .getByRole('button', { name: 'Select Orders', exact: true })
      .press('Shift+F10');
    const nativeMenu = nativeCanvas.getByRole('group', { name: 'Node context actions' });
    const duplicate = nativeMenu.getByRole('button', { name: 'Duplicate node', exact: true });
    await expect(duplicate).toBeFocused();
    await duplicate.press('Escape');
    await expect(nativeMenu).toHaveCount(0);
    await expect(nativeCanvas).toBeFocused();
    await nativeCanvas
      .getByRole('button', { name: 'Select Orders', exact: true })
      .click({ button: 'right' });
    await duplicate.click();
    await expect(nativeCanvas.locator('[data-flow-node]')).toHaveCount(3);
    await button('Restore / Undo').click();
    await button('Undo working edit').click();
    await expect(nativeCanvas.locator('[data-flow-node]')).toHaveCount(2);
    await button('Review / compare').click();
    await button('Review chosen edition').click();
    const review = page.getByRole('region', { name: 'Read-only edition preview' });
    await review.getByRole('button', { name: 'Select Orders', exact: true }).press('Shift+F10');
    await expect(review.getByRole('group', { name: 'Node context actions' })).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      engine +
        ': default and custom entry, Escape, outside click, focusout, node duplicate, edge rename, group sizing, and Undo passed',
    );
  })().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
