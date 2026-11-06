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
    const page = await browser.newPage({ viewport: { width: 1280, height: 1700 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Retain node views').click();
    const surface = page.locator('[data-flow-surface]');
    const input = page.getByRole('textbox', { name: 'Label for source', exact: true });
    await surface.scrollIntoViewIfNeeded();
    await input.focus();
    const original = await input.elementHandle();
    const box = await surface.boundingBox();
    await page.mouse.move(box.x + 15, box.y + 15);
    await page.mouse.wheel(0, -100);
    await expect
      .poll(() =>
        surface
          .locator(':scope > div[style*="transform-origin"]')
          .evaluate((el) => el.style.transform),
      )
      .not.toContain('scale(1)');
    await expect(input).toBeFocused();
    expect(await input.evaluate((node, previous) => node === previous, original)).toBe(true);
    await input.fill('Revised Draft');
    await expect(button('Select Revised Draft')).toBeVisible();
    await button('Select Revised Draft').click();
    await expect(button('Select Revised Draft')).toHaveAttribute('aria-pressed', 'true');

    const trigger = button('More actions for Revised Draft');
    await trigger.click();
    const panel = surface.locator('[data-flow-context-panel]');
    await expect(panel).toBeVisible();
    const menuBox = await panel.boundingBox();
    const triggerBox = await trigger.boundingBox();
    expect(Math.abs(menuBox.x - triggerBox.x)).toBeLessThan(24);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Lock Draft output' }).check();
    await expect(button('Connect from Revised Draft: out')).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Lock Draft output' }).uncheck();
    await expect(button('Connect from Revised Draft: out')).toBeEnabled();
    await surface.scrollIntoViewIfNeeded();
    const panBox = await surface.boundingBox();
    await page.mouse.move(panBox.x + 15, panBox.y + 15);
    await page.mouse.down();
    await expect(trigger).toBeDisabled();
    await page.mouse.move(panBox.x + 45, panBox.y + 15);
    await page.mouse.up();
    await expect(trigger).toBeEnabled();
    await button('Viewport culling').click();
    await button('Fit view').click();
    const publish = page.getByRole('textbox', { name: 'Label for publish', exact: true });
    await publish.fill('Published later');
    await expect(button('Select Published later')).toBeVisible();
    const previousPublish = await publish.elementHandle();
    const cullBox = await surface.boundingBox();
    await page.mouse.move(cullBox.x + 15, cullBox.y + 15);
    await page.mouse.wheel(0, -500);
    await expect
      .poll(() => publish.evaluate((node) => node.getBoundingClientRect().left))
      .toBeGreaterThan(cullBox.x + cullBox.width + 96);
    await expect(publish).toBeFocused();
    await surface.focus();
    await expect(publish).toHaveCount(0);
    await button('Fit view').click();
    await expect(publish).toHaveValue('Published later');
    expect(await publish.evaluate((node, previous) => node === previous, previousPublish)).toBe(
      false,
    );
    await expect(button('Connect to Published later: in')).toBeEnabled();
    expect(errors).toEqual([]);
    console.log(
      'Retained nodes preserve focus, edit, selection, live menu position, port policy and culling remounts',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
