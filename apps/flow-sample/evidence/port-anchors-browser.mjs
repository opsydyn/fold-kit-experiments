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
    const page = await browser.newPage({ viewport: { width: 1280, height: 1700 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const choose = async (name, value) =>
      page.getByRole('combobox', { name, exact: true }).selectOption(value);
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const anchors = (graph) => graph.nodes.map((node) => node.ports);
    const alignment = async () =>
      page.locator('[data-flow-edge="draft-review"]').evaluate((path) => {
        const matrix = path.getScreenCTM(),
          length = path.getTotalLength();
        const source = path.getPointAtLength(0),
          target = path.getPointAtLength(length);
        const screen = (point) => new DOMPoint(point.x, point.y).matrixTransform(matrix);
        const center = (selector) => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        };
        const a = center('[data-flow-owner="source"][data-flow-port="out"]'),
          b = center('[data-flow-owner="review"][data-flow-port="in"]');
        return Math.max(
          Math.hypot(a.x - screen(source).x, a.y - screen(source).y),
          Math.hypot(b.x - screen(target).x, b.y - screen(target).y),
        );
      });
    const aligned = async () => expect.poll(alignment).toBeLessThan(1);
    const begin = async (locator) => {
      await page.locator('#flow-demo').scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    };
    const hover = async (locator) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
      await expect(page.locator('[data-flow-connection-preview]')).toHaveAttribute(
        'data-flow-connection-state',
        'valid',
      );
    };
    for (const design of ['cards', 'orbits']) {
      await page.goto('http://127.0.0.1:' + server.address().port);
      await choose('Node design', design);
      if (design === 'orbits') await expect(page.locator('.orbit-node')).toHaveCount(3);
      await choose('Edge design', 'raised');
      await choose('Connection preview', 'ribbon');
      const before = await exportGraph();
      await choose('Port anchors', 'diagonal');
      await expect(page.getByRole('combobox', { name: 'Port anchors', exact: true })).toHaveValue(
        'diagonal',
      );
      await aligned();
      let graph = await exportGraph();
      expect(
        graph.nodes.every((node) => node.ports.every((port) => port.anchor && !('offset' in port))),
      ).toBe(true);
      const authored = anchors(graph);
      await button('Undo').click();
      await expect(page.getByRole('combobox', { name: 'Port anchors', exact: true })).toHaveValue(
        'cardinal',
      );
      expect(anchors(await exportGraph())).toEqual(anchors(before));
      await button('Redo').click();
      await expect(page.getByRole('combobox', { name: 'Port anchors', exact: true })).toHaveValue(
        'diagonal',
      );
      await aligned();
      await page
        .locator('#flow-demo')
        .screenshot({ path: '/tmp/foldkit-flow-port-anchors-' + design + '.png' });
      // Position changes rescale with measured node height/width and track node movement.
      await button('Resize Draft').focus();
      await page.keyboard.press('ArrowRight');
      await aligned();
      graph = await exportGraph();
      expect(graph.nodes.find((node) => node.id === 'source').size.width).toBe(
        before.nodes.find((node) => node.id === 'source').size.width + 5,
      );
      await button('Undo').click();
      await aligned();
      await button('Select Draft').focus();
      await page.keyboard.press('ArrowRight');
      await aligned();
      await button('Undo').click();
      await aligned();
      // Preview and committed path use the same authored anchor positions.
      await begin(button('Connect from Review: out'));
      await hover(button('Connect to Publish: in'));
      const preview = await page
        .locator('[data-flow-connection-preview] path')
        .first()
        .getAttribute('d');
      if (design === 'orbits')
        await page
          .locator('#flow-demo')
          .screenshot({ path: '/tmp/foldkit-flow-port-anchor-preview.png' });
      await page.mouse.up();
      graph = await exportGraph();
      const created = graph.edges.find((edge) => edge.id !== 'draft-review');
      await expect(page.locator('[data-flow-edge="' + created.id + '"]')).toHaveAttribute(
        'd',
        preview,
      );
      await button('Undo').click();
      // Reconnection controls remain reachable outside the visual node box.
      await button('source:out → review:in').click();
      await begin(
        page.locator('[data-flow-reconnect="draft-review"][data-flow-edge-end="target"]'),
      );
      await hover(button('Connect to Publish: in'));
      await page.mouse.up();
      expect((await exportGraph()).edges[0].target.node).toBe('publish');
      await button('Undo').click();
      await aligned();
      for (const engine of ['Arrange with ELK', 'Force layout']) {
        const original = await exportGraph();
        await button(engine).click();
        await expect(page.getByText('Layout applied.', { exact: true })).toBeVisible();
        await aligned();
        graph = await exportGraph();
        expect(anchors(graph)).toEqual(authored);
        expect(graph.nodes.map((node) => node.position)).not.toEqual(
          original.nodes.map((node) => node.position),
        );
        await button('Undo').click();
        expect(anchors(await exportGraph())).toEqual(authored);
        await aligned();
      }
      console.log(
        design +
          ': subpixel port/path agreement, atomic preset Undo/Redo, resize, movement, preview creation, reconnection, ELK and force passed',
      );
    }
    expect(errors).toEqual([]);
    console.log('No browser runtime errors');
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
