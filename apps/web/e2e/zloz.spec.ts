import { expect, test } from '@playwright/test';

test('server renders the Effect UI workflow before hydration', async ({ request }) => {
  const response = await request.get('/zloz');
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('data-flow-surface="flow-demo"');
  expect(html).toContain('aria-label="Label for source"');
  expect(html.match(/data-flow-node=/g)).toHaveLength(2);
});

test('edit, connect, drag, cancel, arrange, undo, save and reload a graph', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/zloz');
  const surface = page.getByRole('region', { name: 'Workflow editor', exact: true });
  // Wait for native hydration before testing pointer or keyboard input.
  await expect(surface.locator('[data-flow-node]')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await page.getByRole('button', { name: 'Connect from Source: out', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Connect to Review: in', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(surface.locator('[data-flow-edge]')).toHaveCount(1);
  const input = page.getByRole('textbox', { name: 'Label for source', exact: true });
  await input.fill('Intake');
  await input.press('ArrowLeft');
  await input.press('Delete');
  await input.fill('Intake');
  await expect(surface.locator('[data-flow-node]')).toHaveCount(2);
  const handle = page.getByRole('button', { name: 'Select Intake', exact: true });
  const source = surface.locator('[data-flow-node="source"]');
  const left = () => source.evaluate((node) => getComputedStyle(node).left);
  const beforeKeyboard = parseFloat(await left());
  await handle.focus();
  await handle.press('Enter');
  await handle.press('ArrowRight');
  await expect.poll(async () => parseFloat(await left())).toBeGreaterThan(beforeKeyboard);
  const afterKeyboard = await left();
  const bounds = await handle.boundingBox();
  if (!bounds) throw new Error('Missing node handle');
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 50, y + 30, { steps: 6 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect.poll(left).toBe(afterKeyboard);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 20, { steps: 6 });
  await page.mouse.up();
  await expect.poll(left).not.toBe(afterKeyboard);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(left).toBe(afterKeyboard);
  await page.getByRole('button', { name: 'Arrange with ELK', exact: true }).click();
  await expect(page.getByText('Layout applied.', { exact: true })).toBeVisible();
  await expect(surface.locator('[data-flow-edge]')).toHaveAttribute('d', /L/);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved on this browser.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load saved', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Label for source' })).toHaveValue('Intake');
  await expect(surface.locator('[data-flow-edge]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  const canvas = await surface.boundingBox();
  if (!canvas) throw new Error('Missing canvas');
  await expect
    .poll(async () => {
      const nodes = await surface.locator('[data-flow-node]').all();
      const bounds = await Promise.all(nodes.map((node) => node.boundingBox()));
      return bounds.every(
        (node) =>
          node !== null && node.x >= canvas.x && node.x + node.width <= canvas.x + canvas.width,
      );
    })
    .toBe(true);
  await page.screenshot({ path: info.outputPath('flow-editor.png'), fullPage: true });
  await page.evaluate(() => localStorage.setItem('opsydyn.foldkit-flow.demo.v1', '{bad'));
  await page.getByRole('button', { name: 'Load saved', exact: true }).click();
  await expect(
    page.getByText('Saved graph unavailable or invalid. Your current graph is preserved.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Label for source' })).toHaveValue('Intake');
  await expect(surface.locator('[data-flow-edge]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
