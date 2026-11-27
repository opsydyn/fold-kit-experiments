/* oxlint-disable linteffect/no-try-catch -- Release the browser even if a browser assertion fails. */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { strFromU8, unzipSync } from 'fflate';
import { chromium, firefox, webkit } from 'playwright';

const origin = 'http://histogram-promo.test';
const base = process.env.PROMO_BASE_PATH ?? '/';
const output = join(import.meta.dir, '../dist');

for (const engine of [chromium, firefox, webkit]) {
  test.skipIf(process.env.HISTOGRAM_BROWSER !== '1')(
    `built Promo Histogram hydrates, changes bins, focuses source and exports the selection in ${engine.name()}`,
    async () => {
      const browser = await engine.launch();
      const scripts = Promise.withResolvers<void>();
      const templateRequested = Promise.withResolvers<void>();
      const templateReleased = Promise.withResolvers<void>();
      try {
        const page = await browser.newPage({ acceptDownloads: true });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/*', async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== origin) {
            await route.abort();
            return;
          }
          if (request.resourceType() === 'script') await scripts.promise;
          if (url.pathname === base + 'downloads/histogram-template.json') {
            templateRequested.resolve();
            await templateReleased.promise;
          }
          const path = url.pathname.slice(base.length);
          await route.fulfill({ path: join(output, path, path.endsWith('/') ? 'index.html' : '') });
        });
        await page.goto(origin + base + 'examples/histogram/', { waitUntil: 'commit' });
        const island = page
          .locator('astro-island')
          .filter({ has: page.locator('.histogram-playground') });
        const slider = page.getByRole('slider', { name: /Number of bins/ });
        const original = await slider.elementHandle();
        const chart = page.getByRole('img', { name: /Illustrative histogram/ });
        const bars = chart.locator('.chart-bar-series rect');
        expect(await island.locator('[data-effect-ui-root]').count()).toBe(1);
        expect(await slider.inputValue()).toBe('5');
        expect(await bars.count()).toBe(5);
        scripts.resolve();
        await page.waitForFunction(
          () =>
            document
              .querySelector('.histogram-playground')
              ?.closest('astro-island')
              ?.hasAttribute('ssr') === false,
        );
        expect(
          await original.evaluate((node) => node === document.getElementById('histogram-bins')),
        ).toBe(true);

        await page.getByRole('button', { name: 'Clustered' }).press('Enter');
        await slider.press('ArrowRight');
        await bars.nth(5).waitFor({ state: 'attached' });
        expect(await slider.inputValue()).toBe('6');
        expect(
          await page.getByRole('button', { name: 'Clustered' }).getAttribute('aria-pressed'),
        ).toBe('true');
        const intervals = page
          .getByRole('list', { name: 'Bin intervals and counts' })
          .locator('strong');
        expect(await intervals.count()).toBe(6);
        expect(
          (await intervals.allTextContents()).map(Number).reduce((sum, count) => sum + count, 0),
        ).toBe(40);
        expect(await chart.locator('desc').evaluate((node) => node.namespaceURI)).toBe(
          'http://www.w3.org/2000/svg',
        );
        const selected = page.getByRole('combobox', { name: 'Source file' });
        await selected.selectOption('chart.ts');
        const sourceLink = page.getByRole('link', {
          name: 'Link to chart.ts, line 1',
          exact: true,
        });
        await sourceLink.click();
        await page.waitForFunction(() => document.activeElement?.id === 'source-chart.ts-L1');
        await selected.selectOption('settings.ts');
        await page
          .getByLabel('settings.ts source code')
          .filter({ hasText: /"binCount": 6/ })
          .waitFor();

        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download project' }).press('Enter');
        await templateRequested.promise;
        await page.getByRole('button', { name: 'Reset example' }).press('Enter');
        expect(await slider.inputValue()).toBe('5');
        expect(
          await page.getByRole('button', { name: 'Spread' }).getAttribute('aria-pressed'),
        ).toBe('true');
        templateReleased.resolve();
        const saved = await download;
        const path = await saved.path();
        if (!path) throw new Error('The Histogram ZIP was not written.');
        const files = unzipSync(new Uint8Array(await Bun.file(path).arrayBuffer()));
        const settings = files['src/settings.ts'];
        const manifest = files['package.json'];
        if (!settings || !manifest)
          throw new Error('The Histogram ZIP lacks its settings or manifest.');
        expect(strFromU8(settings)).toContain('"dataset": "clustered"');
        expect(strFromU8(settings)).toContain('"binCount": 6');
        expect(strFromU8(manifest)).toContain('"@effect/ui"');
        expect(strFromU8(manifest)).not.toContain('"foldkit"');
        expect(await slider.inputValue()).toBe('5');
        expect(errors).toEqual([]);
      } finally {
        scripts.resolve();
        templateReleased.resolve();
        await browser.close();
      }
    },
    25_000,
  );
}
