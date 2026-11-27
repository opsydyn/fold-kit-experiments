import { expect, test, type Page } from '@playwright/test';

async function hydrated(page: Page) {
  const island = page
    .locator('astro-island')
    .filter({ has: page.locator('[data-effect-ui-root]') });
  await expect(island).toHaveCount(1);
  await expect(island).not.toHaveAttribute('ssr');
}

test('Greeting adopts Arabic SSR and reflects language changes on the document', async ({
  page,
}) => {
  await page.goto('/greeting?name=Ada&locale=ar');
  await hydrated(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('مرحبا، Ada!')).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/greeting$/);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByText('Hello, World!')).toBeVisible();
  await expect(page).toHaveTitle('Hello, World! — Astro + Effect UI');

  await page.goto('/greeting-static');
  await expect(page.getByText('Hello, static astronaut!')).toBeVisible();
  await hydrated(page);
});

test('Profile restores stored names and Welcome follows saves across tabs', async ({
  page,
  context,
}) => {
  await page.goto('/profile?name=Requested');
  await hydrated(page);
  const input = page.getByRole('textbox', { name: 'Username' });
  await expect(input).toHaveValue('Requested');
  await input.fill('Ada');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved!');

  const welcome = await context.newPage();
  await welcome.goto('/welcome');
  await hydrated(welcome);
  await expect(welcome.getByText('Welcome, Ada!')).toBeVisible();

  await page.goto('/profile?name=Fallback');
  await hydrated(page);
  await expect(input).toHaveValue('Ada');
  await input.fill('Grace');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(welcome.getByText('Welcome, Grace!')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('fk:username'))).toBe('Grace');
  await input.fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(welcome.getByText('No name set yet.')).toBeVisible();
  await welcome.close();
});

test('Timestamp renders the same server start time while uptime advances', async ({ page }) => {
  await page.goto('/timestamp');
  await hydrated(page);
  const start = page.locator('time');
  const startedAt = await start.getAttribute('datetime');
  expect(startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await expect(page.locator('[data-uptime]')).not.toHaveText('00m 00s');
  await expect(start).toHaveAttribute('datetime', startedAt ?? '');
});
