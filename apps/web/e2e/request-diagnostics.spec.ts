import { expect, test, type Page } from '@playwright/test';

const points = [
  { x: 45, y: 1, label: 'low' },
  { x: 120, y: 2, label: 'middle' },
  { x: 190, y: 3, label: 'upper' },
  { x: 280, y: 4, label: 'high' },
];

test('retains brushed metrics through an Astro swap and reports facts to the observatory', async ({
  page,
}) => {
  let requests = 0;
  await page.addInitScript(() => {
    const channel = new BroadcastChannel('foldkit-stateflow');
    const tags: string[] = [];
    channel.addEventListener('message', ({ data }) => {
      if (data?.specimen === 'request-diagnostics') {
        tags.push(JSON.parse(data.event)._tag);
        document.documentElement.setAttribute('data-observed-events', tags.join(' '));
      }
    });
  });
  await page.route('**/api/request-diagnostics', async (route) => {
    requests += 1;
    await route.fulfill({ json: points });
  });
  await page.goto('/request-diagnostics');
  const histogram = page.getByRole('application', { name: /Request latency distribution/ });
  const scatter = page.getByRole('application', { name: /Error rate by request latency/ });
  const status = page.getByRole('status');
  await expect(status).toContainText(/^Ready:/);
  await expect(
    page.locator('astro-island [data-effect-ui-root]').filter({ has: histogram }),
  ).toHaveCount(1);
  const original = await histogram.elementHandle();
  await expect(scatter.locator('.plot-mark circle')).toHaveCount(4);
  await histogram.scrollIntoViewIfNeeded();
  const box = await histogram.locator('svg').boundingBox();
  if (!box) throw new Error('Missing histogram bounds');
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.64, box.y + box.height * 0.55, { steps: 4 });
  await page.mouse.up();
  await expect(status).toContainText(/^Filtered:/);
  await expect(scatter.locator('.plot-mark circle')).toHaveCount(2);
  await expect(page.locator('html')).toHaveAttribute(
    'data-observed-events',
    /StartedSelection ChangedSelection/,
  );

  await page.getByRole('link', { name: 'Open nested route' }).click();
  await expect(page).toHaveURL(/\/request-diagnostics\/acme\/platform\/docs\/intro\.md$/);
  await expect(page.locator('[data-diagnostics-route]')).toContainText(
    'stayed /request-diagnostics/acme/platform/docs/intro.md from /request-diagnostics · acme/platform / docs/intro.md',
  );
  expect(
    await original.evaluate(
      (node) => node === document.querySelector('[aria-label^="Request latency distribution"]'),
    ),
  ).toBe(true);
  await expect(scatter.locator('.plot-mark circle')).toHaveCount(2);
  expect(requests).toBe(1);
});

async function holdFirstRequest(page: Page) {
  await page.addInitScript(() => {
    const fetch = window.fetch;
    Object.defineProperty(window, 'fetch', {
      value: (input: RequestInfo | URL, options?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input), location.href);
        if (url.pathname !== '/api/request-diagnostics') return fetch(input, options);
        const root = document.documentElement;
        const count = Number(root.dataset.metricsCalls ?? 0) + 1;
        root.dataset.metricsCalls = String(count);
        if (count > 1) {
          root.dataset.abortedBeforeReplacement = root.dataset.metricsAborted;
          return fetch(input, options);
        }
        const signal = options?.signal ?? (input instanceof Request ? input.signal : null);
        return new Promise<Response>((_, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              root.dataset.metricsAborted = 'true';
              sessionStorage.setItem('diagnosticsAbortObserved', 'yes');
              reject(signal.reason);
            },
            { once: true },
          );
        });
      },
    });
  });
  await page.route('**/api/request-diagnostics', (route) => route.fulfill({ json: points }));
}

test('reload aborts an in-flight request and uses the replacement response', async ({ page }) => {
  await holdFirstRequest(page);
  await page.goto('/request-diagnostics');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-metrics-calls', '1');
  await page.getByRole('button', { name: 'Reload metrics' }).click();
  await expect(page.getByRole('status')).toContainText(/^Ready:/);
  await expect(root).toHaveAttribute('data-metrics-calls', '2');
  await expect(root).toHaveAttribute('data-aborted-before-replacement', 'true');
});

test('leaving the route cancels metrics and reports the exit path', async ({ page, context }) => {
  await holdFirstRequest(page);
  const observer = await context.newPage();
  await observer.route('**/diagnostics-observer', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Observer</title>' }),
  );
  await observer.goto('/diagnostics-observer');
  await observer.evaluate(() => {
    const channel = new BroadcastChannel('foldkit-stateflow');
    channel.addEventListener('message', ({ data }) => {
      if (data?.specimen !== 'request-diagnostics') return;
      const event = JSON.parse(data.event);
      if (event._tag === 'Navigated' && event.phase === 'exited')
        document.documentElement.setAttribute('data-exit', data.event);
    });
  });
  await page.goto('/request-diagnostics');
  await expect(page.locator('html')).toHaveAttribute('data-metrics-calls', '1');
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('diagnosticsAbortObserved')))
    .toBe('yes');
  const exit = observer.locator('html');
  await expect(exit).toHaveAttribute('data-exit', /"phase":"exited"/);
  expect(JSON.parse((await exit.getAttribute('data-exit')) ?? 'null')).toMatchObject({
    _tag: 'Navigated',
    phase: 'exited',
    path: '/',
    previousPath: '/request-diagnostics',
  });
  await observer.close();
});
