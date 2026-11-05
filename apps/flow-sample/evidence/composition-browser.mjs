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
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const node = (graph, id) => graph.nodes.find((n) => n.id === id);
    for (const design of ['cards', 'orbits']) {
      await page.goto('http://127.0.0.1:' + server.address().port);
      await button('Open grouped Onion Architecture').click();
      await page.getByRole('combobox', { name: 'Node design', exact: true }).selectOption(design);
      if (design === 'orbits') await expect(page.locator('.orbit-node')).toHaveCount(4);
      const surface = page.locator('[data-flow-surface]');
      const initial = await exportGraph();
      if (design === 'orbits')
        expect(node(initial, 'ui').size.height).toBe(node(initial, 'ui').size.width);
      // Keyboard selection and movement use the same package input resource.
      await button('Select UI adapter').focus();
      await page.keyboard.press('ArrowRight');
      await expect(button('Select UI adapter')).toHaveAttribute('aria-pressed', 'true');
      let graph = await exportGraph();
      expect(node(graph, 'ui').position.x).toBe(node(initial, 'ui').position.x + 5);
      await button('Undo').click();
      // Drag commits once, and Undo restores membership and coordinates.
      await surface.scrollIntoViewIfNeeded();
      let box = await button('Select UI adapter').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 28, box.y + box.height / 2 + 12, { steps: 5 });
      await page.mouse.up();
      graph = await exportGraph();
      expect(node(graph, 'ui').position).not.toEqual(node(initial, 'ui').position);
      expect(node(graph, 'ui').parentId).toBe('system');
      await button('Undo').click();
      // Cancel a live drag without a history entry.
      await surface.scrollIntoViewIfNeeded();
      box = await button('Select UI adapter').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 8, { steps: 4 });
      await page.keyboard.press('Escape');
      await page.mouse.up();
      graph = await exportGraph();
      expect(node(graph, 'ui').position).toEqual(node(initial, 'ui').position);
      // Native port buttons support keyboard connection creation and Undo.
      await button('Connect from Storage adapter: out').focus();
      await page.keyboard.press('Enter');
      await button('Connect to Domain model: in').focus();
      await page.keyboard.press('Enter');
      graph = await exportGraph();
      expect(graph.edges).toHaveLength(initial.edges.length + 1);
      await button('Undo').click();
      // Node width handles retain keyboard resizing and live content measurement.
      await button('Resize UI adapter').focus();
      await page.keyboard.press('ArrowRight');
      await expect
        .poll(async () => node(await exportGraph(), 'ui').size.width)
        .toBe(node(initial, 'ui').size.width + 5);
      if (design === 'orbits')
        await expect
          .poll(async () => node(await exportGraph(), 'ui').size.height)
          .toBe(node(initial, 'ui').size.width + 5);
      await button('Undo').click();
      // Group keyboard resize, collapse/expand, descendant drag and Undo.
      await button('Select Application core').click();
      await button('Resize Application core from bottom right').focus();
      await page.keyboard.press('ArrowRight');
      graph = await exportGraph();
      expect(node(graph, 'core').size.width).toBe(node(initial, 'core').size.width + 5);
      await button('Undo').click();
      await button('Collapse Application core').click();
      await expect(button('Select Application')).toHaveCount(0);
      await button('Expand Application core').click();
      await expect(button('Select Application')).toBeVisible();
      await surface.scrollIntoViewIfNeeded();
      box = await button('Select Release system').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 16, box.y + box.height / 2 + 16, { steps: 4 });
      await page.mouse.up();
      graph = await exportGraph();
      expect(node(graph, 'system').position).not.toEqual(node(initial, 'system').position);
      expect(node(graph, 'ui').parentId).toBe('system');
      await button('Undo').click();
      await button('Select Application core').click();
      await button('Fit group to contents').click();
      await button('Select Release system').click();
      await button('Fit group to contents').click();
      await button('Fit view').click();
      await page
        .locator('#flow-demo')
        .screenshot({ path: '/tmp/foldkit-flow-composition-groups-' + design + '.png' });
      await page.reload();
      await page.getByRole('combobox', { name: 'Node design', exact: true }).selectOption(design);
      if (design === 'orbits') await expect(page.locator('.orbit-node')).toHaveCount(3);
      await button('Fit view').click();
      await page
        .locator('#flow-demo')
        .screenshot({ path: '/tmp/foldkit-flow-composition-' + design + '.png' });
      console.log(
        design +
          ': drag, selection, keyboard, connection, resize, measurement, cancellation, grouping and Undo passed',
      );
    }
    expect(errors).toEqual([]);
    console.log('No browser runtime errors');
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
