import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname } from 'node:path';

// Browser tooling belongs to the web workspace; this probe adds no production dependency.
const { chromium, expect } = createRequire(new URL('../../web/package.json', import.meta.url))(
  '@playwright/test',
);

const root = new URL('../dist/', import.meta.url);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const file = new URL('.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''), root);
  if (!file.href.startsWith(root.href)) {
    response.writeHead(404).end();
    return;
  }
  await readFile(file)
    .then((body) => {
      response.setHeader(
        'Content-Type',
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.woff2': 'font/woff2',
        }[extname(file.pathname)] ?? 'application/octet-stream',
      );
      response.end(body);
    })
    .catch(() => response.writeHead(404).end());
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const browser = await chromium.launch();
const evidence = { result: 'failed', checks: [], screenshots: [], browserErrors: [] };
// oxlint-disable-next-line linteffect/no-try-catch -- Native browser/server probe owns cleanup in finally, outside the Effect runtime.
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => evidence.browserErrors.push(String(error)));
  const button = (name) => page.getByRole('button', { name, exact: true });
  const select = (name) => page.getByRole('combobox', { name, exact: true });
  const port = (node, kind) =>
    page.locator(`[data-flow-owner="${node}"][data-flow-port="${kind}"]`);
  const link = (description) => button(description);
  const drag = async (from, to, offset = 0) => {
    const a = await from.boundingBox(),
      b = await to.boundingBox();
    if (!a || !b) throw new Error('Missing port bounds');
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + offset, b.y + b.height / 2, { steps: 12 });
    await page.mouse.up();
  };
  await page.goto('http://127.0.0.1:' + server.address().port + '/connections/');
  await expect(select('Session')).toBeVisible();
  await expect(port('orders', 'out')).toBeVisible();
  await expect(port('orders', 'in')).toHaveAttribute('aria-label', 'Connect to Orders: Input');
  await port('orders', 'out').focus();
  await page.keyboard.press('Enter');
  await port('billing', 'in').focus();
  await page.keyboard.press('Space');
  await expect(link('orders:out → billing:in')).toBeVisible();
  await button('Undo').click();
  await expect(link('orders:out → billing:in')).toHaveCount(0);
  await button('Redo').click();
  await expect(link('orders:out → billing:in')).toBeVisible();
  evidence.checks.push('native strict keyboard creation and one Undo/Redo');
  await select('Session').selectOption('loose');
  await expect(port('orders', 'in')).toHaveAttribute('aria-label', 'Connect from Orders: Input');
  await expect(link('orders:out → billing:in')).toHaveCount(0);
  await port('orders', 'in').focus();
  await page.keyboard.press('Space');
  await expect(port('billing', 'out')).toHaveAttribute('aria-label', 'Connect to Billing: Output');
  await port('billing', 'out').focus();
  await page.keyboard.press('Enter');
  await expect(link('orders:in → billing:out')).toBeVisible();
  await expect(port('orders', 'in')).toHaveAttribute('data-flow-port-kind', 'input');
  await expect(port('audit', 'in')).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Protect Audit input', exact: true }).uncheck();
  await expect(port('audit', 'in')).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Protect Audit input', exact: true }).check();
  await expect(port('audit', 'in')).toBeDisabled();
  evidence.checks.push(
    'native loose keyboard input-to-output creation, authored kinds, visible protection',
  );
  const capture = async (name) => {
    const path = new URL(name, import.meta.url);
    await page.screenshot({ path: path.pathname });
    evidence.screenshots.push(name);
  };
  await capture('connection-workbench-light.png');
  await button('Undo').click();
  await drag(port('orders', 'in'), port('billing', 'out'), 24);
  await expect(link('orders:in → billing:out')).toBeVisible();
  evidence.checks.push('native loose pointer drag starts at input and snaps near output');
  await link('orders:in → billing:out').click();
  await drag(
    page.locator('[data-flow-reconnect][data-flow-edge-end="target"]'),
    port('billing', 'in'),
  );
  await expect(link('orders:in → billing:in')).toBeVisible();
  await button('Undo').click();
  await expect(link('orders:in → billing:out')).toBeVisible();
  await link('orders:in → billing:out').click();
  await drag(
    page.locator('[data-flow-reconnect][data-flow-edge-end="source"]'),
    port('audit', 'out'),
  );
  await expect(link('audit:out → billing:out')).toBeVisible();
  await button('Undo').click();
  await expect(link('orders:in → billing:out')).toBeVisible();
  evidence.checks.push('native pointer reconnection of both ends and one Undo each');
  await link('orders:in → billing:out').click();
  await page
    .getByRole('combobox', { name: 'Source port', exact: true })
    .selectOption(JSON.stringify(['billing', 'in']));
  await expect(link('billing:in → billing:out')).toBeVisible();
  await button('Undo').click();
  await expect(link('orders:in → billing:out')).toBeVisible();
  evidence.checks.push('loose source chooser reconnection and one Undo');
  await select('Port design').selectOption('custom');
  await select('Theme').selectOption('dark');
  await expect(port('orders', 'in')).toHaveAttribute('data-custom-intent', 'source');
  await button('Undo').click();
  await port('billing', 'out').focus();
  await page.keyboard.press('Enter');
  await expect(port('orders', 'out')).toHaveAttribute('data-custom-intent', 'target');
  await port('orders', 'out').focus();
  await page.keyboard.press('Space');
  await expect(link('billing:out → orders:out')).toBeVisible();
  await capture('connection-workbench-dark.png');
  await page.getByRole('checkbox', { name: 'Read-only', exact: true }).check();
  await expect(port('orders', 'in')).toBeDisabled();
  await expect(button('Undo')).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Read-only', exact: true }).uncheck();
  await select('Session').selectOption('strict');
  await expect(link('orders:out → billing:in')).toBeVisible();
  await select('Session').selectOption('loose');
  await expect(link('billing:out → orders:out')).toBeVisible();
  evidence.checks.push(
    'custom loose keyboard creation, live source/target badges, read-only and independent session history',
  );
  const touch = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1100, height: 900 },
  });
  const touchPage = await touch.newPage();
  await touchPage.goto('http://127.0.0.1:' + server.address().port + '/connections/');
  await touchPage.getByRole('combobox', { name: 'Session', exact: true }).selectOption('loose');
  await touchPage.getByRole('button', { name: 'Connect from Orders: Input', exact: true }).tap();
  await touchPage.getByRole('button', { name: 'Connect to Billing: Output', exact: true }).tap();
  await expect(
    touchPage.getByRole('button', { name: 'orders:in → billing:out', exact: true }),
  ).toBeVisible();
  await touch.close();
  evidence.checks.push('Chromium touch tap source/target activation');
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await expect(page.locator('[data-flow-surface]').first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Connection workbench', exact: true }),
  ).toHaveAttribute('href', '/connections/');
  evidence.checks.push(
    'shared shell preserves the architecture workbench and provides connection navigation',
  );
  expect(evidence.browserErrors).toEqual([]);
  evidence.result = 'passed';
} finally {
  await writeFile(
    new URL('connection-workbench-browser.json', import.meta.url),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
