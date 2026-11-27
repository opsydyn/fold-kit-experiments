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
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const response = await page.goto(
    'http://127.0.0.1:' + server.address().port + '/qualification/architecture/',
  );
  expect(response?.status()).toBe(200);
  const button = (name) => page.getByRole('button', { name, exact: true });
  const sections = page.getByRole('navigation', { name: 'Workbench sections', exact: true });
  const section = (name) => sections.getByRole('button', { name, exact: true }).click();
  const canvas = page.getByRole('region', { name: 'Workflow editor', exact: true });
  const snapshot = async () => {
    await section('Diagram');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button('Export JSON').click(),
    ]);
    return JSON.parse(await readFile(await download.path(), 'utf8')).graph;
  };
  await expect(canvas).toHaveClass(/zloz-ui-surface/);
  await section('Appearance');
  await page.getByRole('combobox', { name: 'Node toolbar', exact: true }).selectOption('standard');
  const initial = await snapshot();
  const draft = button('Select Draft');
  await draft.press('Enter');
  await expect(page.getByRole('group', { name: 'Actions for Draft', exact: true })).toBeVisible();
  await draft.press('ArrowRight');
  expect((await snapshot()).nodes[0].position.x).toBe(initial.nodes[0].position.x + 5);
  await button('Undo').click();
  expect(await snapshot()).toEqual(initial);

  const rename = page.getByRole('textbox', { name: 'Label for source', exact: true });
  await rename.fill('Revised Draft');
  await expect(button('Select Revised Draft')).toBeVisible();
  expect((await snapshot()).nodes[0].label).toBe('Revised Draft');
  await button('Undo').click();
  expect(await snapshot()).toEqual(initial);

  await button('More actions for Draft').click();
  const panel = canvas.locator('[data-flow-context-panel]');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await draft.press('Enter');
  const actions = page.getByRole('group', { name: 'Actions for Draft', exact: true });
  await actions.getByRole('button', { name: 'Duplicate node', exact: true }).click();
  expect((await snapshot()).nodes).toHaveLength(initial.nodes.length + 1);
  await button('Undo').click();
  expect(await snapshot()).toEqual(initial);

  const background = page.getByRole('combobox', { name: 'Background style', exact: true });
  await background.selectOption('squares');
  await expect(canvas.locator('[data-flow-background="squares"]')).toHaveCSS(
    'pointer-events',
    'none',
  );
  await background.selectOption('custom');
  await expect(canvas.locator('[data-custom-flow-grid="graph-paper"]')).toHaveCount(1);
  await background.selectOption('none');
  await expect(canvas.locator('[data-flow-background]')).toHaveCount(0);
  await background.selectOption('dots');
  const snap = button('Snap to nodes');
  if ((await snap.getAttribute('aria-pressed')) !== 'true') await snap.click();
  const reviewHandle = canvas.locator('[data-flow-handle="review"]');
  await canvas.scrollIntoViewIfNeeded();
  await reviewHandle.scrollIntoViewIfNeeded();
  await expect(reviewHandle).toBeVisible();
  const point = await reviewHandle.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(canvas).toHaveAttribute('data-flow-gesture', 'node-drag');
  await page.mouse.move(point.x, point.y - 77, { steps: 6 });
  await expect(canvas.locator('[data-flow-alignment-guide="y"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(canvas.locator('[data-flow-alignment-guide]')).toHaveCount(0);
  expect(await snapshot()).toEqual(initial);

  await section('Ports');
  await button('Select Review').press('Enter');
  const dragAnchors = page.getByRole('checkbox', { name: 'Drag port anchors', exact: true });
  await dragAnchors.check();
  await page.getByRole('checkbox', { name: 'Snap port anchors to midpoints', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Port snap guides', exact: true }).check();
  const customSnap = page.getByRole('checkbox', { name: 'Custom snap guides', exact: true });
  await customSnap.check();
  const anchor = button('Position Review: in');
  await anchor.scrollIntoViewIfNeeded();
  const anchorCenter = await anchor.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x: x + width / 2, y: y + height / 2 };
  });
  await page.mouse.move(anchorCenter.x, anchorCenter.y);
  await page.mouse.down();
  await page.mouse.move(anchorCenter.x + 4, anchorCenter.y + 18, { steps: 4 });
  const anchorGuides = canvas.locator('[data-flow-anchor-guides]');
  await expect(anchorGuides).toHaveAttribute('inert', '');
  expect(await anchorGuides.locator('.workbench-snap-guide').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(anchorGuides).toHaveCount(0);
  expect(await snapshot()).toEqual(initial);
  await section('Ports');
  await dragAnchors.uncheck();
  await page.getByRole('checkbox', { name: 'Custom port sockets', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Lock Draft output', exact: true }).check();
  const draftOutput = button('Connect from Draft: out');
  await expect(draftOutput).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Lock Draft output', exact: true }).uncheck();
  await expect(draftOutput).toBeEnabled();

  await button('Connect from Draft: out').press('Enter');
  await button('Connect to Publish: in').press('Enter');
  expect((await snapshot()).edges).toHaveLength(initial.edges.length + 1);
  await button('Undo').click();
  expect(await snapshot()).toEqual(initial);

  await section('Appearance');
  const waypointDesign = page.getByRole('combobox', { name: 'Waypoint controls', exact: true });
  await waypointDesign.selectOption('custom');
  const edge = canvas.locator('[data-flow-edge="draft-review"]');
  const selectEdge = async () => {
    if ((await edge.getAttribute('data-selected')) === 'true') return;
    await canvas.scrollIntoViewIfNeeded();
    const edgePoint = await edge.evaluate((path) => {
      const point = path.getPointAtLength(path.getTotalLength() * 0.2);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(edgePoint.x, edgePoint.y);
    await expect(edge).toHaveAttribute('data-selected', 'true');
  };
  await selectEdge();
  const routingStudio = canvas.getByRole('group', { name: 'Routing studio', exact: true });
  const addBend = routingStudio.getByRole('button', { name: 'Add bend', exact: true });
  await expect(addBend).toBeVisible();
  await addBend.click();
  const bend = routingStudio.getByRole('button', { name: 'Move bend 1', exact: true });
  await expect(bend).toHaveText('◆');
  const bends = (graph) => graph.edges.find(({ id }) => id === 'draft-review').waypoints;
  const added = await snapshot();
  expect(bends(added)).toHaveLength(1);
  const cancelLabelEdit = async (graph) => {
    await canvas.getByRole('button', { name: /^Add label for/ }).click();
    await expect(canvas.getByRole('button', { name: 'Save label', exact: true })).toBeVisible();
    await canvas.getByRole('textbox', { name: /^Edge label for/ }).press('Escape');
    expect(await snapshot()).toEqual(graph);
  };
  await cancelLabelEdit(added);
  await bend.press('ArrowRight');
  const moved = await snapshot();
  expect(bends(moved)).toEqual([
    {
      ...bends(added)[0],
      position: { ...bends(added)[0].position, x: bends(added)[0].position.x + 1 },
    },
  ]);
  await button('Undo').click();
  expect(await snapshot()).toEqual(added);

  await selectEdge();
  await bend.scrollIntoViewIfNeeded();
  const bendPoint = await bend.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  });
  await page.mouse.move(bendPoint.x, bendPoint.y);
  await page.mouse.down();
  await page.mouse.move(bendPoint.x + 30, bendPoint.y + 12, { steps: 5 });
  await expect(canvas).toHaveAttribute('data-flow-gesture', 'edge-waypoint-drag');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-flow-gesture', 'idle');
  expect(await snapshot()).toEqual(added);

  await section('Appearance');
  const protectBends = page.getByRole('checkbox', { name: 'Protect bend editing', exact: true });
  await protectBends.check();
  await selectEdge();
  await expect(bend).toBeDisabled();
  await expect(addBend).toBeDisabled();
  await expect(routingStudio.getByRole('button', { name: 'Remove bend 1' })).toBeDisabled();
  expect(await snapshot()).toEqual(added);
  await section('Appearance');
  await protectBends.uncheck();
  await selectEdge();
  await routingStudio.getByRole('button', { name: 'Remove bend 1' }).click();
  expect(await snapshot()).toEqual(initial);
  await button('Undo').click();
  expect(await snapshot()).toEqual(added);
  await button('Undo').click();
  expect(await snapshot()).toEqual(initial);
  await section('Appearance');
  await selectEdge();
  await waypointDesign.selectOption('off');
  await expect(canvas.getByRole('button', { name: 'Add bend', exact: true })).toHaveCount(0);
  await waypointDesign.selectOption('native');
  await canvas.getByRole('button', { name: 'Add bend', exact: true }).click();
  await cancelLabelEdit(added);
  await button('Undo').click();
  expect(await snapshot()).toEqual(initial);

  await section('Appearance');
  await page.getByRole('combobox', { name: 'Node design', exact: true }).selectOption('orbits');
  await expect(canvas.locator('[data-orbit-body="source"] circle').first()).toBeVisible();
  await expect(button('Select Draft')).toBeVisible();
  if (process.env.ZLOZ_ARCHITECTURE_SCREENSHOT)
    await canvas.screenshot({ path: process.env.ZLOZ_ARCHITECTURE_SCREENSHOT });
  await section('Diagram');
  await section('Diagnostics');
  await button('World annotation').click();
  const gate = canvas.getByRole('button', { name: 'Inspect Review', exact: true });
  await gate.click();
  const review = canvas.locator('[data-flow-node="review"]');
  await expect(button('Select Review')).toHaveAttribute('aria-pressed', 'true');
  await gate.press('Delete');
  const gatePosition = async () => {
    const [annotation, node] = await Promise.all([gate.boundingBox(), review.boundingBox()]);
    return {
      gap: node.y - annotation.y - annotation.height,
      center: annotation.x + annotation.width / 2 - node.x - node.width / 2,
      width: annotation.width,
    };
  };
  expect((await gatePosition()).gap).toBeCloseTo(14, 0);
  expect((await gatePosition()).center).toBeCloseTo(0, 0);
  await section('Navigation');
  const startWidth = (await gatePosition()).width;
  await button('Zoom in').click();
  await expect.poll(async () => (await gatePosition()).width).toBeGreaterThan(startWidth);
  expect((await gatePosition()).center).toBeCloseTo(0, 0);
  expect(await snapshot()).toEqual(initial);
  await section('Diagnostics');
  await button('World annotation').click();
  await expect(gate).toHaveCount(0);

  await section('Navigation');
  const area = button('Zoom to area');
  await area.click();
  await canvas.scrollIntoViewIfNeeded();
  const canvasBounds = await canvas.boundingBox();
  await page.mouse.move(canvasBounds.x + 70, canvasBounds.y + 320);
  await page.mouse.down();
  await page.mouse.move(canvasBounds.x + 400, canvasBounds.y + 530, { steps: 5 });
  const marquee = canvas.locator('[data-flow-zoom-area-box] .workbench-zoom-area');
  await expect(marquee).toHaveCSS('border-top-style', 'dashed');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(marquee).toHaveCount(0);
  expect(await snapshot()).toEqual(initial);

  await button('Open DDD Order aggregate').click();
  await expect(canvas.locator('[data-flow-node="order"]')).toContainText('Consistency owner');
  await expect(button('Select Order')).toHaveAccessibleDescription(/Consistency owner/);
  await button('Open workshop semantics example').click();
  await expect(canvas.locator('[data-flow-node="retry-question"]')).toContainText('Discuss · open');
  await expect(canvas.locator('[data-flow-node="timeout-agreement"]')).toContainText(
    'Agreed · resolved',
  );
  await button('Open DDD Order aggregate').click();
  await button('Select Order').press('Enter');
  await button('Select Order').press('ArrowRight');
  const working = await snapshot();
  await section('History');
  await button('Load Order history example').click();
  await page
    .getByRole('combobox', { name: 'Rewind to edition', exact: true })
    .selectOption('order-evolved');
  await expect(canvas).toHaveClass(/zloz-ui-surface/);
  await expect(canvas).toHaveAttribute('data-flow-readonly', 'true');
  await expect(
    page.getByRole('status', { name: 'Historical edition notice', exact: true }),
  ).toBeVisible();
  const ghosts = canvas.locator('[data-zloz-history-ghosts]');
  await expect(ghosts).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Show comparison ghosts', exact: true }).check();
  await expect(ghosts).toHaveAttribute('aria-hidden', 'true');
  await expect(ghosts.locator('[data-zloz-history-node]')).toHaveCount(5);
  await expect(ghosts.locator('[data-zloz-history-movement]')).toHaveCount(1);
  await expect(ghosts.locator('button, [data-flow-port], [tabindex]')).toHaveCount(0);
  const historicalOrder = canvas.locator('[data-flow-node="order"]');
  await expect(historicalOrder).toContainText('Sales order');
  const historicalStyle = await historicalOrder.getAttribute('style');
  await historicalOrder.locator('[data-flow-handle]').press('Delete');
  await historicalOrder.locator('[data-flow-handle]').press('ArrowRight');
  await expect(historicalOrder).toHaveAttribute('style', historicalStyle);
  await expect(canvas.locator('[data-flow-port]:enabled')).toHaveCount(0);
  await section('Diagnostics');
  await button('Minimal mode').click();
  await expect(ghosts).toHaveCount(0);
  await button('Minimal mode').click();
  await expect(ghosts).toHaveCount(1);
  await section('Navigation');
  const cameraBefore = await historicalOrder.boundingBox();
  await button('Zoom in').click();
  await expect.poll(() => historicalOrder.boundingBox()).not.toEqual(cameraBefore);
  await button('Back to present').click();
  await expect(canvas).toHaveAttribute('data-flow-readonly', 'false');
  expect(await snapshot()).toEqual(working);

  const assertDetachedReadOnly = async (diagram, id) => {
    await expect(diagram).toHaveClass(/zloz-ui-surface/);
    await expect(diagram).toHaveAttribute('data-flow-readonly', 'true');
    const node = diagram.locator(`[data-flow-node="${id}"]`);
    await expect(node).toBeVisible();
    const frame = await node.getAttribute('style');
    const handle = node.locator('[data-flow-handle]');
    await handle.press('Delete');
    await handle.press('ArrowRight');
    await expect(node).toHaveAttribute('style', frame);
    await expect(diagram.locator('[data-flow-port]:enabled')).toHaveCount(0);
    await diagram.scrollIntoViewIfNeeded();
    const world = diagram.locator('.zloz-ui-world');
    const beforeZoom = await world.evaluate((element) => new DOMMatrix(element.style.transform).a);
    const bounds = await diagram.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(0, -120);
    await expect
      .poll(() => world.evaluate((element) => new DOMMatrix(element.style.transform).a))
      .toBeGreaterThan(beforeZoom);
    await expect(node).toHaveAttribute('style', frame);
  };

  await section('Review packets');
  const packetInput = page.getByLabel('Open review packet', { exact: true });
  await expect(packetInput).toBeEnabled();
  await packetInput.setInputFiles(
    fileURLToPath(
      new URL(
        '../../../packages/foldkit-zloz-mermaid/test/fixtures/review-packet-v1.json',
        import.meta.url,
      ),
    ),
  );
  const packet = page.getByRole('region', { name: 'Read-only packet diagram', exact: true });
  await assertDetachedReadOnly(packet, 'note:2');
  await button('Fit packet').click();
  const baseline = page.getByRole('button', { name: /^Baseline:/ });
  await baseline.click();
  await expect(baseline).toHaveAttribute('aria-pressed', 'true');
  const baselineCanvas = packet.locator('[data-flow-node]');
  await expect(baselineCanvas.first()).toBeVisible();
  const baselineNodes = await baselineCanvas.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-flow-node')),
  );
  await expect(packetInput).toBeEnabled();
  await packetInput.setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(page.getByRole('status').filter({ hasText: 'invalid-json' })).toBeVisible();
  expect(
    await baselineCanvas.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-flow-node')),
    ),
  ).toEqual(baselineNodes);
  await page
    .getByRole('region', { name: 'Diagram canvas', exact: true })
    .getByRole('button', { name: 'Close packet review', exact: true })
    .click();
  await expect(packet).toHaveCount(0);
  expect(await snapshot()).toEqual(working);

  await section('C4 mapping review');
  const receipt = page.getByRole('region', { name: 'Portable receipt comparison', exact: true });
  await receipt
    .getByLabel('Open conversion receipt', { exact: true })
    .setInputFiles(
      fileURLToPath(
        new URL(
          '../../../packages/foldkit-zloz/test/fixtures/c4-conversion-v1.json',
          import.meta.url,
        ),
      ),
    );
  const receiptCanvas = page.getByRole('region', {
    name: 'Read-only receipt diagram',
    exact: true,
  });
  await assertDetachedReadOnly(receiptCanvas, 'system');
  await expect(
    receiptCanvas.getByRole('button', { name: 'Select Payment system', exact: true }),
  ).toBeVisible();
  await receipt.getByRole('button', { name: 'Before conversion', exact: true }).click();
  await expect(
    receiptCanvas.getByRole('button', { name: 'Select Provider', exact: true }),
  ).toBeVisible();
  await assertDetachedReadOnly(receiptCanvas, 'system');
  await button('Close comparison').click();
  await expect(receiptCanvas).toHaveCount(0);
  expect(await snapshot()).toEqual(working);

  await section('Domain review');
  const domain = page.getByRole('region', { name: 'Domain review settings', exact: true });
  await domain.getByRole('button', { name: 'Review bank example', exact: true }).click();
  const descriptor = page.getByRole('region', {
    name: 'Read-only Domain descriptor diagram',
    exact: true,
  });
  await expect(descriptor).toHaveAttribute('data-flow-readonly', 'true');
  await expect(descriptor.locator('[data-flow-node]:not([data-flow-group])')).toHaveCount(7);
  await expect(descriptor.locator('[data-flow-group]')).toHaveCount(1);
  const heading = domain.getByRole('combobox', { name: 'Group heading', exact: true });
  await heading.selectOption('expanded');
  const groupHeading = descriptor.locator('[data-zloz-group-header]');
  await expect(groupHeading).toContainText('Source identity retained');
  await expect(groupHeading).toHaveCSS('width', '640px');
  await expect(groupHeading).toHaveCSS('height', '112px');

  await heading.selectOption('measured');
  await domain.getByRole('button', { name: 'Measure group headings', exact: true }).click();
  const headingStatus = domain.getByLabel('Heading measurement status', { exact: true });
  await expect(headingStatus).toHaveText('Measured 1 group headings. Arrange to apply.');
  await domain
    .getByRole('combobox', { name: 'Label sizing', exact: true })
    .selectOption('measured');
  await domain.getByRole('button', { name: 'Measure label bounds', exact: true }).click();
  const labelStatus = domain.getByLabel('Label measurement status', { exact: true });
  await expect(labelStatus).toHaveText('Measured 8 rendered labels. Arrange to apply.');
  await expect(headingStatus).toHaveText('Measured 1 group headings. Arrange to apply.');
  const nodesBeforeLayout = await descriptor
    .locator('[data-flow-node]')
    .evaluateAll((nodes) => nodes.map(({ style }) => [style.left, style.top]));
  await domain.getByRole('button', { name: 'Arrange preview with ELK', exact: true }).click();
  await expect(domain.getByLabel('Preview layout mode', { exact: true })).toHaveText(
    'ELK preview geometry',
    { timeout: 30000 },
  );
  await expect(headingStatus).toContainText('Measured group headings applied');
  expect(
    await descriptor
      .locator('[data-flow-node]')
      .evaluateAll((nodes) => nodes.map(({ style }) => [style.left, style.top])),
  ).not.toEqual(nodesBeforeLayout);
  await button('Fit descriptor diagram').click();
  await page
    .getByRole('region', { name: 'Diagram canvas', exact: true })
    .getByRole('button', { name: 'Return to working model', exact: true })
    .click();
  await expect(descriptor).toHaveCount(0);
  expect(await snapshot()).toEqual(working);

  await button('Open DDD context map').click();
  const contextLabels = canvas.locator('[data-zloz-context-map-label]');
  await expect(contextLabels).toHaveCount(4);
  const contextGraph = await snapshot();
  await section('Appearance');
  const contextPresentation = page.getByRole('checkbox', {
    name: 'Context-map presentation',
    exact: true,
  });
  await contextPresentation.uncheck();
  await expect(contextLabels).toHaveCount(0);
  expect(await snapshot()).toEqual(contextGraph);
  await section('Appearance');
  await contextPresentation.check();
  await expect(contextLabels).toHaveCount(4);
  expect(await snapshot()).toEqual(contextGraph);

  await section('Appearance');
  await page.getByRole('combobox', { name: 'Resize readout', exact: true }).selectOption('labeled');
  await section('Diagram');
  await button('Open grouped Onion Architecture').click();
  await button('Select Application core').press('Enter');
  const readout = canvas.locator('[data-flow-resize-readout]');
  await expect(readout.locator('.labeled-resize-readout')).toBeVisible();
  await expect(readout).toHaveAttribute('aria-live', 'polite');
  await expect(readout).toHaveAttribute('title', 'Application core: 500 × 232 graph units');
  await button('Resize Application core from bottom right').press('ArrowRight');
  await expect(readout).toHaveAttribute('title', 'Application core: 505 × 232 graph units');

  expect(errors).toEqual([]);
  console.log(
    engine + ': native Architecture canvas shares the working model, actions, export and Undo',
  );
}
await qualify().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
