import { createServer } from 'node:http';

import { defineConfig } from '@playwright/test';

// Fail before Astro can choose a fallback port or Playwright can reach another server.
if (process.env.TEST_WORKER_INDEX === undefined) {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(4371, '127.0.0.1', () => probe.close(() => resolve()));
  });
}

export default defineConfig({
  testDir: './e2e',
  reporter: [['list'], ['html', { open: 'never' }]],
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4371',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1365, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'bunx --no-install astro dev --host 127.0.0.1 --port 4371 --ignore-lock',
    env: { ASTRO_DEV_BACKGROUND: '1' },
    url: 'http://127.0.0.1:4371/agent-analysis',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
