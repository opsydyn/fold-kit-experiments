import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('Explore specimens retain their portraits and recorded outcomes across navigation', async ({
  page,
}) => {
  await page.goto('/mutant-field-guide');
  await expect(page.getByRole('heading', { name: 'The endless one' })).toBeVisible();
  const shelf = page.getByRole('navigation', { name: 'Explore specimens' });
  const links = shelf.getByRole('link');
  await expect(links).toHaveCount(7);
  const portraits = new Set<string>();
  for (const link of await links.all()) {
    const name = (await link.getAttribute('aria-label'))?.replace('Inspect ', '');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    const selected = shelf.locator('[aria-current="page"] svg');
    const portrait = await page.locator('figure svg').innerHTML();
    expect(await selected.innerHTML()).toBe(portrait);
    portraits.add(portrait);
    await expect(page.getByRole('list').getByRole('listitem').locator('b')).toHaveText([
      'Survived',
      'Caught',
      'Caught',
    ]);
  }
  expect(portraits.size).toBe(7);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Fault spine' })).toBeVisible();
});
