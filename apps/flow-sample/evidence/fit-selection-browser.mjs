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
    const viewport = page.getByRole('group', { name: 'Viewport controls' });
    const fit = button('Fit selection');
    const draftReview = button('source:out → review:in');
    const publish = button('Select Publish');
    const centerOffset = async (ids) => {
      const canvas = await surface.boundingBox();
      const frames = await Promise.all(
        ids.map((id) => surface.locator('[data-flow-node="' + id + '"]').boundingBox()),
      );
      return Math.hypot(
        (Math.min(...frames.map(({ x }) => x)) +
          Math.max(...frames.map(({ x, width }) => x + width))) /
          2 -
          canvas.x -
          canvas.width / 2,
        (Math.min(...frames.map(({ y }) => y)) +
          Math.max(...frames.map(({ y, height }) => y + height))) /
          2 -
          canvas.y -
          canvas.height / 2,
      );
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await expect(fit).toBeDisabled();
    await draftReview.click();
    await expect(fit).toBeEnabled();
    await fit.click();
    await expect.poll(() => centerOffset(['source', 'review'])).toBeLessThan(3);
    await expect(draftReview).toHaveAttribute('aria-pressed', 'true');

    await button('Fit view').click();
    await publish.click({ modifiers: ['Shift'] });
    await expect(publish).toHaveAttribute('aria-pressed', 'true');
    await expect(draftReview).toHaveAttribute('aria-pressed', 'true');
    await button('Zoom out').click();
    await fit.click();
    await expect.poll(() => centerOffset(['source', 'review', 'publish'])).toBeLessThan(3);
    await expect(publish).toHaveAttribute('aria-pressed', 'true');
    await expect(draftReview).toHaveAttribute('aria-pressed', 'true');

    const screenshot = process.env.FLOW_FIT_SELECTION_SCREENSHOT;
    if (screenshot) {
      await surface.scrollIntoViewIfNeeded();
      const canvas = await surface.boundingBox();
      const controls = await viewport.boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvas.x,
          y: controls.y - 4,
          width: canvas.width,
          height: canvas.y + canvas.height - controls.y + 4,
        },
      });
    }

    await page.getByRole('combobox', { name: 'Navigation design' }).selectOption('compact');
    await expect(
      page.locator('.compact-navigation').getByRole('button', { name: 'Fit selection' }),
    ).toBeEnabled();
    await fit.press('Enter');
    await expect.poll(() => centerOffset(['source', 'review', 'publish'])).toBeLessThan(3);

    await button('Open grouped Onion Architecture').click();
    await expect(fit).toBeDisabled();
    await button('Collapse Application core').click();
    await button('UI uses application use cases').click();
    await fit.click();
    await expect(button('Expand Application core')).toBeVisible();
    await expect(button('UI uses application use cases')).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
    console.log(
      'Fit selection frames edge and mixed selections, works in compact controls, and keeps collapsed groups closed',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
