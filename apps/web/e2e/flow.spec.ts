import { expect, test } from '@playwright/test';

test('edit, connect, drag, cancel, arrange, undo, save and reload a graph', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/flow');
  const surface = page.getByRole('group', { name: 'Workflow editor', exact: true });
  // A clean CI dev server compiles the lazy island on its first visit.
  // Keep interaction assertions fast after this explicit readiness boundary.
  await expect(surface.locator('[data-flow-node]')).toHaveCount(2, { timeout: 30_000 });
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
  await handle.focus();
  await handle.press('ArrowRight');
  await expect(surface.locator('[data-flow-node="source"]')).toHaveAttribute('data-flow-x', '45');
  const bounds = await handle.boundingBox();
  if (!bounds) throw new Error('Missing node handle');
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 50, y + 30, { steps: 6 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(surface.locator('[data-flow-node="source"]')).toHaveAttribute('data-flow-x', '45');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 20, { steps: 6 });
  await page.mouse.up();
  await expect(surface.locator('[data-flow-node="source"]')).not.toHaveAttribute(
    'data-flow-x',
    '45',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(surface.locator('[data-flow-node="source"]')).toHaveAttribute('data-flow-x', '45');
  await page.getByRole('button', { name: 'Arrange with ELK', exact: true }).click();
  await expect(page.getByText('Layout applied.', { exact: true })).toBeVisible();
  await expect(surface.locator('[data-flow-edge]')).toHaveAttribute('d', /L/);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved on this browser.', { exact: true })).toBeVisible();
  await page.reload();
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
