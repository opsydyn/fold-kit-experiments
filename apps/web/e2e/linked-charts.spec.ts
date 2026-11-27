import { expect, test } from '@playwright/test';

test('links keyboard inspection and histogram data through filter and empty states', async ({
  page,
}) => {
  await page.goto('/charts#linked-views');
  const example = page.locator('#linked-views');
  const scatter = example.getByRole('application', { name: /Scatter chart/ });
  const histogram = example.getByRole('application', { name: /Histogram/ });
  const filter = example.getByRole('spinbutton', { name: 'Minimum years of experience' });
  const status = example.getByRole('status');
  await expect(status).toHaveText('30 observations');
  const island = example
    .locator('astro-island')
    .filter({ has: page.getByRole('application', { name: /Scatter chart/ }) });
  await expect(island.locator('[data-effect-ui-root]')).toHaveCount(1);
  await expect(island).not.toHaveAttribute('ssr');
  await expect(scatter.locator('svg desc')).toHaveJSProperty(
    'namespaceURI',
    'http://www.w3.org/2000/svg',
  );

  await scatter.focus();
  await page.keyboard.press('ArrowRight');
  await expect(scatter.locator('[aria-live="polite"]')).toHaveText('1yr');
  await expect(histogram.locator('[aria-live="polite"]')).not.toBeEmpty();
  await page.keyboard.press('Escape');
  await expect(histogram.locator('[aria-live="polite"]')).toBeEmpty();
  await page.keyboard.press('Tab');
  await expect(histogram).toBeFocused();
  await page.keyboard.press('End');
  await expect(histogram.locator('[aria-live="polite"]')).not.toBeEmpty();
  await expect(histogram.getByRole('table', { name: 'Histogram bins' })).toBeAttached();
  await expect(histogram.getByRole('columnheader', { name: 'People' })).toBeAttached();

  await filter.fill('25');
  await expect(status).toHaveText('No observations match the filter.');
  await expect(scatter.locator('.plot-mark circle')).toHaveCount(0);
  await expect(histogram.getByRole('row')).toHaveCount(1);
  await expect(filter).toBeFocused();

  await filter.fill('10');
  await expect(status).toHaveText('12 observations');
  await scatter.focus();
  await page.keyboard.press('ArrowRight');
  await expect(scatter.locator('[aria-live="polite"]')).toHaveText('10yr');
  await scatter.locator('.plot-mark.plot-dot circle').last().hover();
  await expect(scatter.locator('[aria-live="polite"]')).toHaveText('20yr');
  await expect(histogram.locator('[aria-live="polite"]')).not.toBeEmpty();
});
