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
      Number((await page.locator('[data-flow-zoom-level]').textContent()).replace('%', '')) / 100;
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
    const keyboard = page.getByRole('checkbox', { name: 'Keyboard snap targets', exact: true });
    const restricted = page.getByRole('checkbox', { name: 'Restricted snap targets', exact: true });
    const overlap = page.getByRole('checkbox', {
      name: 'Overlapping port snap zones',
      exact: true,
    });
    const priority = page.getByRole('combobox', { name: 'Port snap priority', exact: true });
    const status = page.locator('[data-flow-status]');
    const focus = async () => {
      await inspector().scrollIntoViewIfNeeded();
      await handle().scrollIntoViewIfNeeded();
      await handle().focus();
    };
    const press = async (key, name) => {
      await page.keyboard.press(key);
      await expect(handle()).toBeFocused();
      await expect(status).toHaveText(
        target.label + ': ' + target.port + ' positioned at ' + name + '.',
      );
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await select('review', 'Review', 'in');
    await page.getByRole('checkbox', { name: 'Drag port anchors', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    const before = await center();
    await expect(keyboard).not.toBeChecked();
    await focus();
    await page.keyboard.press('Home');
    await expectCenter(before);
    await expect(handle()).not.toHaveAttribute('aria-keyshortcuts');
    await keyboard.check();
    await focus();
    await expect(handle()).toHaveAttribute('aria-keyshortcuts', 'PageDown PageUp Home End');
    await expect(handle()).toHaveAccessibleDescription(/Page Down\/Up cycle snap targets/);
    await page.keyboard.press('PageDown');
    await expect(status).toHaveText('No enabled corner or midpoint targets for Review: in.');
    await expectCenter(before);
    await expect(handle()).toBeFocused();
    await restricted.check();
    await focus();
    await press('Home', 'left midpoint');
    const left = await center();
    await press('PageDown', 'right midpoint');
    await page.keyboard.down('PageDown');
    await expect(status).toHaveText('Review: in positioned at left midpoint.');
    const afterRepeatStart = await center();
    await page.keyboard.down('PageDown');
    await expectCenter(afterRepeatStart);
    await page.keyboard.up('PageDown');
    await press('PageUp', 'right midpoint');
    await press('Home', 'left midpoint');
    await press('End', 'right midpoint');
    const right = await center();
    await button('Undo').click();
    await expectCenter(left);
    await button('Redo').click();
    await expectCenter(right);
    await select('review', 'Review', 'in');
    await focus();
    await page.keyboard.press('Tab');
    await expect(handle()).not.toBeFocused();
    await focus();
    await press('Home', 'left midpoint');
    const gapBefore = await gap('left');
    const width = await frame().evaluate((element) => element.clientWidth);
    const scale = await zoom();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => gap('left')).toBeCloseTo(gapBefore + width * scale * 0.01, 1);
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(() => gap('left')).toBeCloseTo(gapBefore + width * scale * 0.11, 1);
    await expect(handle()).toBeFocused();
    const beforeText = await center();
    const text = page.getByRole('textbox', { name: 'Label for review', exact: true });
    await text.focus();
    await page.keyboard.press('Home');
    await expect(text).toBeFocused();
    await expectCenter(beforeText);
    await overlap.check();
    await priority.selectOption('corners-first');
    await focus();
    await press('Home', 'top-left corner');
    await press('End', 'left midpoint');
    await priority.selectOption('midpoints-first');
    await focus();
    await press('Home', 'left midpoint');
    await press('End', 'top-left corner');
    const screenshot = process.env.FLOW_PORT_ANCHOR_KEYBOARD_SCREENSHOT;
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
    // Current per-port overrides are resolved again for each atomic action.
    await select('review', 'Review', 'out', 'from');
    await focus();
    await press('Home', 'top-right corner');
    await select('review', 'Review', 'in');
    const beforePointer = await center();
    await begin();
    await page.keyboard.press('PageDown');
    await expectCenter(beforePointer);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectCenter(beforePointer);
    await button('Minimal mode').click();
    await focus();
    await press('PageDown', 'left midpoint');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('[data-flow-anchor-guides]')).toHaveCount(0);
    await button('Minimal mode').click();
    const protectedBefore = await center();
    await button('Protect Review input').click();
    await expect(handle()).toBeDisabled();
    await expect(handle()).toHaveAccessibleDescription('Review input is managed upstream.');
    await expectCenter(protectedBefore);
    await button('Protect Review input').click();
    await overlap.uncheck();
    await restricted.uncheck();
    await page.getByRole('checkbox', { name: 'Per-port snapping rules', exact: true }).check();
    await select('source', 'Draft', 'out', 'from');
    await focus();
    const freeBefore = await center();
    await page.keyboard.press('PageDown');
    await expect(status).toHaveText('No enabled corner or midpoint targets for Draft: out.');
    await expectCenter(freeBefore);
    await expect(button('source:out → review:in')).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      'Keyboard target bundle covers opt-in Page Up/Down/Home/End, wrap, repeats, focus/Tab, exact arrows, text editing, priority/per-port rules, pointer guards, minimal-mode feedback, protection, empty sets and one-step Undo/Redo',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
