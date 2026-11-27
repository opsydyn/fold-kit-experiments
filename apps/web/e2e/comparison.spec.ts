import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Browser acceptance for /comparison (the keyed chart comparison release),
 * written from the gates in its qualification record so they run in real
 * engines: Firefox and Chromium, at desktop width and 390px.
 */

/** The panel headings, in order; a retrying assertion waits for each re-render. */
const headings = (page: Page) => page.locator('.comparison-panel h2');
const count = (page: Page) => page.locator('.comparison-toolbar [aria-live="polite"]');
const chartOf = (page: Page, name: string) =>
  page.getByRole('application', { name: new RegExp(`^${name}:`) });

/** Every page error and console error, so a test can insist there were none. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function open(page: Page): Promise<string[]> {
  const errors = watchErrors(page);
  await page.goto('/comparison');
  await expect(page.locator('.comparison-panel')).toHaveCount(2);
  const island = page.locator('astro-island').filter({ has: page.locator('.comparison') });
  await expect(island.locator('[data-effect-ui-root]')).toHaveCount(1);
  await expect(island).not.toHaveAttribute('ssr');
  await expect(page.locator('#comparison-add-scatter')).toBeEnabled();
  return errors;
}

/** Inspect the histogram's first bin from the keyboard, returning the matching count shown. */
async function inspectFirstBin(page: Page, name = 'Histogram 2'): Promise<string> {
  await chartOf(page, name).focus();
  await page.keyboard.press('ArrowRight');
  await expect(count(page)).not.toHaveText('0 matching points');
  return (await count(page).textContent()) ?? '';
}

/** Hover the histogram's first bar, returning the matching count shown. */
async function hoverFirstBin(page: Page, name = 'Histogram 2'): Promise<string> {
  const bars = chartOf(page, name).locator('.plot-mark rect');
  const first = await firstBar(bars);
  // As a person would, bring the bar on screen before pointing at it.
  await first.scrollIntoViewIfNeeded();
  const box = await first.boundingBox();
  if (box === null) throw new Error('the first bar is not on screen');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2);
  await expect(count(page)).not.toHaveText('0 matching points');
  return (await count(page).textContent()) ?? '';
}

/** The leftmost drawn bar. */
async function firstBar(bars: Locator): Promise<Locator> {
  const xs = await bars.evaluateAll((rects) => rects.map((rect) => rect.getBoundingClientRect().x));
  const index = xs.indexOf(Math.min(...xs));
  return bars.nth(index);
}

test.describe('chart comparison', () => {
  test('shows the default panels with readable axes, controls, count and caption', async ({
    page,
  }) => {
    const errors = await open(page);
    const root = page.locator('astro-island [data-effect-ui-root]').filter({
      has: page.getByRole('button', { name: 'Add scatter' }),
    });
    await expect(root).toHaveCount(1);
    await expect(chartOf(page, 'Scatter 1').locator('svg desc')).toHaveJSProperty(
      'namespaceURI',
      'http://www.w3.org/2000/svg',
    );
    await expect(headings(page)).toHaveText(['Scatter 1', 'Histogram 2']);
    await expect(page.getByRole('button', { name: 'Add scatter' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add histogram' })).toBeVisible();
    await expect(page.getByLabel('Link inspections')).toBeChecked();
    await expect(count(page)).toHaveText('0 matching points');
    await expect(
      page.getByText('Illustrative salary data ($), not a salary benchmark.'),
    ).toBeVisible();
    for (const name of ['Scatter 1', 'Histogram 2'])
      expect(await chartOf(page, name).locator('svg text').count()).toBeGreaterThan(4);
    expect(errors).toEqual([]);
  });

  test('draws no chart label over another, the scatter y label included', async ({ page }) => {
    await open(page);
    const overlaps = await page.locator('.comparison-panel svg').evaluateAll((charts) =>
      charts.flatMap((chart) => {
        const boxes = [...chart.querySelectorAll('text')]
          .filter((text) => (text.textContent ?? '').trim() !== '')
          .map((text) => ({ text: text.textContent ?? '', box: text.getBoundingClientRect() }));
        const found: string[] = [];
        boxes.forEach((a, i) =>
          boxes.slice(i + 1).forEach((b) => {
            const overlap =
              Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 1 &&
              Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > 1;
            if (overlap) found.push(`${a.text} / ${b.text}`);
          }),
        );
        return found;
      }),
    );
    expect(overlaps).toEqual([]);
  });

  test('adds up to four panels and blocks a fifth', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Add scatter' }).click();
    await page.getByRole('button', { name: 'Add histogram' }).click();
    await expect(headings(page)).toHaveText([
      'Scatter 1',
      'Histogram 2',
      'Scatter 3',
      'Histogram 4',
    ]);
    await expect(page.getByRole('button', { name: 'Add scatter' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add histogram' })).toBeDisabled();
  });

  test('reorders with an inspection active, keeping it and the focused move control', async ({
    page,
  }) => {
    await open(page);
    const inspected = await inspectFirstBin(page);
    const move = page.getByRole('button', { name: 'Move Histogram 2 earlier' });
    await move.focus();
    await page.keyboard.press('Enter');
    await expect(headings(page)).toHaveText(['Histogram 2', 'Scatter 1']);
    await expect(move).toBeFocused();
    await expect(move).toHaveAttribute('aria-disabled', 'true');
    await expect(count(page)).toHaveText(inspected);
  });

  test('clears the linked overlay when its source panel is removed', async ({ page }) => {
    await open(page);
    await inspectFirstBin(page);
    await page.getByRole('button', { name: 'Remove Histogram 2' }).click();
    await expect(headings(page)).toHaveText(['Scatter 1']);
    await expect(count(page)).toHaveText('0 matching points');
  });

  test('recovers focus to Add after the last panel goes, and re-adds with a new ID', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('button', { name: 'Remove Scatter 1' }).click();
    await page.getByRole('button', { name: 'Remove Histogram 2' }).click();
    await expect(page.getByText('No panels')).toBeVisible();
    await expect(page.locator('#comparison-add-scatter')).toBeFocused();
    await page.getByRole('button', { name: 'Add scatter' }).click();
    await expect(headings(page)).toHaveText(['Scatter 3']);
  });

  test('agrees between keyboard and pointer, before and after reorder, scroll and resize', async ({
    page,
  }) => {
    await open(page);
    const byKeyboard = await inspectFirstBin(page);
    await page.keyboard.press('Escape');
    expect(await hoverFirstBin(page)).toBe(byKeyboard);
    await page.getByRole('button', { name: 'Move Histogram 2 earlier' }).click();
    await page.mouse.wheel(0, 300);
    const size = page.viewportSize();
    if (size !== null)
      await page.setViewportSize({ width: size.width - 120, height: size.height - 80 });
    await page.mouse.move(0, 0);
    expect(await hoverFirstBin(page)).toBe(byKeyboard);
  });

  test('fits the page width, a single column at 390px', async ({ page }) => {
    await open(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const clipped = await page
      .locator('.comparison button, .comparison h2, .comparison label')
      .evaluateAll(
        (elements) =>
          elements.filter((element) => element.scrollWidth > element.clientWidth + 1).length,
      );
    expect(clipped).toBe(0);
    if ((page.viewportSize()?.width ?? 1000) <= 400) {
      const lefts = await page
        .locator('.comparison-panel')
        .evaluateAll((panels) =>
          panels.map((panel) => Math.round(panel.getBoundingClientRect().left)),
        );
      expect(new Set(lefts).size).toBe(1);
    }
  });

  test('shows focus distinctly from linked highlights, and honours reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const add = page.locator('#comparison-add-scatter');
    await add.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const focusOutline = await add.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(focusOutline).toBe('solid');
    await inspectFirstBin(page);
    const dimmed = await chartOf(page, 'Scatter 1')
      .locator('circle')
      .evaluateAll(
        (circles) =>
          circles.filter((circle) => Number(getComputedStyle(circle).opacity) < 1).length,
      );
    expect(dimmed).toBeGreaterThan(0);
    const moving = await page.locator('.comparison *').evaluateAll(
      (elements) =>
        elements.filter((element) => {
          const style = getComputedStyle(element);
          return parseFloat(style.transitionDuration) > 0 || style.animationName !== 'none';
        }).length,
    );
    expect(moving).toBe(0);
  });

  test('raises no errors through a session, and tears down on leaving', async ({ page }) => {
    const errors = await open(page);
    await inspectFirstBin(page);
    await page.getByRole('button', { name: 'Add scatter' }).click();
    await page.getByRole('button', { name: 'Move Scatter 3 earlier' }).click();
    await page.getByRole('button', { name: 'Remove Scatter 1' }).click();
    await page.goto('/charts');
    await expect(page.locator('.comparison')).toHaveCount(0);
    await page.goto('/comparison');
    await expect(page.locator('.comparison')).toHaveCount(1);
    await expect(headings(page)).toHaveText(['Scatter 1', 'Histogram 2']);
    expect(errors).toEqual([]);
  });
});
