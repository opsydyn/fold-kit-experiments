import { expect } from 'bun:test';

import type { Page } from 'playwright';

export async function verifyDatasetSwitch(page: Page, url: string, coast: (url: URL) => boolean) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const requested = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  let coastRequests = 0;
  await page.route(coast, async (route) => {
    coastRequests++;
    requested.resolve();
    await released.promise;
    await route.fallback();
  });

  await page.goto(url);
  const explorer = page.locator('.query-explorer');
  const chart = (station: string, revision: number) =>
    explorer.getByRole('img', {
      name: new RegExp(`Wind observations.*${station} station.*Snapshot ${revision}\\.`),
    });
  const select = (station: string) => explorer.getByRole('button', { name: station + ' station' });
  await chart('North', 1).waitFor();
  await select('Coastal').press('Enter');
  await requested.promise;
  await select('Upland').press('Enter');
  await chart('Upland', 3).waitFor();
  released.resolve();
  await explorer
    .locator('[data-outcome="accepted"]')
    .filter({ hasText: 'Coastal station · snapshot 2' })
    .waitFor();
  expect(await chart('Upland', 3).count()).toBe(1);
  expect(await select('Upland').getAttribute('aria-pressed')).toBe('true');
  await select('Coastal').press('Enter');
  await chart('Coastal', 2).waitFor();
  expect(coastRequests).toBe(1);
  const svg = chart('Coastal', 2);
  expect(await svg.locator('title').evaluate((node) => node.namespaceURI)).toBe(
    'http://www.w3.org/2000/svg',
  );
  expect(await svg.locator('desc').evaluate((node) => node.namespaceURI)).toBe(
    'http://www.w3.org/2000/svg',
  );
  expect(await explorer.getByRole('table').getByRole('row').count()).toBe(9);

  await explorer.getByRole('button', { name: 'Simulate failed refresh' }).press('Enter');
  await explorer
    .getByRole('alert')
    .filter({ hasText: 'Your last snapshot stays visible.' })
    .waitFor();
  expect(await chart('Coastal', 2).count()).toBe(1);
  await explorer.getByRole('button', { name: 'Run response race' }).press('Enter');
  await chart('Coastal', 6).waitFor();
  await explorer
    .locator('[data-outcome="ignored"]')
    .filter({ hasText: 'Coastal station · snapshot 5' })
    .waitFor();
  expect(await chart('Coastal', 6).count()).toBe(1);
  expect(errors).toEqual([]);
}
