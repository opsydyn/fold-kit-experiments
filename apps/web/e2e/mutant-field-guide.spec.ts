import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('Explore specimens retain their portraits and recorded outcomes across navigation', async ({
  page,
}) => {
  await page.goto('/mutant-field-guide');
  await expect(page.getByRole('heading', { name: 'The endless one' })).toBeVisible();
  const shelf = page.getByRole('navigation', { name: 'Recorded specimens' });
  const links = shelf.getByRole('link');
  expect(await links.count()).toBeGreaterThanOrEqual(11);
  const portraits = new Set<string>();
  for (const link of (await links.all()).slice(0, 7)) {
    const name = (await link.getAttribute('aria-label'))?.replace('Inspect ', '');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    const selected = shelf.locator('[aria-current="page"] svg');
    const portrait = await page.locator('figure svg').innerHTML();
    expect(await selected.innerHTML()).toBe(portrait);
    portraits.add(portrait);
    expect(
      (await page.getByRole('list').getByRole('listitem').locator('b').allTextContents()).slice(
        0,
        3,
      ),
    ).toEqual(['Survived', 'Caught', 'Caught']);
  }
  expect(portraits.size).toBe(7);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Fault spine' })).toBeVisible();
  await shelf.getByRole('link', { name: 'Inspect portrait · c02499' }).click();
  await expect(page.getByRole('listitem').first()).toContainText('Untested');
});

test('the endless one hides its deep-water portrait behind a keyboard disclosure', async ({
  page,
}) => {
  await page.goto('/mutant-field-guide');
  const title = page.getByRole('heading', {
    name: 'Cthulhu, the endless wait',
    includeHidden: true,
  });
  await expect(title).toBeHidden();
  await page.getByText('Inspect the loop', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(title).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(title).toBeHidden();
  await page.getByRole('link', { name: 'Inspect Fault spine' }).click();
  await expect(page.locator('summary', { hasText: 'Inspect the loop' })).toHaveCount(0);
});
