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

test('data science changes fits and sampling while retaining its accessible outputs', async ({
  page,
}) => {
  await page.goto('/data-science');
  const regression = page.getByRole('region', { name: 'Regression' });
  await regression.scrollIntoViewIfNeeded();
  await hydrated(page.locator('astro-island').filter({ has: regression }));
  await expect(regression.locator('.ds-band')).toHaveCount(1);
  await expect(regression.getByRole('table', { name: 'Linear fit' })).toContainText('R squared');
  const originalFit = await regression.locator('.chart-line-series').getAttribute('d');
  await regression.getByRole('button', { name: 'LOESS' }).press('Enter');
  await expect(regression.getByRole('button', { name: 'LOESS' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(regression.locator('.chart-line-series')).not.toHaveAttribute(
    'd',
    originalFit ?? '',
  );
  await expect(regression.locator('.ds-band')).toHaveCount(0);
  await expect(regression.getByRole('table', { name: 'LOESS fit' })).toContainText('Bandwidth');
  await regression.getByRole('button', { name: 'Quadratic' }).click();
  await expect(regression.locator('.ds-band')).toHaveCount(1);
  await expect(regression.getByRole('table', { name: 'Quadratic fit' })).toContainText('x^2');

  const sampling = page.getByRole('region', { name: '100,000 points' });
  const readout = sampling.locator('[aria-live="polite"]');
  await expect(readout).toContainText('with M4');
  const initial = await sampling.locator('.chart-line-series').getAttribute('d');
  await sampling.getByRole('button', { name: 'LTTB' }).press('Enter');
  await expect(readout).toContainText('with LTTB');
  await expect(sampling.locator('.chart-line-series')).not.toHaveAttribute('d', initial ?? '');
  await expect(
    page.getByRole('region', { name: 'Density' }).locator('.chart-hex-series path title').first(),
  ).toBeAttached();
});

test('evolution changes line shape and highlights a focused legend series', async ({ page }) => {
  await page.goto('/evolution');
  const chart = page.getByRole('img', { name: /^Diagram evolution/ });
  await chart.scrollIntoViewIfNeeded();
  await hydrated(page.locator('astro-island').filter({ has: chart }));
  const series = chart.locator('.chart-line-series');
  await expect(series).toHaveCount(6);
  const original = await series.first().getAttribute('d');
  await page.getByRole('button', { name: 'Smoothed' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Smoothed' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(series.first()).not.toHaveAttribute('d', original ?? '');

  const people = page.getByRole('button', { name: 'People 2' });
  await people.focus();
  await expect(people).toHaveAttribute('aria-pressed', 'true');
  await expect(chart.locator('.chart-line-series[opacity="0.2"]')).toHaveCount(5);
  await expect(series.last()).toHaveAttribute('opacity', '1');
  await people.blur();
  await expect(chart.locator('.chart-line-series[opacity="0.2"]')).toHaveCount(0);
  await page.getByText('Change log', { exact: true }).click();
  const log = page.getByRole('table', { name: 'Diagram changes, oldest first' });
  await expect(log.getByRole('row')).toHaveCount(21);
  await expect(log).toContainText('NEW PERSON');
});

test('complexity field inspects, selects and clears an orbit mark from the keyboard', async ({
  page,
}) => {
  await page.goto('/complexity-field');
  const orbit = page.getByRole('group', { name: /^Complexity field\. 42 modules/ });
  await orbit.scrollIntoViewIfNeeded();
  await hydrated(page.locator('astro-island').filter({ has: orbit }));
  const modules = orbit.getByRole('button');
  await expect(modules).toHaveCount(42);
  const module = orbit.getByRole('button', { name: /^apim-learn:/ });
  const readout = page.locator('[aria-live="polite"]');
  await expect(readout).toContainText('ENGINEERING SYSTEM STANDBY');
  await module.focus();
  await expect(readout).toContainText('apim-learn');
  await module.press('Space');
  await expect(module).toHaveAttribute('aria-pressed', 'true');
  await expect(module).toBeFocused();
  await module.blur();
  await expect(readout).toContainText('apim-learn');
  await module.press('Enter');
  await expect(module).toHaveAttribute('aria-pressed', 'false');
  await module.blur();
  await expect(readout).toContainText('ENGINEERING SYSTEM STANDBY');

  const gradientId = await orbit.locator('radialGradient').getAttribute('id');
  expect(gradientId).toBeTruthy();
  await expect(orbit.locator('.chart-orbit-core')).toHaveAttribute('fill', `url(#${gradientId})`);
  await page.getByText('Module table', { exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Modules by systemic risk' }).getByRole('row'),
  ).toHaveCount(43);
});
