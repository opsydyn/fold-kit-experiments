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
const qualify = async () => {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const preview = page.locator('[data-flow-connection-preview]');
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const begin = async (locator) => {
      await page.locator('#flow-demo').scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    };
    const hover = async (locator, status) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
      await expect(preview).toHaveAttribute('data-flow-connection-state', status);
    };
    const cancel = async () => {
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(preview).toHaveCount(0);
    };
    const choose = async (name, value) =>
      page.getByRole('combobox', { name, exact: true }).selectOption(value);
    const reconnect = (end) =>
      page.locator('[data-flow-reconnect="draft-review"][data-flow-edge-end="' + end + '"]');
    for (const design of ['cards', 'orbits']) {
      await page.goto('http://127.0.0.1:' + server.address().port);
      await choose('Node design', design);
      if (design === 'orbits') await expect(page.locator('.orbit-node')).toHaveCount(3);
      await choose('Edge design', 'raised');
      await choose('Connection preview', 'ribbon');
      const initial = await exportGraph();
      const from = button('Connect from Review: out'),
        to = button('Connect to Publish: in');
      await begin(from);
      const box = await to.boundingBox();
      await page.mouse.move(box.x - 35, box.y - 30, { steps: 5 });
      await expect(preview).toHaveAttribute('data-flow-connection-state', 'free');
      await expect(preview.locator('path').first()).toHaveAttribute('d', /Q/);
      await hover(button('Connect from Draft: out'), 'invalid');
      await expect(page.locator('[data-flow-status]')).toContainText('Choose a compatible port');
      await hover(to, 'valid');
      const path = await preview.locator('path').first().getAttribute('d');
      await page
        .locator('#flow-demo')
        .screenshot({ path: '/tmp/foldkit-flow-connection-preview-' + design + '.png' });
      await page.mouse.up();
      await expect(preview).toHaveCount(0);
      let graph = await exportGraph();
      expect(graph.edges).toHaveLength(2);
      const created = graph.edges.find((edge) => edge.id !== 'draft-review');
      expect(created.source.node).toBe('review');
      expect(created.target.node).toBe('publish');
      await expect(page.locator('[data-flow-edge="' + created.id + '"]')).toHaveAttribute(
        'd',
        path,
      );
      await button('Undo').click();
      expect((await exportGraph()).edges).toEqual(initial.edges);
      await begin(from);
      await hover(to, 'valid');
      await cancel();
      expect((await exportGraph()).edges).toEqual(initial.edges);
      // A duplicate is a rejected compatible port, rather than a successful-looking drop.
      await begin(button('Connect from Draft: out'));
      await hover(button('Connect to Review: in'), 'invalid');
      await expect(page.locator('[data-flow-status]')).toContainText('already connected');
      await expect(preview.locator('path').first()).toHaveCSS('stroke', 'rgb(220, 38, 38)');
      if (design === 'cards')
        await page
          .locator('#flow-demo')
          .screenshot({ path: '/tmp/foldkit-flow-connection-preview-rejected.png' });
      await page.mouse.up();
      expect((await exportGraph()).edges).toEqual(initial.edges);
      await choose('Connection preview', 'hidden');
      await begin(from);
      await hover(to, 'valid');
      await expect(preview.locator('path')).toHaveCount(0);
      await page.mouse.up();
      expect((await exportGraph()).edges).toHaveLength(2);
      await button('Undo').click();
      await choose('Connection preview', 'dashed');
      await choose('Edge design', 'default');
      await begin(from);
      await hover(to, 'valid');
      await expect(preview.locator('path')).toHaveAttribute('stroke-dasharray', '6 4');
      await expect(preview.locator('path')).not.toHaveAttribute('d', /Q/);
      await cancel();
      await choose('Connection preview', 'ribbon');
      await choose('Edge design', 'raised');
      await expect(page.locator('[data-flow-edge="draft-review"]')).toHaveAttribute('d', /Q/);
      const original = await page.locator('[data-flow-edge="draft-review"]').getAttribute('d');
      for (const end of ['target', 'source']) {
        await button('source:out → review:in').click();
        await begin(reconnect(end));
        await hover(end === 'target' ? to : from, 'valid');
        const current = await preview.locator('path').first().getAttribute('d');
        if (end === 'source') {
          const points = await preview
            .locator('path')
            .first()
            .evaluate((path) => ({
              start: path.getPointAtLength(0).x,
              end: path.getPointAtLength(path.getTotalLength()).x,
            }));
          expect(points.start).toBeGreaterThan(points.end);
        }
        await page.mouse.up();
        graph = await exportGraph();
        const edge = graph.edges.find((edge) => edge.id === 'draft-review');
        expect(edge[end].node).toBe(end === 'target' ? 'publish' : 'review');
        await expect(page.locator('[data-flow-edge="draft-review"]')).toHaveAttribute('d', current);
        await button('Undo').click();
        expect((await exportGraph()).edges).toEqual(initial.edges);
        await expect(page.locator('[data-flow-edge="draft-review"]')).toHaveAttribute(
          'd',
          original,
        );
        await button('source:out → review:in').click();
        await begin(reconnect(end));
        await hover(end === 'target' ? to : from, 'valid');
        await cancel();
        expect((await exportGraph()).edges).toEqual(initial.edges);
      }
      // Model/world coordinates continue to agree with port targets after zoom.
      await button('Zoom in').click();
      await button('Zoom in').click();
      await begin(from);
      await hover(to, 'valid');
      const zoomed = await preview.locator('path').first().getAttribute('d');
      await page.mouse.up();
      graph = await exportGraph();
      const zoomedEdge = graph.edges.find((edge) => edge.id !== 'draft-review');
      await expect(page.locator('[data-flow-edge="' + zoomedEdge.id + '"]')).toHaveAttribute(
        'd',
        zoomed,
      );
      await button('Undo').click();
      console.log(
        design +
          ': free/invalid/valid previews, matching committed curves, hidden/default styles, both reconnection ends, cancellation, zoom and Undo passed',
      );
    }
    expect(errors).toEqual([]);
    console.log('No browser runtime errors');
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
