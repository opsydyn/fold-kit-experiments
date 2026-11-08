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

function cameraTransform(element) {
  const world = [...element.children].find((child) =>
    child.style.transform.startsWith('translate'),
  );
  return world.style.transform;
}

async function expectShellTheme(browser, system, saved, expected) {
  const page = await browser.newPage({ colorScheme: system });
  await page.route('**/*', (route) =>
    route.request().resourceType() === 'script' ? route.abort() : route.continue(),
  );
  if (saved !== null) {
    await page.addInitScript((preference) => {
      if (preference === 'blocked') {
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new DOMException('Storage is disabled', 'SecurityError');
          },
        });
        return;
      }
      localStorage.setItem('opsydyn.foldkit-flow.color-scheme.v1', preference);
    }, saved);
  }
  await page.goto('http://127.0.0.1:' + server.address().port);
  await expect(page.locator('[data-flow-surface]')).toHaveCount(0);
  await expect(page.locator('html')).toHaveCSS('color-scheme', expected);
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    expected === 'dark' ? 'rgb(16, 28, 25)' : 'rgb(248, 246, 241)',
  );
  await page.close();
}

async function qualify() {
  const browser = await chromium.launch();
  const run = async () => {
    await expectShellTheme(browser, 'dark', null, 'dark');
    await expectShellTheme(browser, 'light', 'dark', 'dark');
    await expectShellTheme(browser, 'dark', 'light', 'light');
    await expectShellTheme(browser, 'dark', 'blocked', 'dark');
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1100 },
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
    const surface = page.locator('[data-flow-surface]');
    const body = page.locator('body');
    const card = surface.locator('[data-flow-node="review"] > div');
    const nativeInput = card.locator('input').first();
    const selection = button('Select Review');
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return readFile(await download.path(), 'utf8');
    };
    const screenshot = async (mode) => {
      await surface.scrollIntoViewIfNeeded();
      const canvas = await surface.boundingBox();
      const control = await theme.boundingBox();
      await page.screenshot({
        path: `/tmp/foldkit-zloz-theme-${mode}.png`,
        clip: {
          x: canvas.x - 12,
          y: control.y - 12,
          width: canvas.width + 24,
          height: canvas.y + canvas.height - control.y + 34,
        },
      });
    };

    await page.goto('http://127.0.0.1:' + server.address().port);
    const graph = await exportGraph();
    await button('World annotation').click();
    await page.getByRole('combobox', { name: 'Node toolbar' }).selectOption('compact');
    await selection.press('Enter');
    await button('Fit view').click();
    await expect(page.getByText('146%', { exact: true })).toBeVisible();
    const camera = await surface.evaluate(cameraTransform);

    await expect(theme).toHaveValue('system');
    await expect(body).toHaveCSS('background-color', 'rgb(248, 246, 241)');
    await expect(surface).toHaveCSS('background-color', 'rgb(231, 238, 231)');
    await expect(card).toHaveCSS('background-color', 'rgb(253, 254, 251)');
    await expect(nativeInput).toHaveCSS('color-scheme', 'light');
    await screenshot('light');

    await theme.selectOption('dark');
    await expect(theme).toHaveValue('dark');
    await expect(body).toHaveCSS('background-color', 'rgb(16, 28, 25)');
    await expect(surface).toHaveCSS('background-color', 'rgb(20, 35, 32)');
    await expect(card).toHaveCSS('background-color', 'rgb(33, 52, 45)');
    await expect(card).toHaveCSS('color', 'rgb(229, 243, 235)');
    await expect(nativeInput).toHaveCSS('color-scheme', 'dark');
    await expect(selection).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Actions for Review' })).toBeVisible();
    await expect(button('Inspect Review')).toBeVisible();
    expect(await surface.evaluate(cameraTransform)).toBe(camera);
    await screenshot('dark');
    expect(await exportGraph()).toEqual(graph);

    await theme.selectOption('light');
    await expect(surface).toHaveCSS('background-color', 'rgb(231, 238, 231)');
    await expect(body).toHaveCSS('background-color', 'rgb(248, 246, 241)');
    await expect(nativeInput).toHaveCSS('color-scheme', 'light');
    expect(await surface.evaluate(cameraTransform)).toBe(camera);
    const fresh = await browser.newPage({ colorScheme: 'dark' });
    const freshTheme = fresh.getByRole('combobox', { name: 'Theme', exact: true });
    const freshSurface = fresh.locator('[data-flow-surface]');
    const url = 'http://127.0.0.1:' + server.address().port;
    await fresh.goto(url);
    await expect(freshTheme).toBeEnabled();
    await expect(freshSurface).toHaveCSS('color-scheme', 'dark');
    await freshTheme.selectOption('light');
    await expect(freshSurface).toHaveCSS('color-scheme', 'light');
    await expect(fresh.locator('body')).toHaveCSS('background-color', 'rgb(248, 246, 241)');
    await fresh.reload();
    await expect(freshTheme).toBeEnabled();
    await expect(freshSurface).toHaveCSS('color-scheme', 'light');

    await freshTheme.selectOption('dark');
    await expect(freshSurface).toHaveCSS('color-scheme', 'dark');
    await fresh.emulateMedia({ colorScheme: 'light' });
    await fresh.reload();
    await expect(freshTheme).toBeEnabled();
    await expect(freshSurface).toHaveCSS('color-scheme', 'dark');

    await expect(freshTheme).toHaveValue('dark');
    await freshTheme.selectOption('system');
    await expect(freshSurface).toHaveCSS('color-scheme', 'light');
    await fresh.emulateMedia({ colorScheme: 'dark' });
    await expect(freshSurface).toHaveCSS('color-scheme', 'dark');
    await freshTheme.selectOption('light');
    await fresh.emulateMedia({ colorScheme: 'light' });
    await fresh.emulateMedia({ colorScheme: 'dark' });
    await expect(freshSurface).toHaveCSS('color-scheme', 'light');
    await freshTheme.selectOption('system');
    await expect(freshSurface).toHaveCSS('color-scheme', 'dark');
    await fresh.reload();
    await expect(freshTheme).toBeEnabled();
    await expect(freshTheme).toHaveValue('system');
    await fresh.emulateMedia({ colorScheme: 'light' });
    await expect(freshSurface).toHaveCSS('color-scheme', 'light');

    const blocked = await browser.newPage({ colorScheme: 'dark' });
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Storage is disabled', 'SecurityError');
        },
      });
    });
    await blocked.goto(url);
    const blockedSurface = blocked.locator('[data-flow-surface]');
    await expect(blockedSurface).toHaveCSS('color-scheme', 'dark');
    await blocked.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
    await expect(blockedSurface).toHaveCSS('color-scheme', 'light');
    await expect(
      blocked.getByText('Theme changed for this visit. Your browser could not save it.'),
    ).toBeVisible();
    expect(errors).toEqual([]);
    console.log('First paint, live System mode, reload persistence and blocked storage passed.');
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
