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
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1500 },
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const world = surface.locator(':scope > div[style*="transform-origin"]');
    const camera = () =>
      world.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(element.style.transform);
        return { x: matrix.e, y: matrix.f, zoom: matrix.a };
      });
    const include = page.getByRole('checkbox', { name: 'Include camera' });
    const file = page.getByLabel('Import JSON', { exact: true });
    const importDocument = (data) =>
      file.setInputFiles({
        name: 'snapshot.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(data)),
      });
    const exportDocument = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8'));
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await expect(include).not.toBeChecked();
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
      const loadNotice = await page.getByText('Saved graph loaded.', { exact: true }).boundingBox();
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

    await button('Fit view').click();
    await expect.poll(camera).not.toEqual(savedCamera);
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
    await importDocument(graphOnly);
    await expect.poll(camera).toEqual(fit);

    await importDocument({ ...snapshot, viewport: { x: 40, y: 60, zoom: 100 } });
    await expect.poll(camera).toEqual({ x: 40, y: 60, zoom: 4 });
    await page.evaluate(
      (json) => localStorage.setItem('opsydyn.foldkit-flow.release-sample.v1', json),
      JSON.stringify(graphOnly),
    );
    await button('Load saved').click();
    await expect.poll(camera).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(errors).toEqual([]);
    console.log(
      'Snapshots restore camera through browser storage and JSON, preserve legacy behavior, and reject invalid cameras',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
