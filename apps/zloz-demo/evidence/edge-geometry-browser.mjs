import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { chromium, expect } from '@playwright/test';
const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  await readFile('../zloz-demo/dist' + path)
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
    const hit = () => page.locator('[data-flow-edge="draft-review"]');
    const screenPoint = async (fraction, straight = false) =>
      hit().evaluate(
        (path, args) => {
          const first = path.getPointAtLength(0),
            last = path.getPointAtLength(path.getTotalLength());
          const point = args.straight
            ? new DOMPoint((first.x + last.x) / 2, (first.y + last.y) / 2)
            : path.getPointAtLength(path.getTotalLength() * args.fraction);
          const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
          return { x: screen.x, y: screen.y };
        },
        { fraction, straight },
      );
    const selectCurve = async () => {
      await page.locator('[data-flow-surface]').scrollIntoViewIfNeeded();
      const point = await screenPoint(0.2);
      await page.mouse.click(point.x, point.y);
      await expect(
        page.getByRole('group', { name: 'Selected edge actions', exact: true }),
      ).toBeVisible();
    };
    const reconnect = async (cancel) => {
      await selectCurve();
      const endpoint = page.locator(
        '[data-flow-reconnect="draft-review"][data-flow-edge-end="target"]',
      );
      await page.locator('[data-flow-surface]').scrollIntoViewIfNeeded();
      const handle = await endpoint.boundingBox(),
        port = await button('Connect to Publish: in').boundingBox();
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
      await page.mouse.down();
      await page.mouse.move(port.x + port.width / 2, port.y + port.height / 2, { steps: 6 });
      if (cancel) await page.keyboard.press('Escape');
      await page.mouse.up();
    };
    for (const design of ['cards', 'orbits']) {
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.getByRole('combobox', { name: 'Node design', exact: true }).selectOption(design);
      if (design === 'orbits') await expect(page.locator('.orbit-node')).toHaveCount(3);
      const before = await exportGraph();
      await page.getByRole('combobox', { name: 'Edge design', exact: true }).selectOption('raised');
      await expect(hit()).toHaveAttribute('d', /Q/);
      expect(await exportGraph()).toEqual(before);
      const original = await hit().getAttribute('d');
      await expect(hit().locator('..').locator('g path').first()).toHaveAttribute('d', original);
      await page.locator('[data-flow-surface]').scrollIntoViewIfNeeded();
      const old = await screenPoint(0.5, true);
      await page.mouse.click(old.x, old.y);
      await expect(
        page.getByRole('group', { name: 'Selected edge actions', exact: true }),
      ).toHaveCount(0);
      await selectCurve();
      await button('Add label for source:out → review:in').click();
      await page
        .getByRole('textbox', { name: 'Edge label for source:out → review:in', exact: true })
        .fill('Custom curve');
      await button('Save label').click();
      const label = button('Edit edge label Custom curve for source:out → review:in');
      const source = before.nodes.find((n) => n.id === 'source'),
        target = before.nodes.find((n) => n.id === 'review');
      const sx = source.position.x + source.size.width,
        sy = source.position.y + source.size.height / 2,
        tx = target.position.x,
        ty = target.position.y + target.size.height / 2;
      const anchor = { x: (sx + tx) / 2, y: (sy + 2 * (Math.min(sy, ty) - 100) + ty) / 4 };
      await expect(label.locator('..')).toHaveCSS('left', anchor.x + 'px');
      await expect(label.locator('..')).toHaveCSS('top', anchor.y + 'px');
      await page.locator('[data-flow-surface]').click({ position: { x: 15, y: 415 } });
      await page
        .locator('#flow-demo')
        .screenshot({ path: '/tmp/foldkit-zloz-edge-geometry-' + design + '.png' });
      await button('Select Review').focus();
      await page.keyboard.press('ArrowDown');
      await expect(hit()).not.toHaveAttribute('d', original);
      await expect(label.locator('..')).toHaveCSS('top', anchor.y + 1.25 + 'px');
      await button('Undo').click();
      await expect(hit()).toHaveAttribute('d', original);
      await button('Undo').click();
      expect((await exportGraph()).edges[0].label).toBeUndefined();
      await selectCurve();
      await page
        .getByRole('combobox', { name: 'Selected edge path style', exact: true })
        .selectOption('straight');
      await expect(hit()).not.toHaveAttribute('d', /Q/);
      await button('Undo').click();
      await expect(hit()).toHaveAttribute('d', original);
      await reconnect(false);
      expect((await exportGraph()).edges[0].target.node).toBe('publish');
      await expect(hit()).not.toHaveAttribute('d', original);
      await button('Undo').click();
      await expect(hit()).toHaveAttribute('d', original);
      await reconnect(true);
      expect((await exportGraph()).edges[0].target.node).toBe('review');
      await expect(hit()).toHaveAttribute('d', original);
      await selectCurve();
      await page.locator('[data-flow-surface]').focus();
      await page.keyboard.press('Delete');
      expect((await exportGraph()).edges).toHaveLength(0);
      await button('Undo').click();
      await expect(hit()).toHaveAttribute('d', original);
      console.log(
        design +
          ': custom curve selection, label editing/anchor, movement, style fallback, reconnection/cancellation, deletion and Undo passed',
      );
    }
    await button('Open grouped Onion Architecture').click();
    await button('Collapse Application core').click();
    await expect(page.locator('[data-flow-group="core"]')).toHaveAttribute(
      'data-flow-collapsed',
      'true',
    );
    const projected = page.locator('[data-flow-edge="ui-application"]');
    await expect(projected).toHaveAttribute('d', /Q/);
    const end = await projected.evaluate((path) => {
      const p = path.getPointAtLength(path.getTotalLength());
      const screen = new DOMPoint(p.x, p.y).matrixTransform(path.getScreenCTM());
      return { x: screen.x, y: screen.y };
    });
    const group = await page.locator('[data-flow-group="core"]').boundingBox();
    expect(
      Math.min(
        Math.abs(end.x - group.x),
        Math.abs(end.x - group.x - group.width),
        Math.abs(end.y - group.y),
        Math.abs(end.y - group.y - group.height),
      ),
    ).toBeLessThan(2);
    await button('Expand Application core').click();
    await expect(projected).toHaveAttribute('d', /Q/);
    expect(errors).toEqual([]);
    console.log('Collapsed-group projection passed; no browser runtime errors');
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
