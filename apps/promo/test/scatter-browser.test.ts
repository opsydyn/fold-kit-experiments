/* oxlint-disable linteffect/no-try-catch -- Release the browser even if a browser assertion fails. */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { strFromU8, unzipSync } from 'fflate';
import { chromium, firefox, webkit } from 'playwright';

const origin = 'http://scatter-promo.test';
const base = process.env.PROMO_BASE_PATH ?? '/';
const output = join(import.meta.dir, '../dist');

for (const engine of [chromium, firefox, webkit]) {
  test.skipIf(process.env.SCATTER_BROWSER !== '1')(
    `built Promo Scatter hydrates, inspects marks and exports the selection in ${engine.name()}`,
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
          if (url.pathname === base + 'downloads/scatter-template.json') {
            templateRequested.resolve();
            await templateReleased.promise;
          }
          const path = url.pathname.slice(base.length);
          await route.fulfill({ path: join(output, path, path.endsWith('/') ? 'index.html' : '') });
        });
        await page.goto(origin + base + 'examples/scatter/', { waitUntil: 'commit' });
        const island = page
          .locator('astro-island')
          .filter({ has: page.locator('.scatter-playground') });
        const chart = page.getByRole('img', { name: /Illustrative scatter plot/ });
        const original = await chart.elementHandle();
        expect(await island.locator('[data-effect-ui-root]').count()).toBe(1);
        expect(await chart.locator('[data-symbol]').count()).toBe(24);
        scripts.resolve();
        await page.waitForFunction(
          () =>
            document
              .querySelector('.scatter-playground')
              ?.closest('astro-island')
              ?.hasAttribute('ssr') === false,
        );
        expect(
          await original.evaluate(
            (node) => node === document.querySelector('.scatter-preview svg'),
          ),
        ).toBe(true);

        const picker = page.getByRole('combobox', { name: 'Inspect point' });
        await chart.press('Home');
        expect(await picker.inputValue()).toBe('a-01');
        await chart.press('Escape');
        expect(await picker.inputValue()).toBe('');
        const shortcuts = await chart.evaluate((node) =>
          (['ctrlKey', 'altKey', 'metaKey'] as const).map((modifier) =>
            node.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'Home',
                [modifier]: true,
                bubbles: true,
                cancelable: true,
              }),
            ),
          ),
        );
        expect(shortcuts).toEqual([true, true, true]);
        expect(await picker.inputValue()).toBe('');
        await chart.press('Tab');
        expect(await chart.evaluate((node) => node !== document.activeElement)).toBe(true);
        await page.getByRole('button', { name: 'Group B' }).press('Enter');
        expect(await chart.locator('[data-symbol="square"]').count()).toBe(12);
        const mark = chart.locator('[aria-label^="b-03, Group B"]');
        await mark.hover();
        expect(await picker.inputValue()).toBe('b-03');
        await chart.locator('.chart-tooltip').getByText('b-03 · Group B').waitFor();
        await picker.selectOption('b-04');
        await mark.click();
        expect(await picker.inputValue()).toBe('b-03');
        const domain = page.getByRole('slider', { name: /X domain maximum/ });
        const before = await mark.getAttribute('transform');
        await domain.press('ArrowRight');
        expect(await mark.getAttribute('transform')).not.toBe(before);
        const source = page.getByRole('combobox', { name: 'Source file' });
        await source.selectOption('chart.ts');
        await page.getByRole('link', { name: 'Link to chart.ts, line 1', exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.id === 'source-chart.ts-L1');
        await source.selectOption('settings.ts');
        await page
          .getByLabel('settings.ts source code')
          .filter({ hasText: /"selectedPoint": "b-03"/ })
          .waitFor();

        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download project' }).press('Enter');
        await templateRequested.promise;
        await page.getByRole('button', { name: 'Reset example' }).press('Enter');
        expect(await domain.inputValue()).toBe('100');
        expect(
          await page.getByRole('button', { name: 'All', exact: true }).getAttribute('aria-pressed'),
        ).toBe('true');
        templateReleased.resolve();
        const saved = await download;
        const path = await saved.path();
        if (!path) throw new Error('The Scatter ZIP was not written.');
        const files = unzipSync(new Uint8Array(await Bun.file(path).arrayBuffer()));
        const settings = files['src/settings.ts'];
        const manifest = files['package.json'];
        if (!settings || !manifest)
          throw new Error('The Scatter ZIP lacks its settings or manifest.');
        expect(strFromU8(settings)).toContain('"group": "b"');
        expect(strFromU8(settings)).toContain('"xMax": 110');
        expect(strFromU8(settings)).toContain('"selectedPoint": "b-03"');
        expect(strFromU8(manifest)).toContain('"@effect/ui"');
        expect(strFromU8(manifest)).not.toContain('"foldkit"');
        expect(await domain.inputValue()).toBe('100');
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
