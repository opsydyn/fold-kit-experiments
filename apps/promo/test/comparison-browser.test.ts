/* oxlint-disable linteffect/no-try-catch -- Release the browser even when assertions fail. */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { strFromU8, unzipSync } from 'fflate';
import { chromium, firefox } from 'playwright';

import { settingsPath } from '../src/examples/comparison/project';

const origin = 'http://comparison-promo.test';
const base = process.env.PROMO_BASE_PATH ?? '/';
const output = join(import.meta.dir, '../dist');
const sourceName = 'web/src/apps/comparison/workbench-state.ts';

for (const engine of [chromium, firefox]) {
  test.skipIf(process.env.COMPARISON_BROWSER !== '1')(
    `built Promo adopts Comparison, preserves focus, and exports live settings in ${engine.name()}`,
    async () => {
      const browser = await engine.launch();
      const scripts = Promise.withResolvers<void>();
      try {
        const page = await browser.newPage({ acceptDownloads: true });
        page.setDefaultTimeout(7000);
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
          const path = url.pathname.slice(base.length);
          await route.fulfill({ path: join(output, path, path.endsWith('/') ? 'index.html' : '') });
        });
        await page.goto(origin + base + 'examples/comparison/', { waitUntil: 'commit' });
        const chart = page.getByRole('application', { name: /^Histogram 2:/ });
        const original = await chart.elementHandle();
        const island = page.locator('astro-island').filter({ has: chart });
        expect(await island.locator('[data-effect-ui-root]').count()).toBe(1);
        scripts.resolve();
        await page.locator('astro-island:not([ssr]) .comparison-host').waitFor();
        expect(
          await original.evaluate(
            (node) =>
              node === document.querySelector('[aria-label="Histogram 2: salary distribution"]'),
          ),
        ).toBe(true);

        await chart.focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(
          () =>
            document.querySelector('.comparison-toolbar [aria-live]')?.textContent ===
            '2 matching points',
        );
        const move = page.getByRole('button', { name: 'Move Histogram 2 earlier' });
        await move.focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(
          () => document.querySelector('.comparison-panel h2')?.textContent === 'Histogram 2',
        );
        await page.waitForFunction(
          () => document.activeElement?.getAttribute('aria-label') === 'Move Histogram 2 earlier',
        );

        await page.evaluate((name) => {
          location.hash = 'source-' + name + '-L1';
        }, sourceName);
        await page.waitForFunction(
          (name) => document.activeElement?.id === 'source-' + name + '-L1',
          sourceName,
        );
        const source = page.getByLabel('Source file', { exact: true });
        expect(await source.inputValue()).toBe(sourceName);

        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download project' }).click();
        const downloaded = await download;
        const zipPath = await downloaded.path();
        expect(zipPath).not.toBeNull();
        const files = unzipSync(new Uint8Array(await Bun.file(zipPath ?? '').arrayBuffer()));
        const exported = files['src/' + settingsPath];
        expect(exported).toBeDefined();
        const settings = strFromU8(exported ?? new Uint8Array());
        expect(settings.indexOf('"id": 2')).toBeLessThan(settings.indexOf('"id": 1'));
        expect(settings).toContain('"nextPanelId": 3');
        expect(strFromU8(files['package.json'] ?? new Uint8Array())).toContain('"@effect/ui"');
        expect(errors).toEqual([]);
      } finally {
        scripts.resolve();
        await browser.close();
      }
    },
    45_000,
  );
}
