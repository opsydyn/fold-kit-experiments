/* oxlint-disable linteffect/no-try-catch -- Release browser resources even on test failure. */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { chromium, firefox, webkit } from 'playwright';

import { verifyDatasetSwitch } from './dataset-browser-scenario';

const base = process.env.PROMO_BASE_PATH ?? '/';
const promo = 'http://dataset-promo.test';
const web = process.env.DATASET_WEB_ORIGIN;
const promoDist = join(import.meta.dir, '../dist');

for (const engine of [chromium, firefox, webkit]) {
  test.skipIf(process.env.DATASET_BROWSER !== '1')(
    `built Promo retains out-of-order dataset responses in ${engine.name()}`,
    async () => {
      const browser = await engine.launch();
      try {
        const page = await browser.newPage();
        await page.route(`${promo}/**`, async (request) => {
          const path = new URL(request.request().url()).pathname.slice(base.length);
          await request.fulfill({
            path: join(promoDist, path, path.endsWith('/') ? 'index.html' : ''),
          });
        });
        await verifyDatasetSwitch(
          page,
          promo + base + 'examples/datasets/',
          (url) => url.pathname === base + 'datasets/coast.json',
        );
        const source = page.getByRole('combobox', { name: 'Source file' });
        await source.selectOption('snapshot.json');
        await page
          .getByLabel('snapshot.json', { exact: true })
          .filter({ hasText: /"revision": 6/ })
          .waitFor();
        await page
          .getByRole('link', { name: 'Link to snapshot.json, line 1', exact: true })
          .click();
        const line = page.locator('[id="source-snapshot.json-L1"]');
        await page.waitForFunction(() => document.activeElement?.id === 'source-snapshot.json-L1');
        expect(await line.count()).toBe(1);
      } finally {
        await browser.close();
      }
    },
    30_000,
  );
}

test.skipIf(!web)(
  'the maintained Web Dataset Explorer retains out-of-order responses from its API',
  async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await verifyDatasetSwitch(
        page,
        web + '/dataset-explorer',
        (url) => url.pathname === '/api/datasets' && url.searchParams.get('dataset') === 'coast',
      );
    } finally {
      await browser.close();
    }
  },
  30_000,
);
