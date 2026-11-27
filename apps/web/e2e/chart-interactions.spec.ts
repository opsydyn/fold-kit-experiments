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

test('color strips and easing curves highlight independently', async ({ page }) => {
  await page.goto('/charts');
  const colors = page.getByRole('img', { name: /Red to blue gradient/ });
  const easing = page.getByRole('img', { name: /Comparison of 6 easing functions/ });
  const colorIsland = page.locator('astro-island').filter({ has: colors });
  const easingIsland = page.locator('astro-island').filter({ has: easing });
  await hydrated(colorIsland);
  await hydrated(easingIsland);

  const rgb = colors.getByText('RGB', { exact: true });
  const colorGroups = colors.locator('g[opacity]');
  await expect(colorGroups).toHaveCount(3);
  await rgb.hover();
  await expect(colors.locator('g[opacity="0.35"]')).toHaveCount(2);
  await expect(easing.locator('path[opacity="0.15"]')).toHaveCount(0);

  await easing.getByText('cubicOut', { exact: true }).hover();
  await expect(easing.locator('path[opacity="0.15"]')).toHaveCount(5);
  await expect(easing.locator('path[stroke-width="2.5"]')).toHaveCount(1);
  await expect(colors.locator('g[opacity="0.35"]')).toHaveCount(0);
});

test('phyllotaxis keeps its spiral and minimap in sync through zoom, drag, and reset', async ({
  page,
}) => {
  await page.goto('/charts');
  const chart = page.getByRole('group', { name: 'Phyllotaxis zoom and pan' });
  await hydrated(page.locator('astro-island').filter({ has: chart }));
  const spiral = chart.locator('[data-phyllotaxis-spiral]');
  const viewport = chart.locator('[data-phyllotaxis-viewport]');
  await expect(spiral.locator('circle')).toHaveCount(1000);
  const originalMatrix = await spiral.getAttribute('transform');
  const originalViewport = await viewport.getAttribute('transform');

  await chart.getByRole('button', { name: 'Zoom in' }).press('Enter');
  await expect(spiral).not.toHaveAttribute('transform', originalMatrix ?? '');
  await expect(viewport).not.toHaveAttribute('transform', originalViewport ?? '');
  const zoomed = await spiral.getAttribute('transform');
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    const x = box.x + box.width * 0.36;
    const y = box.y + box.height * 0.4;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 36, y + 18, { steps: 5 });
    await page.mouse.up();
  }
  await expect(spiral).not.toHaveAttribute('transform', zoomed ?? '');
  const dragged = await spiral.getAttribute('transform');

  await chart.getByRole('button', { name: 'Hide Mini Map' }).click();
  await expect(viewport).toHaveCount(0);
  await expect(spiral).toHaveAttribute('transform', dragged ?? '');
  await chart.getByRole('button', { name: 'Show Mini Map' }).press('Space');
  await expect(viewport).toHaveCount(1);
  await chart.getByRole('button', { name: 'Reset' }).press('Enter');
  await expect(spiral).toHaveAttribute('transform', originalMatrix ?? '');
  await expect(viewport).toHaveAttribute('transform', originalViewport ?? '');
});
