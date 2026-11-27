import { expect, test } from '@playwright/test';

test('server renders the carousel loading state before hydration', async ({ request }) => {
  const response = await request.get('/carousel');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('Loading slides…');
});

test('carousel supports buttons, keyboard navigation, drag and cancellation', async ({ page }) => {
  await page.goto('/carousel');
  const carousel = page.getByRole('region', { name: 'Feature carousel' });
  const arrow = carousel.getByRole('button', { name: 'Next slide' });
  const pressed = (index: number) => carousel.getByRole('button', { name: `Go to slide ${index}` });
  await expect(pressed(1)).toHaveAttribute('aria-pressed', 'true');

  await arrow.focus();
  await arrow.press('ArrowRight');
  await expect(pressed(1)).toHaveAttribute('aria-pressed', 'true');
  await carousel.focus();
  await carousel.press('ArrowLeft');
  await expect(pressed(5)).toHaveAttribute('aria-pressed', 'true');
  await arrow.click();
  await expect(pressed(1)).toHaveAttribute('aria-pressed', 'true');

  const track = carousel.locator('[data-carousel-track-id]');
  const strip = track.locator(':scope > div');
  const bounds = await track.boundingBox();
  if (!bounds) throw new Error('Carousel track is missing');
  const x = bounds.x + bounds.width * 0.75;
  const y = bounds.y + bounds.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - bounds.width * 0.35, y, { steps: 5 });
  await expect(strip).toHaveCSS('cursor', 'grabbing');
  await page.keyboard.press('Escape');
  await expect(strip).toHaveCSS('cursor', 'grab');
  await page.mouse.up();
  await expect(pressed(1)).toHaveAttribute('aria-pressed', 'true');

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - bounds.width * 0.55, y, { steps: 5 });
  // Finish with a small final move so release momentum cannot skip another slide.
  await page.waitForTimeout(80);
  await page.mouse.move(x - bounds.width * 0.56, y);
  await page.mouse.up();
  await expect(pressed(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(carousel.getByRole('group', { name: '2 of 5' })).toContainText('Discovery');
});
