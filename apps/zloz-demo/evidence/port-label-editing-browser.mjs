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
  const path = resolve(root, '.' + (route.endsWith('/') ? route + 'index.html' : route));
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
const browser = await { chromium, firefox, webkit }[engine].launch();
async function qualify() {
  const run = async () => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1500 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const surface = page.locator('[data-flow-surface]');
    const inspector = page
      .locator('[data-architecture-effect-ui="port-inspector"]')
      .getByRole('group', { name: 'Ports for Review', exact: true });
    const section = (name) =>
      page
        .getByRole('navigation', { name: 'Workbench sections', exact: true })
        .getByRole('button', { name, exact: true })
        .click();
    const diagramAction = async (name) => {
      await section('Diagram');
      await button(name).click();
      await section('Inspect');
    };
    const labelInput = () =>
      page.getByRole('textbox', { name: 'Label for in port on Review', exact: true });
    const edit = () => button('Edit label for in port on Review');
    const connection = button('source:out → review:in');
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Review').click();
    await section('Ports');
    await page.getByRole('checkbox', { name: 'Port labels', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
    await section('Inspect');
    await expect(inspector).toBeVisible();
    await diagramAction('Protect required items');
    await edit().click();
    await expect(labelInput()).toBeFocused();
    await labelInput().pressSequentially('Approval required');
    await expect(labelInput()).toHaveValue('Approval required');
    await expect(button('Connect to Review: in')).toBeVisible();
    await expect(connection).toBeVisible();
    await labelInput().press('Enter');
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await expect(labelInput()).toHaveCount(0);
    await expect(connection).toBeVisible();
    await diagramAction('Undo');
    await expect(button('Connect to Review: in')).toBeVisible();
    await diagramAction('Redo');
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await button('Select Review').click();
    await edit().click();
    await labelInput().fill('Discard me');
    await labelInput().press('Escape');
    await expect(labelInput()).toHaveCount(0);
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await edit().click();
    await labelInput().fill('Also discarded');
    await button('Cancel port label').click();
    await expect(labelInput()).toHaveCount(0);
    await edit().click();
    await labelInput().fill('');
    await button('Save port label').click();
    await expect(button('Connect to Review: in')).toBeVisible();
    await expect(connection).toBeVisible();
    await diagramAction('Undo');
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await button('Select Review').click();
    await expect(button('Remove Approval required port from Review')).toBeDisabled();

    const screenshot = process.env.FLOW_PORT_LABEL_EDITING_SCREENSHOT;
    if (screenshot) {
      await edit().click();
      await inspector.scrollIntoViewIfNeeded();
      const panel = await inspector.boundingBox();
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
      await button('Cancel port label').click();
    }
    await edit().click();
    await labelInput().fill('Stale draft');
    await button('Add input port').click();
    await expect(labelInput()).toHaveCount(0);
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await expect(button('Connect to Review: Input 1')).toBeVisible();
    await edit().click();
    await labelInput().fill('Wrong node');
    await button('Select Draft').click();
    await expect(labelInput()).toHaveCount(0);
    await button('Select Review').click();
    await edit().click();
    await expect(labelInput()).toHaveValue('Approval required');
    await button('Cancel port label').click();
    await diagramAction('Protect required items');
    const remove = button('Remove Approval required port from Review');
    await expect(remove).toBeEnabled();
    await remove.click();
    await expect(button('Connect to Review: Approval required')).toHaveCount(0);
    await expect(connection).toHaveCount(0);
    await diagramAction('Undo');
    await expect(button('Connect to Review: Approval required')).toBeVisible();
    await expect(connection).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      engine +
        ': native port label focus, save, cancellation, clearing, removal with wiring and Undo/Redo passed',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
