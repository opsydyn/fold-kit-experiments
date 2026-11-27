import { expect, test } from '@playwright/test';

test('hydrates accessible SVG, plays and inspects a trace, and reopens its shared link', async ({
  page,
  context,
}) => {
  await page.goto('/stateflow');
  const graph = page.getByRole('application', { name: 'Request diagnostics state graph' });
  const island = page.locator('astro-island').filter({ has: graph });
  await expect(island.locator('[data-effect-ui-root]')).toHaveCount(1);
  await expect(island).not.toHaveAttribute('ssr');
  await expect(graph.locator(':scope > title')).toHaveJSProperty(
    'namespaceURI',
    'http://www.w3.org/2000/svg',
  );
  await expect(graph.locator(':scope > desc')).toHaveJSProperty(
    'namespaceURI',
    'http://www.w3.org/2000/svg',
  );
  await expect(page.getByText('Current state: Loading')).toBeVisible();

  const ready = graph.getByRole('button', { name: 'Select state Ready' });
  await ready.focus();
  await page.keyboard.press('Space');
  await expect(ready).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Related events highlighted: Ready')).toBeVisible();

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByText('Outbound Port: emitted #8')).toBeVisible();
  await expect(page.getByText('Current state: Idle')).toBeVisible();
  const scrubber = page.getByRole('slider', { name: 'Replay position' });
  await scrubber.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(scrubber).toHaveValue('1');
  await expect(page.getByText('Current state: Ready')).toBeVisible();
  await page.getByRole('button', { name: 'Inspect event 1: LoadedMetrics' }).click();
  await expect(page.getByRole('region', { name: 'Selected trace inspector' })).toContainText(
    '"sequence": 1',
  );

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page).toHaveURL(/session=/);
  const shared = await context.newPage();
  await shared.goto(page.url());
  await expect(shared).toHaveTitle('Stateflow Observatory — Ready');
  await expect(shared.getByText('Playing a shared link.')).toBeVisible();
  await expect(shared.getByRole('slider', { name: 'Replay position' })).toHaveValue('1');
  await shared.close();

  await page.getByRole('combobox', { name: 'Machine' }).selectOption('checkout');
  await expect(page.getByRole('application', { name: 'Checkout state graph' })).toBeVisible();
  await expect(page.getByText('Unreachable: Refunded')).toBeVisible();
});

test('records native Request Diagnostics events across tabs and stops when live mode is off', async ({
  page,
  context,
}) => {
  await page.goto('/stateflow');
  const live = page.getByRole('button', { name: 'Listen live' });
  const island = page.locator('astro-island').filter({ has: live });
  await expect(island).toHaveCount(1);
  await expect(island).not.toHaveAttribute('ssr');
  await live.click();
  await expect(page.getByRole('button', { name: 'Listening' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const publisher = await context.newPage();
  await publisher.route('**/api/request-diagnostics', (route) =>
    route.fulfill({ json: [{ x: 42, y: 1, label: 'fixture' }] }),
  );
  await publisher.goto('/request-diagnostics');
  await expect(publisher.getByRole('status')).toContainText(/^Ready:/);
  await expect(page.getByText('Playing a recording.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Inspect event .*: LoadedMetrics/ })).toBeVisible();
  await expect(page.getByText('Current state: Ready')).toBeVisible();

  await page.getByRole('button', { name: 'Listening' }).click();
  await expect(live).toHaveAttribute('aria-pressed', 'false');
  const response = publisher.waitForResponse('**/api/request-diagnostics');
  await publisher.getByRole('button', { name: 'Reload metrics' }).click();
  await response;
  await expect(publisher.getByRole('status')).toContainText(/^Ready:/);
  await expect(page.getByRole('button', { name: /Inspect event .*: ClickedReload/ })).toHaveCount(
    0,
  );
  await publisher.close();
});
