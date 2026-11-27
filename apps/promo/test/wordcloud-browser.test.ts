/* oxlint-disable linteffect/no-try-catch -- Close browsers even when assertions fail. */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { chromium, firefox, webkit } from 'playwright';

const origin = 'http://wordcloud-promo.test';
const base = process.env.PROMO_BASE_PATH ?? '/';
const output = join(import.meta.dir, '../dist');

for (const engine of [chromium, firefox, webkit]) {
  test.skipIf(process.env.WORDCLOUD_BROWSER !== '1')(
    `built Promo Wordcloud adopts native controls and recovers from font failure in ${engine.name()}`,
    async () => {
      const browser = await engine.launch();
      const scripts = Promise.withResolvers<void>();
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript(() => {
          const loadFont = document.fonts.load.bind(document.fonts);
          let attempts = 0;
          Object.defineProperty(Object.getPrototypeOf(document.fonts), 'load', {
            configurable: true,
            value: (font: string) =>
              font.startsWith('600 ') && ++attempts === 1
                ? Promise.reject(new Error('Font measurement temporarily unavailable'))
                : loadFont(font),
          });
        });
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
        await page.goto(origin + base + 'examples/wordcloud/', { waitUntil: 'commit' });
        const demo = page.locator('.primitive-demo');
        const reset = demo.getByRole('button', { name: 'Reset', exact: true });
        const original = await reset.elementHandle();
        expect(
          await page
            .locator('.primitive-demo[data-effect-ui-root], [data-effect-ui-root] .primitive-demo')
            .count(),
        ).toBe(1);
        await demo.getByText('Measuring text…', { exact: true }).waitFor();
        await demo.getByText('View all data', { exact: true }).click();
        await page.getByRole('table', { name: 'Illustrative vocabulary weights' }).waitFor();
        scripts.resolve();
        await page
          .getByRole('alert')
          .filter({ hasText: /Could not measure this font/ })
          .waitFor();
        expect(
          await original.evaluate(
            (node) =>
              node ===
              [...document.querySelectorAll('.primitive-demo button')].find(
                (button) => button.textContent === 'Reset',
              ),
          ),
        ).toBe(true);
        await page.getByRole('button', { name: 'Retry measurement' }).click();

        const chart = page.getByRole('img', { name: /Illustrative visualisation vocabulary/ });
        await chart.waitFor();
        expect(await chart.locator('desc').evaluate((node) => node.namespaceURI)).toBe(
          'http://www.w3.org/2000/svg',
        );
        const firstWord = chart.locator('.cloud-word').first();
        const firstLabel = await firstWord.getAttribute('aria-label');
        if (!firstLabel) throw new Error('The first measured word has no accessible label.');
        const firstText = firstLabel.replace(': weight ', ' · weight ');
        await firstWord.focus();
        await demo.getByText(firstText, { exact: true }).waitFor();
        const rotation = page.getByRole('checkbox', { name: 'Rotate words' });
        await rotation.check();
        expect(await chart.locator('g[transform$="rotate(90)"]').count()).toBeGreaterThan(0);
        await page.getByRole('button', { name: 'monospace' }).click();
        await chart.locator('.cloud-word[font-family="monospace"]').first().waitFor();
        await reset.click();
        await chart.locator('.cloud-word[font-family*="Inter Variable"]').first().waitFor();
        expect(await rotation.isChecked()).toBe(false);
        expect(errors).toEqual([]);
      } finally {
        scripts.resolve();
        await browser.close();
      }
    },
    25_000,
  );
}
