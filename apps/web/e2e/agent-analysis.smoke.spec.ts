import { expect, test } from '@playwright/test';

test('discoverable shell and genuinely retained Astro island', async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  const posts: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/agent-analysis'))
      posts.push(request.postData() ?? '');
  });
  const staticContext = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: 'http://127.0.0.1:4371',
  });
  const shell = await staticContext.newPage();
  await shell.goto('/agent-analysis');
  await expect(
    shell.getByRole('heading', { name: 'Service Incident Lab', exact: true }),
  ).toBeVisible();
  await expect(shell.locator('astro-island')).toHaveCount(1);
  await expect(shell.getByTestId('retained-host')).toHaveAttribute(
    'data-astro-transition-persist',
    'agent-analysis',
  );
  await expect(shell.locator('[data-testid="status"]')).toHaveCount(0);
  const uid = await shell.locator('astro-island').getAttribute('uid');
  const props = await shell.locator('astro-island').getAttribute('props');
  expect(uid).toBeTruthy();
  await shell.goto('/agent-analysis/retained');
  await expect(shell.locator('astro-island')).toHaveAttribute('uid', uid ?? '');
  await expect(shell.locator('astro-island')).toHaveAttribute('props', props ?? '');
  await expect(shell.getByTestId('retained-host')).toHaveAttribute(
    'data-astro-transition-persist',
    'agent-analysis',
  );
  await staticContext.close();

  await page.goto('/charts');
  await page.getByRole('link', { name: 'Service Incident Lab', exact: true }).click();
  await expect(page.getByTestId('status')).toHaveText('Idle');
  expect(posts).toHaveLength(0);
  await testInfo.attach('hydrated-host-evidence', {
    body: Buffer.from(
      JSON.stringify(
        await page.getByTestId('status').evaluate((element) => {
          const ancestors = [];
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            ancestors.push({
              tag: parent.tagName,
              attributes: Object.fromEntries(
                [...parent.attributes].map((attribute) => [attribute.name, attribute.value]),
              ),
            });
          }
          return {
            ancestors,
            identityHosts: [
              ...document.querySelectorAll(
                '[uid], [data-foldkit-island], [data-astro-transition-persist]',
              ),
            ].map((host) => ({
              tag: host.tagName,
              attributes: Object.fromEntries(
                [...host.attributes].map((attribute) => [attribute.name, attribute.value]),
              ),
            })),
          };
        }),
      ),
    ),
    contentType: 'application/json',
  });
  const host = page.getByRole('region', { name: 'Service analysis', exact: true });
  await expect(host).toHaveCount(1);
  const beforeUpdate = await host.evaluateHandle((element) => element);
  await page.locator('#agent-scenario').selectOption('slow');
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
  await expect(page.getByTestId('status')).toHaveText('Streaming');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  const api = page.locator('button[data-service-id="api"]');
  await api.focus();
  await api.press('Enter');
  await expect(api).toHaveAttribute('aria-pressed', 'true');
  await expect(api).toBeFocused();
  expect(await api.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  expect(
    await beforeUpdate.evaluate(
      (element) =>
        element.isConnected &&
        element === document.querySelector('section[aria-label="Service analysis"]'),
    ),
    'ordinary scenario, run and selection updates retain the rendered root',
  ).toBe(true);
  const instance = await host.evaluateHandle((element) => element);
  const wrapper = page.getByTestId('retained-host');
  await expect(wrapper).toHaveAttribute('data-astro-transition-persist', 'agent-analysis');
  const wrapperInstance = await wrapper.evaluateHandle((element) => element);
  const accepted = await page.getByTestId('accepted').textContent();
  await page.getByRole('link', { name: 'Retained analysis', exact: true }).click();
  await expect(page).toHaveURL(/\/agent-analysis\/retained\/?$/);
  await expect(page.getByTestId('host-variant')).toHaveText('Retained analysis');
  await testInfo.attach('post-swap-host-evidence', {
    body: Buffer.from(
      JSON.stringify({
        wrapperRetained: await wrapperInstance.evaluate(
          (element) =>
            element.isConnected &&
            element === document.querySelector('[data-testid="retained-host"]'),
        ),
        childConnected: await instance.evaluate((element) => element.isConnected),
        currentHost: await wrapper.evaluate((element) => element.outerHTML),
        currentStatus: await page.getByTestId('status').textContent(),
        currentAccepted: await page.getByTestId('accepted').textContent(),
        currentRows: await page.locator('tbody tr').count(),
        currentScenario: await page.locator('#agent-scenario').inputValue(),
        currentSelected: await page.locator('button[data-service-id][aria-pressed="true"]').count(),
        acceptedBeforeSwap: accepted,
        posts,
        errors,
      }),
    ),
    contentType: 'application/json',
  });
  expect(
    await wrapperInstance.evaluate(
      (element) =>
        element.isConnected && element === document.querySelector('[data-testid="retained-host"]'),
    ),
    'the Astro-owned persistence wrapper must retain its DOM identity',
  ).toBe(true);
  expect
    .soft(
      await instance.evaluate(
        (element) =>
          element.isConnected &&
          element === document.querySelector('section[aria-label="Service analysis"]'),
      ),
      'the actual hydrated host DOM instance must survive the Astro swap',
    )
    .toBe(true);
  await expect(page.getByTestId('status')).toHaveText('Streaming');
  await expect(api).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('status')).toHaveText('Streaming');
  await expect(page.getByTestId('accepted')).toHaveText(accepted ?? '');
  expect(posts).toHaveLength(1);
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('link', { name: 'Overview analysis', exact: true }).click();
  await expect(page.getByTestId('host-variant')).toHaveText('Overview analysis');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByTestId('status')).toHaveText('Cancelled');
  expect(posts).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('renders real service geometry, keyboard selection and responsive charts in both themes', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const posts: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/agent-analysis'))
      posts.push(request.postData() ?? '');
  });
  await page.goto('/agent-analysis');
  await expect(page.getByTestId('status')).toHaveText('Idle');
  expect(posts).toHaveLength(0);
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
  await expect(page.getByTestId('status')).toHaveText('Completed', { timeout: 10000 });
  await expect(page.locator('tbody tr')).toHaveCount(4);
  const api = page.locator('button[data-service-id="api"]');
  await api.focus();
  await api.press('Enter');
  await expect(api).toHaveAttribute('aria-pressed', 'true');
  await expect(api).toBeFocused();
  expect(await api.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await expect(page.getByTestId('accepted')).toHaveText('4');
  await expect(page.locator('svg .chart-point-series path')).toHaveCount(4);
  for (const path of await page
    .locator('svg .chart-point-series path')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('d')))) {
    expect(path).toBeTruthy();
    expect(path).not.toMatch(/NaN|Infinity/);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const bounds = await page
    .locator('[data-testid="chart-scroll"]')
    .evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(bounds.client).toBeGreaterThan(0);
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
  const tableBounds = await page
    .getByTestId('table-scroll')
    .evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  const marks = await page.locator('svg .chart-point-series path').evaluateAll((elements) =>
    elements.map((element) => ({
      path: element.getAttribute('d'),
      transform: element.getAttribute('transform'),
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right,
      top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom,
    })),
  );
  for (const mark of marks) {
    expect(mark.transform).not.toMatch(/NaN|Infinity/);
    expect(mark.width).toBeGreaterThan(0);
    expect(mark.height).toBeGreaterThan(0);
  }
  const chartBox = await page.locator('svg').boundingBox();
  expect(chartBox).not.toBeNull();
  for (const mark of marks) {
    expect(mark.left).toBeGreaterThanOrEqual(chartBox?.x ?? 0);
    expect(mark.right).toBeLessThanOrEqual((chartBox?.x ?? 0) + (chartBox?.width ?? 0));
    expect(mark.top).toBeGreaterThanOrEqual(chartBox?.y ?? 0);
    expect(mark.bottom).toBeLessThanOrEqual((chartBox?.y ?? 0) + (chartBox?.height ?? 0));
  }
  await testInfo.attach('geometry-scroll-evidence', {
    body: Buffer.from(
      JSON.stringify({
        marks,
        chart: bounds,
        table: tableBounds,
        documentWidth: await page.evaluate(() => document.documentElement.scrollWidth),
        viewport: testInfo.project.use.viewport,
      }),
    ),
    contentType: 'application/json',
  });
  await page.screenshot({
    path: testInfo.outputPath('chart-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 245, 248)');
  await page.screenshot({
    path: testInfo.outputPath('chart-light.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(tableBounds.scroll).toBeLessThanOrEqual(tableBounds.client + 1);
  await page.getByRole('button', { name: 'Core', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  expect(posts).toHaveLength(1);
  expect(errors).toEqual([]);
  const home = await page.request.get('/');
  const homeHtml = await home.text();
  expect(homeHtml).not.toContain('name="astro-view-transitions-enabled"');
  expect(homeHtml).not.toMatch(/<script[^>]+ClientRouter[^>]+type=script/);
});
