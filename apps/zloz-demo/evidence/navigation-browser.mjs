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
    const viewport = () =>
      page.locator('[data-flow-surface]').evaluate((surface) => {
        const world = [...surface.children].find((child) =>
          child.style.transform?.startsWith('translate('),
        );
        const values = world.style.transform.match(/-?[\d.]+/g).map(Number);
        return { x: values[0], y: values[1], zoom: values[2] };
      });
    await page.goto('http://127.0.0.1:' + server.address().port);
    for (const design of ['standard', 'compact']) {
      await choose('Navigation design', design);
      await expect(
        page.getByRole('combobox', { name: 'Navigation design', exact: true }),
      ).toHaveValue(design);
      const overview = button('Diagram overview');
      await expect(overview).toBeVisible();
      const original = await exportGraph();
      await button('Add node').click();
      const edited = await exportGraph();
      expect(edited.nodes).toHaveLength(original.nodes.length + 1);
      const originalZoom = (await viewport()).zoom;
      await button('Zoom in').click();
      await expect.poll(async () => (await viewport()).zoom).toBeGreaterThan(originalZoom);
      await button('Zoom out').click();
      await expect
        .poll(async () => Math.abs((await viewport()).zoom - originalZoom))
        .toBeLessThan(0.00001);
      const before = await viewport();
      await overview.focus();
      await overview.press('ArrowRight');
      await expect.poll(async () => (await viewport()).x).toBe(before.x - 20);
      await overview.press('Shift+ArrowDown');
      await expect.poll(async () => (await viewport()).y).toBe(before.y - 80);
      await overview.press('Home');
      await expect.poll(async () => (await viewport()).y).not.toBe(before.y - 80);
      const fittedZoom = (await viewport()).zoom;
      await button('Zoom in').click();
      await expect.poll(async () => (await viewport()).zoom).toBeGreaterThan(fittedZoom);
      const map = page.locator('[data-flow-minimap]');
      await map.scrollIntoViewIfNeeded();
      const geometry = await map.evaluate((element) => {
        const box = element.getBoundingClientRect(),
          view = element.viewBox.baseVal;
        return {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          x: view.x,
          y: view.y,
          w: view.width,
          h: view.height,
        };
      });
      const surface = await page
        .locator('[data-flow-surface]')
        .evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight }));
      const zoom = (await viewport()).zoom;
      const clickX = Math.round(geometry.left + geometry.width * 0.25),
        clickY = Math.round(geometry.top + geometry.height * 0.75);
      await page.mouse.click(clickX, clickY);
      await expect
        .poll(async () =>
          Math.abs(
            (await viewport()).x -
              (surface.width / 2 -
                (geometry.x + (geometry.w * (clickX - geometry.left)) / geometry.width) * zoom),
          ),
        )
        .toBeLessThan(0.05);
      await expect
        .poll(async () =>
          Math.abs(
            (await viewport()).y -
              (surface.height / 2 -
                (geometry.y + (geometry.h * (clickY - geometry.top)) / geometry.height) * zoom),
          ),
        )
        .toBeLessThan(0.05);
      const center = await map.evaluate((element) => ({
        x: element.viewBox.baseVal.x,
        y: element.viewBox.baseVal.y,
        w: element.viewBox.baseVal.width,
        h: element.viewBox.baseVal.height,
      }));
      await overview.focus();
      await overview.press('Enter');
      await expect
        .poll(async () =>
          Math.abs((await viewport()).x - (surface.width / 2 - (center.x + center.w / 2) * zoom)),
        )
        .toBeLessThan(0.05);
      expect(await exportGraph()).toEqual(edited);
      await button('Undo').click();
      expect(await exportGraph()).toEqual(original);
      await button('Fit view').click();
      await page
        .locator('#flow-demo')
        .screenshot({ path: '/tmp/foldkit-zloz-navigation-' + design + '.png' });
      await button('Minimal mode').click();
      await expect(map).toHaveCount(0);
      await expect(button('Zoom in')).toBeVisible();
      await page.reload();
      console.log(
        design +
          ': keyboard pan/fit/center, pointer mapping, minimal mode, unchanged graph/history passed',
      );
    }
    await choose('Navigation design', 'compact');
    await button('Open grouped Onion Architecture').click();
    await button('Select Application core').click();
    await button('Collapse Application core').click();
    await expect(page.locator('[data-flow-minimap] rect')).toHaveCount(5);
    await page
      .locator('#flow-demo')
      .screenshot({ path: '/tmp/foldkit-zloz-navigation-groups.png' });
    expect(errors).toEqual([]);
    console.log('Collapsed groups and zero browser runtime errors passed');
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
