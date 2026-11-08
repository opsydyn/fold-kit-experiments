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
function readCamera(element) {
  const world = [...element.children].find((child) =>
    child.style.transform.startsWith('translate'),
  );
  const matrix = new DOMMatrix(getComputedStyle(world).transform);
  return { x: matrix.e, y: matrix.f, zoom: matrix.a };
}

function fitInsets(element) {
  const canvas = element.getBoundingClientRect();
  const left = canvas.left + element.clientLeft;
  const top = canvas.top + element.clientTop;
  const nodes = [...element.querySelectorAll('[data-flow-node]')].map((node) =>
    node.getBoundingClientRect(),
  );
  return [
    Math.min(...nodes.map((node) => node.left)) - left,
    left + element.clientWidth - Math.max(...nodes.map((node) => node.right)),
    Math.min(...nodes.map((node) => node.top)) - top,
    top + element.clientHeight - Math.max(...nodes.map((node) => node.bottom)),
  ];
}

async function qualify() {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const preset = page.getByRole('checkbox', { name: /^Constrain camera/ });
    const surface = page.locator('[data-flow-surface]');
    const camera = () => surface.evaluate(readCamera);
    const zoom = () => camera().then((current) => current.zoom);
    const touch = await page.context().newCDPSession(page);
    const pinch = async (from, to) => {
      await surface.scrollIntoViewIfNeeded();
      const box = await surface.boundingBox();
      const x = Math.round(box.x + box.width / 2);
      const y = Math.round(box.y + 30);
      const points = (distance) => [
        { x: x - distance, y, id: 1 },
        { x: x + distance, y, id: 2 },
      ];
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: points(from),
      });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(to) });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return readFile(await download.path(), 'utf8');
    };

    await page.goto('http://127.0.0.1:' + server.address().port);
    const initialGraph = await exportGraph();
    await button('Fit view').click();
    await expect.poll(zoom).toBeGreaterThan(1.3);
    await preset.check();
    await expect.poll(zoom).toBe(1.3);
    await expect(button('Zoom in')).toBeDisabled();

    await surface.scrollIntoViewIfNeeded();
    const box = await surface.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 30);
    await page.mouse.wheel(0, 600);
    await expect.poll(zoom).toBe(0.75);
    await expect(button('Zoom out')).toBeDisabled();
    await page.mouse.wheel(0, -600);
    await expect.poll(zoom).toBe(1.3);

    await pinch(120, 15);
    await expect.poll(zoom).toBe(0.75);
    await pinch(15, 120);
    await expect.poll(zoom).toBe(1.3);

    await button('Zoom out').click();
    await expect.poll(zoom).toBe(1.04);
    await button('Fit view').click();
    await expect.poll(zoom).toBeGreaterThan(1.04);
    const target = await camera();
    expect(target.zoom).toBeLessThan(1.3);
    const insets = await surface.evaluate(fitInsets);
    expect(Math.min(...insets)).toBeCloseTo(96, 0);

    await button('Zoom out').click();
    await expect.poll(zoom).toBeLessThan(target.zoom);
    await page.getByRole('checkbox', { name: 'Animate Fit view' }).check();
    await button('Fit view').click();
    await expect.poll(camera).toEqual(target);

    await surface.scrollIntoViewIfNeeded();
    const canvas = await surface.boundingBox();
    const toggle = await preset.boundingBox();
    await page.screenshot({
      path: '/tmp/foldkit-flow-viewport-constraints.png',
      clip: {
        x: canvas.x - 12,
        y: toggle.y - 12,
        width: canvas.width + 24,
        height: canvas.y + canvas.height - toggle.y + 34,
      },
    });
    await preset.uncheck();
    await expect(button('Zoom in')).toBeEnabled();
    await button('Fit view').click();
    await expect.poll(zoom).toBeGreaterThan(1.3);
    expect(await exportGraph()).toEqual(initialGraph);
    expect(errors).toEqual([]);
    console.log('Wheel, pinch, controls, and both fits shared the authored constraints.');
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
