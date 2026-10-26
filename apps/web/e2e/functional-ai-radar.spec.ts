import { categoryLabels, ringLabels } from '@opsydyn/effect-three-samples/radar/data';
import { demoRadar } from '@opsydyn/effect-three-samples/radar/fixture';
/* Browser callbacks return measurements, not Effect transitions. */
/* oxlint-disable linteffect/no-return-in-arrow */
import { expect, test, type Page } from '@playwright/test';

const radar = (page: Page) =>
  page.getByRole('group', { name: 'Functional and AI radar', exact: true });
function watch(page: Page) {
  const errors: string[] = [];
  const outside: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') outside.push(url.href);
  });
  return { errors, outside };
}
async function expectFiltered(page: Page, ids: ReadonlyArray<string>) {
  await expect(page.locator('[data-entry-id]')).toHaveCount(ids.length);
  const rows = await page
    .locator('[data-entry-id]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-entry-id')));
  expect(rows.sort()).toEqual([...ids].sort());
  const markers = await radar(page)
    .locator('[data-blip-id]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-blip-id')));
  for (const id of markers) expect(ids).toContain(id);
  await expect(page.locator('caption')).toHaveText(
    `${ids.length} matching ${ids.length === 1 ? 'technology' : 'technologies'}`,
  );
}

test('all 32 technologies remain reachable and filtering never introduces phantom markers', async ({
  page,
}) => {
  const observations = watch(page);
  await page.goto('/functional-ai-radar');
  await expect(radar(page)).toHaveAttribute('data-longitude', '0');
  await expect(
    page.getByText(/Original demo dataset - placements are illustrative, not adoption advice/),
  ).toBeVisible();
  await expect(radar(page).locator('[data-shell]')).toHaveCount(4);
  await expectFiltered(
    page,
    demoRadar.entries.map(({ id }) => id),
  );
  expect(await radar(page).locator('[data-blip-id]').count()).toBeLessThan(32);
  const details = page.getByRole('region', { name: 'Selected technology' });
  for (const entry of demoRadar.entries) {
    await page.getByRole('button', { name: `Inspect ${entry.name}`, exact: true }).click();
    await expect(details.locator('[data-summary-name]')).toHaveText(entry.name);
    await expect(details.locator('[data-summary-category]')).toHaveText(
      categoryLabels[entry.category],
    );
    await expect(details.locator('[data-summary-ring]')).toHaveText(ringLabels[entry.ring]);
    await expect(radar(page).locator(`[data-blip-id="${entry.id}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(details.getByRole('link', { name: 'Project source' })).toHaveAttribute(
      'href',
      entry.sourceUrl,
    );
  }
  await page.getByRole('searchbox', { name: 'Search technologies' }).fill('  unison  ');
  await expectFiltered(page, ['unison', 'unison-cloud']);
  await expect(details).toContainText('Selection cleared by filters');
  await page.getByRole('combobox', { name: 'Category' }).selectOption('platforms');
  await expectFiltered(page, ['unison-cloud']);
  await expect(radar(page)).toHaveAttribute('data-longitude', '45');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(radar(page)).toHaveAttribute('data-longitude', '45');
  await expect(details).toContainText('Selection cleared by filters');
  const checkboxes = page.getByRole('checkbox');
  for (let i = 0; i < 4; i++) await checkboxes.nth(i).uncheck();
  await expectFiltered(page, []);
  await expect(radar(page).locator('[data-blip-id]')).toHaveCount(0);
  await expect(page.getByText('No matching technologies', { exact: true })).toBeVisible();
  await expect(radar(page).locator('[data-shell]')).toHaveCount(4);
  await expect(page.getByRole('checkbox', { name: 'Adopt (8)' })).not.toBeChecked();
  expect(observations).toEqual({ errors: [], outside: [] });
});

test('marker selection keeps compact feedback visible and keyboard focus local', async ({
  page,
}, info) => {
  const observations = watch(page);
  await page.goto('/functional-ai-radar');
  const globe = radar(page);
  await expect(globe).toHaveAttribute('data-longitude', '0');
  const id = await globe.locator('[data-blip-id]').first().getAttribute('data-blip-id');
  const marker = globe.locator(`[data-blip-id="${id}"]`);
  const entry = demoRadar.entries.find((item) => item.id === id);
  if (!entry) throw new Error('Marker identity absent from demo fixture');
  await marker.focus();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Enter');
  await expect(marker).toBeFocused();
  await expect(marker).toHaveAttribute('aria-pressed', 'true');
  await expect(globe).toHaveAttribute('data-longitude', '0');
  await expect(globe).toHaveAttribute('data-latitude', '20');
  const details = page.getByRole('region', { name: 'Selected technology' });
  await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
  await expect(details).toHaveAttribute('aria-atomic', 'true');
  for (const attribute of ['name', 'category', 'ring'])
    await expect(details.locator(`[data-summary-${attribute}]`)).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await page.keyboard.press('ArrowRight');
  await expect(marker).toBeFocused();
  await expect(globe).toHaveAttribute('data-longitude', '0');
  await page.keyboard.press('Space');
  await expect(marker).toHaveAttribute('aria-pressed', 'true');
  await expect(globe.locator('[data-selected-paint-id]')).toHaveAttribute(
    'data-selected-paint-id',
    id ?? 'missing',
  );
  await page.screenshot({ path: info.outputPath('selected-feedback.png') });
  const link = details.getByRole('link', { name: 'Project source' });
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveCSS(
    'color',
    await page.locator('body').evaluate((element) => getComputedStyle(element).color),
  );
  await globe.focus();
  await page.keyboard.press('ArrowRight');
  await expect(globe).toHaveAttribute('data-longitude', '15');
  const prevented = await globe.evaluate((element) =>
    [
      { key: '+', ctrlKey: true },
      { key: '-', metaKey: true },
      { key: 'ArrowLeft', altKey: true },
    ].map((options) => {
      const event = new KeyboardEvent('keydown', { ...options, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  );
  expect(prevented).toEqual([false, false, false]);
  await expect(globe).toHaveAttribute('data-longitude', '15');
  await expect(globe).toHaveAttribute('data-zoom', '1');
  const search = page.getByRole('searchbox', { name: 'Search technologies' });
  await search.fill(entry.name);
  await search.press('Home');
  await search.press('ArrowRight');
  await expect(globe).toHaveAttribute('data-longitude', '15');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  const adopt = page.getByRole('checkbox', { name: 'Adopt (8)', exact: true });
  await adopt.focus();
  await page.keyboard.press('Space');
  await expect(adopt).not.toBeChecked();
  await expectFiltered(
    page,
    demoRadar.entries.filter(({ ring }) => ring !== 'adopt').map(({ id }) => id),
  );
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(globe).toHaveAttribute('data-longitude', '0');
  await expect(globe.locator('[data-shell-outline]')).toHaveCount(4);
  expect(
    await globe
      .locator('[data-shell-outline]')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('r')))),
  ).toEqual([104, 156, 208, 260]);
  await expect(adopt).not.toBeChecked();
  expect(observations).toEqual({ errors: [], outside: [] });
});

test('wireframe raster, dark and light layouts, zoom and re-entry remain sound', async ({
  page,
}, info) => {
  const observations = watch(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/functional-ai-radar');
  const globe = radar(page);
  await expect(globe).toHaveAttribute('data-longitude', '0');
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
        `fill:${style.fill};stroke:${style.stroke};stroke-width:${style.strokeWidth};stroke-opacity:${style.strokeOpacity};font-size:${style.fontSize};font-family:${style.fontFamily};font-weight:${style.fontWeight}`,
      );
    });
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }),
    );
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Missing canvas context');
    context.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    const data = context.getImageData(0, 0, 600, 600).data;
    let painted = 0;
    let coloured = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i + 3] ?? 0) > 0) painted++;
      if (
        (data[i + 3] ?? 0) > 200 &&
        Math.max(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) -
          Math.min(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) >
          50
      )
        coloured++;
    }
    return { painted, coloured };
  });
  expect(pixels.painted).toBeGreaterThan(12000);
  expect(pixels.coloured).toBeGreaterThan(2000);
  await info.attach('radar-raster-counts', {
    // Playwright's artifact boundary stores measured pixels, not application state.
    // oxlint-disable-next-line linteffect/no-naked-object-state-update
    body: JSON.stringify(pixels),
    contentType: 'application/json',
  });
  await globe.screenshot({ path: info.outputPath('scene-before.png') });
  const pathsBefore = await globe
    .locator('path')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')).join(''));
  await page.getByRole('button', { name: 'Turn east', exact: true }).click();
  await expect(globe).toHaveAttribute('data-longitude', '15');
  const pathsAfter = await globe
    .locator('path')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')).join(''));
  expect(pathsAfter).not.toBe(pathsBefore);
  await globe.screenshot({ path: info.outputPath('scene-after.png') });
  for (let i = 0; i < 6; i++)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(globe).toHaveAttribute('data-zoom', '2');
  for (let i = 0; i < 7; i++)
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(globe).toHaveAttribute('data-zoom', '1');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 245, 248)');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('light-viewport.png') });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('narrow-viewport.png') });
  await page.goto('/charts');
  await page.getByRole('link', { name: 'Functional & AI Radar', exact: true }).click();
  await expect(globe).toHaveAttribute('data-longitude', '0');
  await expect(globe).toHaveAttribute('data-zoom', '1');
  await expect(page.getByRole('region', { name: 'Selected technology' })).toContainText(
    'No technology selected',
  );
  await expectFiltered(
    page,
    demoRadar.entries.map(({ id }) => id),
  );
  await globe.focus();
  await page.keyboard.press('ArrowRight');
  await expect(globe).toHaveAttribute('data-longitude', '15');
  expect(observations).toEqual({ errors: [], outside: [] });
});

test('mouse drag and foreign/cancelled pointers preserve identity and suppress a trailing selection', async ({
  page,
}) => {
  const observations = watch(page);
  await page.goto('/functional-ai-radar');
  const globe = radar(page);
  await expect(globe).toHaveAttribute('data-longitude', '0');
  await globe.scrollIntoViewIfNeeded();
  const box = await globe.boundingBox();
  if (!box) throw new Error('Missing scene bounds');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 15, { steps: 4 });
  await page.mouse.up();
  await expect(globe).not.toHaveAttribute('data-longitude', '0');
  await expect(page.getByRole('region', { name: 'Selected technology' })).toContainText(
    'No technology selected',
  );
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await globe.evaluate((element) => {
    const radius = (element.getBoundingClientRect().width * 260) / 600;
    const send = (type: string, pointerId: number, clientX = 0) =>
      element.dispatchEvent(new PointerEvent(type, { pointerId, clientX, clientY: 0, button: 0 }));
    send('pointerdown', 101);
    send('pointerdown', 102);
    send('pointermove', 102, radius);
    send('pointerup', 102);
    send('pointermove', 101, radius / 2);
    send('pointercancel', 101);
    send('pointermove', 101, radius);
    element
      .querySelector('[data-blip-id]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(globe).toHaveAttribute('data-longitude', '-45');
  await expect(page.getByRole('region', { name: 'Selected technology' })).toContainText(
    'No technology selected',
  );
  await globe.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 200, clientX: 0, clientY: 0, button: 0 }),
    );
    element.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 200 }));
    element.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 200, clientX: 100, clientY: 0 }),
    );
  });
  await expect(globe).toHaveAttribute('data-longitude', '-45');
  expect(observations).toEqual({ errors: [], outside: [] });
});

test('genuine Chromium-emulated touch rotates on the mobile viewport', async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== 'mobile',
    'Touch qualification belongs to mobile; desktop mouse is separately exercised',
  );
  const observations = watch(page);
  await page.goto('/functional-ai-radar');
  const globe = radar(page);
  await expect(globe).toHaveAttribute('data-longitude', '0');
  await globe.scrollIntoViewIfNeeded();
  const box = await globe.boundingBox();
  if (!box) throw new Error('Missing touch scene bounds');
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
  await expect(globe).not.toHaveAttribute('data-longitude', '0');
  await expect(page.getByRole('region', { name: 'Selected technology' })).toContainText(
    'No technology selected',
  );
  await globe.screenshot({ path: info.outputPath('touch-rotated.png') });
  await session.detach();
  expect(observations).toEqual({ errors: [], outside: [] });
});
