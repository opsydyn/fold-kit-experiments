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
    let target = { node: 'review', label: 'Review', port: 'in', direction: 'to' };
    const select = async (node, label, port, direction = 'to') => {
      target = { node, label, port, direction };
      await button('Select ' + label).click();
    };
    const inspector = () =>
      page.getByRole('group', { name: 'Ports for ' + target.label, exact: true });
    const handle = () => button('Position ' + target.label + ': ' + target.port);
    const socket = () =>
      button('Connect ' + target.direction + ' ' + target.label + ': ' + target.port);
    const bypassOption = page.getByRole('checkbox', {
      name: 'Alt bypasses port snapping',
      exact: true,
    });
    const snapping = page.getByRole('checkbox', {
      name: 'Snap port anchors to edges',
      exact: true,
    });
    const stability = page.getByRole('checkbox', {
      name: 'Stable port anchor snapping',
      exact: true,
    });
    const frame = () => surface.locator('[data-flow-node="' + target.node + '"]');
    const zoom = async () =>
      frame().evaluate((element) => element.getBoundingClientRect().width / element.offsetWidth);
    const center = async () => {
      const port = await socket().boundingBox();
      const canvas = await surface.boundingBox();
      return { x: port.x + port.width / 2 - canvas.x, y: port.y + port.height / 2 - canvas.y };
    };
    const expectCenter = async (expected) => {
      await expect
        .poll(async () => {
          const point = await center();
          return Math.hypot(point.x - expected.x, point.y - expected.y);
        })
        .toBeLessThan(0.1);
    };
    const gap = async (edge) => {
      const node = await frame().boundingBox();
      const port = await socket().boundingBox();
      const scale = await zoom();
      const border = await frame().evaluate((element) => ({
        x: element.clientLeft,
        y: element.clientTop,
      }));
      return edge === 'left'
        ? port.x + port.width / 2 - node.x - border.x * scale
        : port.y + port.height / 2 - node.y - border.y * scale;
    };
    const begin = async () => {
      await inspector().scrollIntoViewIfNeeded();
      await handle().scrollIntoViewIfNeeded();
      const box = await handle().boundingBox();
      const dimensions = await frame().evaluate((element) => ({
        width: element.clientWidth,
        height: element.clientHeight,
      }));
      const scale = await zoom();
      const base = { x: await gap('left'), y: await gap('top') };
      const origin = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(origin.x, origin.y);
      await page.mouse.down();
      return {
        halfX: (dimensions.width * scale) / 2,
        halfY: (dimensions.height * scale) / 2,
        move: async (x, y) =>
          page.mouse.move(origin.x + x - base.x, origin.y + y - base.y, { steps: 6 }),
      };
    };
    const guides = page.getByRole('checkbox', { name: 'Port snap guides', exact: true });
    const custom = page.getByRole('checkbox', { name: 'Custom snap guides', exact: true });
    const layer = page.locator('[data-flow-anchor-guides]');
    const targets = page.locator('[data-flow-anchor-guide]');
    const cancel = async () => {
      await page.keyboard.press('Escape');
      await page.mouse.up();
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await select('review', 'Review', 'in');
    await page.getByRole('checkbox', { name: 'Drag port anchors', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Restricted snap targets', exact: true }).check();
    await bypassOption.check();
    await expect(guides).not.toBeChecked();
    await expect(custom).not.toBeChecked();
    let grab = await begin();
    await grab.move(15, grab.halfY + 6);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await expect(layer).toHaveCount(0);
    await cancel();
    await guides.check();
    grab = await begin();
    await expect(targets).toHaveCount(2);
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    await expect(layer).toHaveAttribute('inert', '');
    await expect(targets.locator('.workbench-snap-guide')).toHaveCount(0);
    await grab.move(15, grab.halfY + 6);
    await expect(page.locator('[data-flow-anchor-guide-target="left"]')).toHaveAttribute(
      'data-flow-anchor-guide-active',
      'true',
    );
    await expect
      .poll(
        async () =>
          (await page.locator('[data-flow-anchor-guide-target="left"] circle').boundingBox()).width,
      )
      .toBeCloseTo(14, 1);
    const circle = await page
      .locator('[data-flow-anchor-guide-target="right"] circle')
      .boundingBox();
    expect(
      await page.evaluate(
        ({ x, y }) =>
          Boolean(document.elementFromPoint(x, y)?.closest('[data-flow-anchor-guides]')),
        { x: circle.x + circle.width / 2, y: circle.y + circle.height / 2 },
      ),
    ).toBe(false);
    await cancel();
    await custom.check();
    const before = await center();
    grab = await begin();
    await grab.move(15, grab.halfY + 6);
    await expect(targets.locator('.workbench-snap-guide')).toHaveCount(2);
    await expect(page.locator('[data-flow-anchor-guide-target="left"] circle')).toHaveAttribute(
      'stroke-width',
      '3',
    );
    await expect(targets).toHaveCount(2);
    const screenshot = process.env.FLOW_PORT_ANCHOR_GUIDES_SCREENSHOT;
    if (screenshot) {
      const panel = await inspector().boundingBox();
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
    await page.keyboard.down('Alt');
    await expect(layer).toHaveCount(0);
    await expect(handle()).toHaveAttribute('data-flow-anchor-bypassed', 'true');
    await page.keyboard.up('Alt');
    await expect(targets).toHaveCount(2);
    await grab.move(grab.halfX * 2 - 15, grab.halfY + 6);
    await expect(page.locator('[data-flow-anchor-guide-target="right"]')).toHaveAttribute(
      'data-flow-anchor-guide-active',
      'true',
    );
    await page.mouse.up();
    await expect(layer).toHaveCount(0);
    const saved = await center();
    await button('Undo').click();
    await expectCenter(before);
    await button('Redo').click();
    await expectCenter(saved);
    // Edge/corner guides use the same captured rules as a second port's snapping.
    await select('review', 'Review', 'out', 'from');
    grab = await begin();
    await expect(targets).toHaveCount(3);
    await expect(page.locator('[data-flow-anchor-guide="edge"]')).toHaveCount(1);
    await expect(page.locator('[data-flow-anchor-guide="corner"]')).toHaveCount(2);
    await grab.move(grab.halfX + 8, 6);
    await expect(page.locator('[data-flow-anchor-guide="edge"]')).toHaveAttribute(
      'data-flow-anchor-guide-active',
      'true',
    );
    await cancel();
    // Diagnostic presentation can hide guides without changing acquisition.
    await select('review', 'Review', 'in');
    await button('Diagnostics').click();
    const alignment = page.getByRole('checkbox', { name: 'Alignment guides', exact: true });
    const diagnostics = page.getByRole('checkbox', { name: 'Show diagnostics', exact: true });
    for (const flag of [alignment, diagnostics]) {
      await flag.uncheck();
      grab = await begin();
      await grab.move(15, grab.halfY + 6);
      await expect(layer).toHaveCount(0);
      await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
      await cancel();
      await flag.check();
    }
    await button('Minimal mode').click();
    grab = await begin();
    await grab.move(15, grab.halfY + 6);
    await expect(layer).toHaveCount(0);
    await expect(handle()).toHaveAttribute('data-flow-anchor-midpoint', 'left');
    await cancel();
    await button('Minimal mode').click();
    await button('Zoom out').click();
    await expect(page.locator('[data-flow-zoom-level]')).not.toHaveText('100%');
    const atZoom = await center();
    grab = await begin();
    await grab.move(15, grab.halfY + 6);
    await expect(targets).toHaveCount(2);
    await expect
      .poll(
        async () =>
          (await page.locator('[data-flow-anchor-guide-target="left"] circle').boundingBox()).width,
      )
      .toBeCloseTo(15, 1);
    await page.keyboard.down('Alt');
    await expect(layer).toHaveCount(0);
    await page.keyboard.up('Alt');
    await expect(targets).toHaveCount(2);
    await cancel();
    await expectCenter(atZoom);
    await expect(layer).toHaveCount(0);
    // Positive-radius targets are required even with the view opt-in enabled.
    await select('publish', 'Publish', 'in');
    grab = await begin();
    await expect(layer).toHaveCount(0);
    await cancel();
    await expect(button('source:out → review:in')).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      'Opt-in native/custom snap guides reflect captured permitted targets, active feedback and constant screen size; bypass, diagnostics, minimal mode, release and Escape hide them without changing Undo/Redo or hit testing',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
