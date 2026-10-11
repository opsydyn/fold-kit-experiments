import { expect, test } from '@playwright/test';

test('incident comparison stays coherent after reorder in both themes', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const posts: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/agent-analysis'))
      posts.push(request.postData() ?? '');
  });
  await page.goto('/agent-analysis');
  await expect(
    page.getByRole('heading', { name: 'Service Incident Lab', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('status')).toHaveText('Idle');
  expect(posts).toHaveLength(0);
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
  await expect(page.getByTestId('status')).toHaveText('Completed', { timeout: 10000 });
  const api = page.locator('button[data-service-id="api"]');
  await api.focus();
  await api.press('Enter');
  await expect(api).toBeFocused();
  await expect(api).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('current-latency')).toContainText('145');
  await expect(page.getByTestId('baseline-latency')).toContainText('60');
  await expect(page.getByTestId('above-budget-count')).toContainText('3');
  await expect(page.getByTestId('accepted')).toHaveText('4');
  await expect(page.locator('svg [data-baseline="true"]')).toHaveCount(1);
  await expect(page.locator('svg [data-budget="true"]')).toHaveCount(1);
  await expect(page.locator('tbody tr[data-service-id="events"]')).toContainText('New');
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.locator('#theme-toggle').click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const chart = page.getByTestId('chart-scroll');
    expect(await chart.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    );
    await expect(page.getByTestId('current-latency')).toContainText('145');
    const overlaps = await page.locator('svg').evaluate((svg) => {
      const labels = [...svg.querySelectorAll('text')].map((element) => ({
        text: element.textContent,
        box: element.getBoundingClientRect(),
      }));
      return labels.flatMap((label, index) =>
        labels
          .slice(index + 1)
          .filter(
            (other) =>
              label.box.left < other.box.right - 1 &&
              label.box.right > other.box.left + 1 &&
              label.box.top < other.box.bottom - 1 &&
              label.box.bottom > other.box.top + 1,
          )
          .map((other) => [label.text, other.text]),
      );
    });
    expect(overlaps).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`incident-${theme}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.getByRole('button', { name: 'Core', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(api).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('current-latency')).toContainText('145');
  await expect(page.getByTestId('baseline-latency')).toContainText('60');
  expect(posts).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('unsafe patch stays out of measurements and restart establishes a fresh baseline', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const posts: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/agent-analysis'))
      posts.push(request.postData() ?? '');
  });
  await page.goto('/agent-analysis');
  await expect(page.getByTestId('status')).toHaveText('Idle');
  await page.locator('#agent-scenario').selectOption('invalid');
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  const api = page.locator('button[data-service-id="api"]');
  await api.focus();
  await api.press('Enter');
  await expect(page.getByTestId('status')).toHaveText('Failed', { timeout: 10000 });
  await expect(api).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rejected-update')).toContainText('999');
  await expect(page.getByTestId('current-latency')).toContainText('145');
  await expect(page.getByTestId('baseline-latency')).toContainText('60');
  await expect(page.locator('tbody')).not.toContainText('999');
  await expect(page.locator('svg')).not.toContainText('999');
  await expect(page.locator('svg g[data-latency]:has(path[aria-label^="API:"])')).toHaveAttribute(
    'data-latency',
    '145',
  );
  await expect(page.locator('tbody tr[data-service-id="api"] td').nth(1)).toHaveText('145ms');
  await expect(page.getByTestId('accepted')).toHaveText('2');
  await page.screenshot({
    path: testInfo.outputPath('rejected-update.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Restart analysis', exact: true }).click();
  await expect(page.getByTestId('status')).toHaveText('Completed', { timeout: 10000 });
  await expect(page.getByTestId('rejected-update')).toHaveCount(0);
  await expect(api).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('current-latency')).toContainText('145');
  await expect(page.getByTestId('baseline-latency')).toContainText('60');
  expect(posts).toHaveLength(2);
  expect(errors).toEqual([]);
});
