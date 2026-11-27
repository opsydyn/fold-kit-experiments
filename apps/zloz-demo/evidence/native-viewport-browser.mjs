import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, firefox, webkit, expect } = require('@playwright/test');
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  const path = resolve(root, '.' + (route === '/' ? '/index.html' : route));
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  await readFile(path).then(
    (body) => {
      response.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
      );
      response.end(body);
    },
    () => response.writeHead(404).end(),
  );
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const engine = process.env.ZLOZ_BROWSER ?? 'chromium';
async function qualify() {
  const browser = await { chromium, firefox, webkit }[engine].launch();
  await (async () => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto('http://127.0.0.1:' + server.address().port);
    const sections = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
    const section = (name) => sections.getByRole('button', { name, exact: true }).click();
    const button = (name) => page.getByRole('button', { name, exact: true });
    const graph = async () => {
      await section('Diagram');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
    };
    const surface = page.locator('[data-flow-surface]');
    const viewport = () =>
      surface.evaluate(
        (canvas) =>
          [...canvas.children].find((child) => child.style.transform.startsWith('translate(')).style
            .transform,
      );
    const original = await graph();
    await button('Add node').click();
    const edited = await graph();
    expect(edited.nodes).toHaveLength(original.nodes.length + 1);

    await section('Navigation');
    const toolbar = page.locator('[data-architecture-effect-ui="viewport"]');
    await expect(toolbar.getByRole('button', { name: 'Fit view' })).toBeEnabled();
    for (const design of ['standard', 'compact']) {
      await page
        .getByRole('combobox', { name: 'Navigation design', exact: true })
        .selectOption(design);
      await expect(
        toolbar.locator(design === 'compact' ? '.compact-navigation' : '[role="group"]'),
      ).toBeVisible();
      const zoomIn = toolbar.getByRole('button', { name: 'Zoom in' });
      const fit = toolbar.getByRole('button', { name: 'Fit view', exact: true });
      const previous = toolbar.getByRole('button', { name: 'Back to previous view' });
      const area = toolbar.getByRole('button', { name: 'Zoom to area' });
      const box = toolbar.getByRole('button', { name: 'Box select' });

      await zoomIn.focus();
      const beforeZoom = await viewport();
      await zoomIn.press('Enter');
      await expect.poll(viewport).not.toBe(beforeZoom);
      await expect(zoomIn).toBeFocused();
      const beforeFit = await viewport();
      await fit.click();
      await expect.poll(viewport).not.toBe(beforeFit);
      await expect(previous).toBeEnabled();
      await previous.press('Space');
      await expect.poll(viewport).toBe(beforeFit);
      await expect(previous).toBeDisabled();

      await area.press('Enter');
      await expect(area).toHaveAttribute('aria-pressed', 'true');
      await area.press('Escape');
      await expect(area).toHaveAttribute('aria-pressed', 'false');
      await expect(area).toBeFocused();
      await box.press('Space');
      await expect(box).toHaveAttribute('aria-pressed', 'true');
      await box.press('Space');
      await expect(box).toHaveAttribute('aria-pressed', 'false');
    }
    const fitSelection = toolbar.getByRole('button', { name: 'Fit selection', exact: true });
    await expect(fitSelection).toBeDisabled();
    const draft = surface.getByRole('button', { name: 'Select Draft', exact: true });
    await draft.press('Enter');
    await expect(fitSelection).toBeEnabled();
    const beforeSelection = await viewport();
    await fitSelection.press('Enter');
    await expect.poll(viewport).not.toBe(beforeSelection);
    await expect
      .poll(async () => {
        const node = await surface.locator('[data-flow-node="source"]').boundingBox();
        const canvas = await surface.boundingBox();
        return Math.abs(node.x + node.width / 2 - canvas.x - canvas.width / 2);
      })
      .toBeLessThan(3);
    const settings = page.locator('[data-architecture-effect-ui="navigation-settings"]');
    const wheel = settings.getByRole('combobox', { name: 'Wheel navigation', exact: true });
    const selectionMatch = settings.getByRole('combobox', {
      name: 'Box selection match',
      exact: true,
    });
    await selectionMatch.selectOption('partial');
    await section('Diagram');
    await section('Navigation');
    await expect(selectionMatch).toHaveValue('partial');
    await selectionMatch.selectOption('full');
    await wheel.selectOption('pan');
    await expect(surface).toHaveAttribute('data-flow-wheel-navigation', 'pan');
    await wheel.selectOption('zoom');
    await expect(surface).toHaveAttribute('data-flow-wheel-navigation', 'zoom');
    for (const [label, attribute] of [
      ['Double-click zoom', 'data-flow-double-click-zoom'],
      ['Space-drag to pan', 'data-flow-space-to-pan'],
      ['Middle-drag to pan', 'data-flow-middle-button-pan'],
    ]) {
      const toggle = settings.getByRole('checkbox', { name: label, exact: true });
      await expect(toggle).toBeChecked();
      const enabled = await surface.getAttribute(attribute);
      await toggle.click();
      await expect(surface).not.toHaveAttribute(attribute, enabled);
      await expect(toggle).not.toBeChecked();
      await toggle.click();
      await expect(surface).toHaveAttribute(attribute, enabled);
      await expect(toggle).toBeChecked();
    }
    const overview = page.locator('[data-architecture-effect-ui="overview"]');
    const miniMap = page
      .locator('[data-architecture-effect-ui="overview-settings"]')
      .getByRole('checkbox', { name: 'Mini map', exact: true });
    await expect(overview).toBeVisible();
    await miniMap.click();
    await expect(overview).toHaveCount(0);
    await expect(miniMap).not.toBeChecked();
    await miniMap.click();
    await expect(overview).toBeVisible();
    await expect(miniMap).toBeChecked();
    const diagnostics = button('Open diagnostics');
    const screenshot = process.env.ZLOZ_VIEWPORT_SCREENSHOT;
    if (screenshot) await page.screenshot({ path: screenshot });
    await section('Diagnostics');
    await button('Minimal mode').click();
    await section('Navigation');
    await expect(miniMap).toBeDisabled();
    await expect(overview).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
    await expect(toolbar.locator('[data-flow-zoom-level]')).toHaveCount(0);
    await diagnostics.click();
    await expect(
      page.getByRole('region', { name: 'Diagnostics settings', exact: true }),
    ).toBeVisible();
    await button('Minimal mode').click();
    expect(await graph()).toEqual(edited);
    await button('Undo').click();
    expect(await graph()).toEqual(original);
    expect(errors).toEqual([]);
    console.log(
      engine +
        ': native viewport actions and settings, keyboard focus, graph identity and Undo passed',
    );
  })().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
