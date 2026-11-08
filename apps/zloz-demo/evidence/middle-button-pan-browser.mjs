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
    const marquee = surface.locator('[data-flow-selection-box]');
    const preference = page.getByRole('checkbox', { name: 'Middle-drag to pan' });
    const draft = button('Select Draft revised');
    const draftLabel = page.getByRole('textbox', { name: 'Label for source' });
    async function position() {
      const [canvas, node] = await Promise.all([
        surface.boundingBox(),
        surface.locator('[data-flow-node="source"]').boundingBox(),
      ]);
      return { x: node.x - canvas.x, y: node.y - canvas.y };
    }
    async function startDrag(mouseButton, dx, dy) {
      await surface.scrollIntoViewIfNeeded();
      const canvas = await surface.boundingBox();
      const start = { x: canvas.x + 850, y: canvas.y + 40 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down({ button: mouseButton });
      await page.mouse.move(start.x + dx, start.y + dy);
      return start;
    }

    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByRole('checkbox', { name: 'Space-drag to pan' }).uncheck();
    await button('Box select').click();
    await draftLabel.fill('Draft revised');
    await draft.press('Space');
    await expect(draft).toHaveAttribute('aria-pressed', 'true');
    const original = await position();

    await preference.uncheck();
    await expect(surface).toHaveAttribute('data-flow-middle-button-pan', 'false');
    await startDrag('middle', 100, 35);
    await page.mouse.up({ button: 'middle' });
    expect(await position()).toEqual(original);

    await preference.check();
    await expect(surface).toHaveAttribute('data-flow-middle-button-pan', 'true');
    await startDrag('middle', 100, 35);
    await expect(surface).toHaveCSS('cursor', 'grabbing');
    await expect(marquee).toHaveCount(0);
    await page.mouse.up({ button: 'middle' });
    const panned = { x: original.x + 100, y: original.y + 35 };
    await expect.poll(position).toEqual(panned);
    await expect(draft).toHaveAttribute('aria-pressed', 'true');
    await expect(button('Box select')).toHaveAttribute('aria-pressed', 'true');

    const screenshot = process.env.FLOW_MIDDLE_BUTTON_PAN_SCREENSHOT;
    if (screenshot) {
      const canvas = await surface.boundingBox();
      const help = await page.locator('[data-flow-help]').boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvas.x,
          y: help.y - 4,
          width: canvas.width,
          height: canvas.y + canvas.height - help.y + 4,
        },
      });
    }

    const zoomArea = button('Zoom to area');
    await zoomArea.click();
    await expect(zoomArea).toHaveAttribute('aria-pressed', 'true');
    const start = await startDrag('middle', 40, 15);
    await page.mouse.down({ button: 'left' });
    await page.mouse.up({ button: 'middle' });
    await expect(surface).toHaveCSS('cursor', 'crosshair');
    await page.mouse.move(start.x + 100, start.y + 30);
    await page.mouse.up({ button: 'left' });
    const afterChord = { x: panned.x + 40, y: panned.y + 15 };
    await expect.poll(position).toEqual(afterChord);
    await expect(zoomArea).toHaveAttribute('aria-pressed', 'true');
    await expect(draft).toHaveAttribute('aria-pressed', 'true');
    await zoomArea.click();
    await expect(zoomArea).toHaveAttribute('aria-pressed', 'false');

    await startDrag('left', 60, 20);
    await expect(marquee).toBeVisible();
    await page.mouse.up();
    await expect(draft).toHaveAttribute('aria-pressed', 'false');
    await button('Undo').click();
    await expect(draftLabel).toHaveValue('Draft');
    await expect.poll(position).toEqual(afterChord);
    expect(errors).toEqual([]);
    console.log(
      'Middle-drag preserves selection and canvas tools, releases during a mouse chord, and stays outside graph Undo',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
