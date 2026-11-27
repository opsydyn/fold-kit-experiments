import { expect, test, type Locator } from '@playwright/test';

async function hydrated(island: Locator) {
  await expect(island.locator('[data-effect-ui-root]')).toHaveCount(1);
  await expect(island).not.toHaveAttribute('ssr');
}

test('animated bars grow and show values on hover', async ({ page }) => {
  await page.goto('/charts');
  const chart = page.getByRole('img', { name: 'Animated bar chart', exact: true });
  await hydrated(page.locator('astro-island').filter({ has: chart }));
  const first = chart.locator('g[aria-label="Q1: 42"]');
  await expect(first.locator('rect')).toHaveAttribute('height', /^[1-9]\d*(?:\.\d+)?$/);
  await first.locator('rect').hover();
  await expect(first.locator('text')).toHaveText('42');
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  expect(box).not.toBeNull();
  if (box) await page.mouse.move(box.x + 2, box.y + 2);
  await expect(first.locator('text')).toHaveCount(0);
});

test('histogram drag selects matching bins and clears through the keyboard', async ({ page }) => {
  await page.goto('/histogram-brush');
  const histogram = page.locator('[data-brush="histogram"] svg');
  await hydrated(page.locator('astro-island').filter({ has: histogram }));
  const heading = page.getByRole('heading', { name: 'Histogram Brush Filter' });
  const status = page.locator('[aria-live="polite"]').filter({ hasText: /requests/ });
  await expect(status).toContainText('Drag across');
  await histogram.scrollIntoViewIfNeeded();
  const box = await histogram.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    const y = box.y + box.height * 0.4;
    await page.mouse.move(box.x + box.width * 0.25, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.55, y, { steps: 5 });
    await heading.hover();
    await page.mouse.up();
  }
  await expect(status).toHaveText(/\d+ of \d+ requests from \d+ to \d+ ms/);
  const dimmed = page.locator('.plot-dot circle[opacity]:not([opacity="1"])');
  await expect(dimmed.first()).toBeAttached();
  await page.getByRole('button', { name: 'Clear' }).press('Enter');
  await expect(status).toContainText('Drag across');
  await expect(dimmed).toHaveCount(0);
});

test('zoom and pan change line geometry and reset restores the original SVG', async ({ page }) => {
  await page.goto('/charts');
  const toolbar = page.getByRole('group', { name: 'Date range' });
  const island = page.locator('astro-island').filter({ has: toolbar });
  await hydrated(island);
  const path = island.locator('.plot-mark.plot-line path').first();
  const original = await path.getAttribute('d');
  expect(original).toBeTruthy();

  await toolbar.getByRole('button', { name: 'Zoom in' }).press('Enter');
  await expect(path).not.toHaveAttribute('d', original ?? '');
  const zoomed = await path.getAttribute('d');
  await toolbar.getByRole('button', { name: 'Earlier' }).press('Enter');
  await expect(path).not.toHaveAttribute('d', zoomed ?? '');
  await toolbar.getByRole('button', { name: 'Reset' }).press('Enter');
  await expect(path).toHaveAttribute('d', original ?? '');
});
