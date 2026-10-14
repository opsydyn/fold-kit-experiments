/* Browser test callbacks return observable measurements, not Effect transitions. */
/* oxlint-disable linteffect/no-return-in-arrow */
import { expect, test, type Page } from '@playwright/test';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test('recorded globe renders, rotates, inspects, resets and re-enters in both themes', async ({
  page,
}, info) => {
  const errors = watchErrors(page);
  const outside: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1')
      outside.push(request.url());
  });
  await page.goto('/earthquake-globe');
  const globe = page.getByRole('group', { name: 'Earthquake globe', exact: true });
  await expect(globe).toHaveAttribute('data-longitude', '-180');
  await expect(page.locator('tbody tr')).toHaveCount(377);
  const textColour = await page
    .locator('body')
    .evaluate((element) => getComputedStyle(element).color);
  await expect(page.getByRole('link', { name: 'USGS snapshot source' })).toHaveCSS(
    'color',
    textColour,
  );
  await expect(globe.locator('[data-event-id]')).not.toHaveCount(0);
  await globe.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('dark-viewport.png') });
  const pixels = await globe.evaluate(async (element) => {
    const clone = element.cloneNode(true);
    if (!(clone instanceof SVGElement)) throw new Error('Missing SVG clone');
    clone.setAttribute('width', '600');
    clone.setAttribute('height', '600');
    const originals = [element, ...element.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    originals.forEach((node, index) => {
      const style = getComputedStyle(node);
      copies[index]?.setAttribute(
        'style',
        `fill:${style.fill};stroke:${style.stroke};stroke-width:${style.strokeWidth}`,
      );
    });
    const image = new Image();
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }),
    );
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('Missing raster context');
    context.drawImage(image, 0, 0, 600, 600);
    URL.revokeObjectURL(url);
    const data = context.getImageData(0, 0, 600, 600).data;
    let painted = 0;
    for (let index = 3; index < data.length; index += 4) if ((data[index] ?? 0) > 0) painted++;
    return painted;
  });
  expect(pixels).toBeGreaterThan(10000);
  const box = await globe.boundingBox();
  if (box === null) throw new Error('Missing globe bounds');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await expect(globe).not.toHaveAttribute('data-longitude', '-180');
  await globe.screenshot({ path: info.outputPath('rotated.png') });
  await page.getByRole('button', { name: 'Reset globe', exact: true }).click();
  await globe.focus();
  await page.keyboard.press('ArrowRight');
  await expect(globe).toHaveAttribute('data-longitude', '-165');
  await page.keyboard.press('Tab');
  await expect(globe).not.toBeFocused();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(globe).toHaveAttribute('data-zoom', '1.25');
  const row = page.getByRole('button', { name: /^Inspect / }).first();
  const id = (await row.getAttribute('aria-label'))?.slice(8);
  await row.click();
  await expect(page.getByRole('region', { name: 'Selected earthquake' })).not.toContainText(
    'No earthquake selected',
  );
  await expect(globe.locator(`[data-event-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reset globe', exact: true }).click();
  await expect(globe).toHaveAttribute('data-longitude', '-180');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect
    .poll(() =>
      page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe('rgb(245, 245, 248)');
  await globe.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('light-viewport.png') });
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(layout.scroll).toBeLessThanOrEqual(layout.width);
  await page.goto('/charts');
  await page.getByRole('link', { name: 'Earthquake Globe', exact: true }).click();
  await expect(globe).toHaveAttribute('data-longitude', '-180');
  await expect(globe).toHaveAttribute('data-zoom', '1');
  await expect(page.getByRole('region', { name: 'Selected earthquake' })).toContainText(
    'No earthquake selected',
  );
  expect(errors).toEqual([]);
  expect(outside).toEqual([]);
});

test('selected event feedback stays visible near the globe without moving keyboard focus', async ({
  page,
}, info) => {
  const errors = watchErrors(page);
  await page.goto('/earthquake-globe');
  const globe = page.getByRole('group', { name: 'Earthquake globe', exact: true });
  await expect(globe).toHaveAttribute('data-longitude', '-180');
  const marker = globe.getByRole('button', {
    name: 'Select earthquake aka2026ujebcw',
    exact: true,
  });
  await marker.focus();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Enter');
  await expect(marker).toBeFocused();
  await expect(marker).toHaveAttribute('aria-pressed', 'true');
  const details = page.getByRole('region', { name: 'Selected earthquake', exact: true });
  await expect(details).toHaveCount(1);
  await expect(details).toHaveAttribute('aria-live', 'polite');
  await expect(details).toHaveAttribute('aria-atomic', 'true');
  await expect(
    details.getByRole('heading', { name: '14 km ENE of Glacier View, Alaska' }),
  ).toBeInViewport({ ratio: 1 });
  await expect(details.getByText('Magnitude 2.9', { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(details.getByText('Depth 16.8 km', { exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  const provenance = page.getByRole('heading', { name: 'Recorded USGS M2.5+ / seven days' });
  const detailsBox = await details.boundingBox();
  const provenanceBox = await provenance.boundingBox();
  const globeBox = await globe.boundingBox();
  if (detailsBox === null || provenanceBox === null || globeBox === null)
    throw new Error('Missing feedback layout bounds');
  if (info.project.name === 'mobile') {
    expect(detailsBox.y).toBeLessThan(provenanceBox.y);
  } else {
    expect(detailsBox.x).toBeGreaterThan(globeBox.x + globeBox.width);
    expect(detailsBox.y).toBeGreaterThan(provenanceBox.y);
  }
  await page.screenshot({ path: info.outputPath('selected-feedback.png') });
  await page.getByRole('button', { name: 'Reset globe', exact: true }).click();
  await expect(details).toContainText('No earthquake selected');
  await expect(globe).toHaveAttribute('data-longitude', '-180');
  expect(errors).toEqual([]);
});

test('foreign browser pointer events cannot replace the active drag', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/earthquake-globe');
  const globe = page.getByRole('group', { name: 'Earthquake globe', exact: true });
  await expect(globe).toHaveAttribute('data-longitude', '-180');
  await globe.evaluate((element) => {
    const radius = (element.getBoundingClientRect().width * 260) / 600;
    const event = (type: string, pointerId: number, clientX = 0) =>
      element.dispatchEvent(new PointerEvent(type, { pointerId, clientX, clientY: 0, button: 0 }));
    event('pointerdown', 101);
    event('pointerdown', 102);
    event('pointermove', 102, radius);
    event('pointerup', 102);
    event('pointermove', 101, radius / 2);
    event('pointerup', 101);
  });
  await expect(globe).toHaveAttribute('data-longitude', '135');
  expect(errors).toEqual([]);
});

test('mobile emulated touch rotates through real browser pointer events', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'Touch qualification belongs to the mobile viewport');
  const errors = watchErrors(page);
  await page.goto('/earthquake-globe');
  const globe = page.getByRole('group', { name: 'Earthquake globe', exact: true });
  await expect(globe).toHaveAttribute('data-longitude', '-180');
  await globe.scrollIntoViewIfNeeded();
  const box = await globe.boundingBox();
  if (box === null) throw new Error('Missing touch bounds');
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + 45, y: y + 15, id: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(globe).not.toHaveAttribute('data-longitude', '-180');
  await globe.screenshot({ path: info.outputPath('touch-rotated.png') });
  await session.detach();
  expect(errors).toEqual([]);
});
