import { defineConfig } from '@playwright/test';
type BrowserName = 'chromium' | 'firefox' | 'webkit';
const browsers: readonly BrowserName[] = ['chromium', 'firefox', 'webkit'];
const port = Number(process.env.ZLOZ_QUALIFICATION_PORT ?? '4388');
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
  throw new RangeError('Use a valid local qualification port.');
const previewUrl = `http://127.0.0.1:${port}`;
/** Built Zloz preview must already be running. See the release qualification runbook. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'zloz-native-release.spec.ts',
  workers: 1,
  timeout: 120000,
  reporter: [
    ['list'],
    ['json', { outputFile: '../../apps/zloz-demo/evidence/v3-completion/playwright-results.json' }],
  ],
  outputDir: '../../apps/zloz-demo/evidence/v3-completion/browser-artifacts',
  use: {
    baseURL: process.env.ZLOZ_QUALIFICATION_URL ?? previewUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.ZLOZ_QUALIFICATION_URL
    ? undefined
    : {
        command: `bun run --cwd ../zloz-demo preview --host 127.0.0.1 --port ${port} --ignore-lock`,
        url: `${previewUrl}/groups/`,
        reuseExistingServer: false,
        timeout: 60000,
      },
  projects: browsers.flatMap((browserName) => [
    {
      name: `${browserName}-desktop`,
      use: {
        browserName,
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: `${browserName}-mobile`,
      use: {
        browserName,
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
  ]),
});
