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
    const surface = page.getByRole('region', { name: 'Workflow editor', exact: true });
    const actions = page
      .locator('[data-architecture-effect-ui="graph-actions"]')
      .getByRole('group', {
        name: 'Graph actions',
        exact: true,
      });
    const sections = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
    const section = (name) => sections.getByRole('button', { name, exact: true }).click();
    const world = surface.locator('.zloz-ui-world');
    const camera = () =>
      world.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(element.style.transform);
        return { x: matrix.e, y: matrix.f, zoom: matrix.a };
      });
    const include = actions.getByRole('checkbox', { name: 'Include camera', exact: true });
    const file = actions.getByLabel('Import JSON', { exact: true });
    const importJsonText = (text) =>
      file.setInputFiles({
        name: 'snapshot.json',
        mimeType: 'application/json',
        buffer: Buffer.from(text),
      });
    const importDocument = (data) => importJsonText(JSON.stringify(data));
    const exportDocument = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8'));
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await expect(include).not.toBeChecked();
    await expect(file).toHaveAccessibleDescription('Importing JSON replaces the current diagram.');
    const grid = actions.getByRole('spinbutton', { name: 'Grid spacing', exact: true });
    const originalGrid = await grid.inputValue();
    await grid.fill('23.5');
    await grid.press('Tab');
    await section('Diagnostics');
    await section('Diagram');
    await expect(grid).toHaveValue('23.5');
    await grid.fill(originalGrid);
    await grid.press('Tab');
    await surface.scrollIntoViewIfNeeded();
    const box = await surface.boundingBox();
    await page.mouse.move(box.x + 15, box.y + 15);
    await page.mouse.down();
    await page.mouse.move(box.x + 110, box.y + 65, { steps: 6 });
    await page.mouse.up();
    await page.mouse.wheel(0, -90);
    await expect.poll(async () => (await camera()).zoom).toBeGreaterThan(1.1);
    const savedCamera = await camera();
    expect(savedCamera.x).not.toBe(0);
    expect(savedCamera.y).not.toBe(0);

    await include.check();
    await section('Diagnostics');
    await section('Diagram');
    await expect(include).toBeChecked();
    const snapshot = await exportDocument();
    expect(snapshot.version).toBe(1);
    expect(snapshot.viewport.x).toBeCloseTo(savedCamera.x, 2);
    expect(snapshot.viewport.y).toBeCloseTo(savedCamera.y, 2);
    expect(snapshot.viewport.zoom).toBeCloseTo(savedCamera.zoom, 4);
    expect(Object.keys(snapshot).sort()).toEqual(['graph', 'version', 'viewport']);
    await button('Save').click();
    await expect(page.getByText('Saved on this browser.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(include).not.toBeChecked();
    await button('Load saved').click();
    await expect.poll(camera).toEqual(savedCamera);
    await expect(button('Select Draft')).toBeVisible();
    const screenshot = process.env.FLOW_SNAPSHOT_SCREENSHOT;
    if (screenshot) {
      await surface.scrollIntoViewIfNeeded();
      const canvasBox = await surface.boundingBox();
      const loadNotice = await page
        .getByText('JSON diagram imported.', { exact: true })
        .boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvasBox.x,
          y: canvasBox.y - 56,
          width: canvasBox.width,
          height: loadNotice.y + loadNotice.height - canvasBox.y + 61,
        },
      });
    }

    await section('Navigation');
    await button('Fit view').click();
    await expect.poll(camera).not.toEqual(savedCamera);
    await section('Diagram');
    const fit = await camera();
    await importDocument(snapshot);
    await expect.poll(camera).toEqual(savedCamera);

    await importDocument({ ...snapshot, viewport: { ...snapshot.viewport, zoom: 0 } });
    await expect(
      page.getByText('Could not import this JSON diagram. Your current diagram is preserved.', {
        exact: true,
      }),
    ).toBeVisible();
    expect(await camera()).toEqual(savedCamera);
    const graphOnly = await exportDocument();
    expect(graphOnly).toEqual({ version: 1, graph: snapshot.graph });
    await importJsonText('{ invalid JSON');
    await expect(
      page.getByText('Could not import this JSON diagram. Your current diagram is preserved.', {
        exact: true,
      }),
    ).toBeVisible();
    expect(await exportDocument()).toEqual(graphOnly);
    await importDocument(graphOnly);
    await expect.poll(camera).toEqual(fit);

    await importDocument({ ...snapshot, viewport: { x: 40, y: 60, zoom: 100 } });
    await expect.poll(camera).toEqual({ x: 40, y: 60, zoom: 4 });
    await page.evaluate(
      (json) => localStorage.setItem('opsydyn.foldkit-flow.release-sample.v1', json),
      JSON.stringify(graphOnly),
    );
    await button('Load saved').click();
    await expect.poll(camera).toEqual(fit);
    await surface.getByRole('button', { name: 'Select Draft', exact: true }).press('Enter');
    await button('Copy').press('Enter');
    await button('Paste').press('Enter');
    const pasted = await exportDocument();
    expect(pasted.graph.nodes).toHaveLength(graphOnly.graph.nodes.length + 1);
    await button('Undo').press('Enter');
    expect(await exportDocument()).toEqual(graphOnly);
    await section('Diagnostics');
    await button('Minimal mode').press('Enter');
    await section('Diagram');
    await expect(actions.getByRole('button')).toHaveText(['Undo', 'Redo']);
    await expect(include).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      engine +
        ': native graph actions restore JSON and saved diagrams, reject invalid files and preserve camera options',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
