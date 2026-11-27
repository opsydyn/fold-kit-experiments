import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('renders chart descriptions, data tables and both map projections on the server', async ({
  page,
}) => {
  await page.goto('/charts');

  const gallery = page.getByRole('heading', { name: 'Chart gallery' }).locator('+ div');
  const staticCharts = gallery.locator(':scope > div').filter({
    has: page.locator('figure.plot'),
    hasNot: page.locator('astro-island'),
  });
  await expect(staticCharts).toHaveCount(42);

  const budget = staticCharts.filter({ hasText: 'Budget breakdown' });
  await expect(budget.getByRole('img', { name: /Budget breakdown/ })).toBeVisible();
  await expect(budget.getByRole('table', { name: 'Budget breakdown' })).toBeAttached();

  const projections = staticCharts.filter({ hasText: 'Map projections' });
  await expect(projections.getByRole('img', { name: /Equirectangular/ })).toBeVisible();
  await expect(projections.getByRole('img', { name: /Mercator/ })).toBeVisible();
});
