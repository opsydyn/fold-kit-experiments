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
    const navigation = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
    const section = (name) => navigation.getByRole('button', { name, exact: true }).click();
    const browse = page.locator('[data-architecture-effect-ui="diagram-search"]');
    const examples = page.locator('[data-architecture-effect-ui="examples"]');
    const policies = page.locator('[data-architecture-effect-ui="policies"]');
    const search = browse.getByRole('searchbox', { name: 'Find a node', exact: true });
    const surface = page.locator('[data-flow-surface]');
    const node = (id) => surface.locator('[data-flow-node="' + id + '"]');
    const centerOffset = async (id) => {
      const [canvas, frame] = await Promise.all([surface.boundingBox(), node(id).boundingBox()]);
      return Math.hypot(
        frame.x + frame.width / 2 - canvas.x - canvas.width / 2,
        frame.y + frame.height / 2 - canvas.y - canvas.height / 2,
      );
    };
    await page.goto('http://127.0.0.1:' + server.address().port);
    await button('Select Draft').click();
    await search.pressSequentially(' PuBLish ');
    await expect(search).toHaveValue(' PuBLish ');
    await expect(button('Reveal Publish (publish)')).toBeVisible();
    await search.press('Enter');
    await expect.poll(() => centerOffset('publish')).toBeLessThan(3);
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'true');

    await section('Policies');
    await policies.getByRole('checkbox', { name: 'Hide Review node' }).check();
    await section('Diagram');
    await expect(search).toHaveValue(' PuBLish ');
    await search.fill('review');
    await expect(page.getByText('No matching nodes', { exact: true })).toBeVisible();
    await expect(button('Reveal first match')).toBeDisabled();

    await examples
      .getByRole('button', { name: 'Open grouped Onion Architecture', exact: true })
      .press('Enter');
    await expect(search).toHaveValue('review');
    await button('Collapse Application core').click();
    await button('Collapse Release system').click();
    await expect(node('domain')).toHaveCount(0);
    await search.fill('DOMAIN');
    await button('Reveal Domain model (domain)').click();
    await expect(button('Collapse Release system')).toBeVisible();
    await expect(button('Collapse Application core')).toBeVisible();
    await expect.poll(() => centerOffset('domain')).toBeLessThan(3);
    const screenshot = process.env.FLOW_REVEAL_SCREENSHOT;
    if (screenshot) {
      await surface.scrollIntoViewIfNeeded();
      const canvas = await surface.boundingBox();
      const form = await page.getByRole('search', { name: 'Diagram nodes' }).boundingBox();
      await page.screenshot({
        path: screenshot,
        clip: {
          x: canvas.x,
          y: form.y - 4,
          width: canvas.width,
          height: canvas.y + canvas.height - form.y + 31,
        },
      });
    }
    await button('Collapse Application core').click();
    await button('Collapse Release system').click();
    const dependency = surface.locator('[data-flow-edge="application-domain"]');
    await expect(dependency).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Search scope' }).selectOption('connections');
    const edgeSearch = browse.getByRole('searchbox', { name: 'Find a connection', exact: true });
    await edgeSearch.fill('USES THE DOMAIN');
    await button(
      'Reveal connection Application uses the domain model (Application: out → Domain model: in)',
    ).click();
    await expect(dependency).toHaveCount(1);
    await expect(surface.locator('[data-flow-edge-stroke="application-domain"]')).toHaveAttribute(
      'stroke',
      /--flow-edge/,
    );
    await expect(button('Collapse Application core')).toBeVisible();
    await expect(button('Collapse Release system')).toBeVisible();
    await expect
      .poll(async () => {
        const [canvas, source, target] = await Promise.all([
          surface.boundingBox(),
          node('application').boundingBox(),
          node('domain').boundingBox(),
        ]);
        return Math.abs((source.x + target.x + target.width) / 2 - (canvas.x + canvas.width / 2));
      })
      .toBeLessThan(3);
    const edgeScreenshot = process.env.FLOW_EDGE_REVEAL_SCREENSHOT;
    if (edgeScreenshot) {
      await surface.scrollIntoViewIfNeeded();
      const canvas = await surface.boundingBox();
      const form = await page.getByRole('search', { name: 'Diagram connections' }).boundingBox();
      await page.screenshot({
        path: edgeScreenshot,
        clip: {
          x: canvas.x,
          y: form.y - 4,
          width: canvas.width,
          height: canvas.y + canvas.height - form.y + 27,
        },
      });
    }

    await button('Open release workflow').click();
    await button('Select Draft').click();
    await edgeSearch.fill('source:out');
    const draftReview = button('Reveal connection Draft: out → Review: in');
    await expect(draftReview).toBeVisible();
    await edgeSearch.press('Enter');
    await expect(page.locator('[data-flow-status]')).toHaveText(
      'Revealed connection draft-review.',
    );
    await expect(button('Select Draft')).toHaveAttribute('aria-pressed', 'true');
    const hideEdge = policies.getByRole('checkbox', { name: 'Hide Draft → Review edge' });
    await section('Policies');
    await hideEdge.check();
    await section('Diagram');
    await expect(edgeSearch).toHaveValue('source:out');
    await expect(page.getByText('No matching connections', { exact: true })).toBeVisible();
    await section('Policies');
    await hideEdge.uncheck();
    await section('Diagram');
    await expect(draftReview).toBeVisible();
    const hideReview = policies.getByRole('checkbox', { name: 'Hide Review node' });
    await section('Policies');
    await hideReview.check();
    await section('Diagram');
    await expect(page.getByText('No matching connections', { exact: true })).toBeVisible();
    await examples
      .getByRole('button', { name: 'Open large workflow (320 nodes)', exact: true })
      .press('Enter');
    await browse.getByRole('combobox', { name: 'Search scope', exact: true }).selectOption('nodes');
    await search.fill('lane');
    await expect(browse.getByRole('status')).toHaveText('Showing 8 of 320 matching nodes');
    await expect(browse.getByRole('button', { name: /^Reveal Lane / })).toHaveCount(8);
    await section('Diagnostics');
    await button('Minimal mode').press('Enter');
    await section('Diagram');
    await expect(examples.getByRole('group', { name: 'Examples', exact: true })).toHaveCount(0);
    await expect(search).toHaveValue('lane');
    expect(errors).toEqual([]);
    console.log(
      engine +
        ': native search preserves drafts and reveals visible nodes and connections across examples',
    );
  };
  await run().finally(() => browser.close());
}
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
