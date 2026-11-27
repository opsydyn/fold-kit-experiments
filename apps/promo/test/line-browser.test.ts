/* oxlint-disable linteffect/no-try-catch -- Close browsers even when assertions fail. */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { strFromU8, unzipSync } from 'fflate';
import { chromium, firefox, webkit } from 'playwright';

const origin = 'http://line-promo.test';
const base = process.env.PROMO_BASE_PATH ?? '/';
const output = join(import.meta.dir, '../dist');

for (const engine of [chromium, firefox, webkit]) {
  test.skipIf(process.env.LINE_BROWSER !== '1')(
    `built Promo Line adopts the chart and exports changed settings in ${engine.name()}`,
    async () => {
      const browser = await engine.launch();
      const scripts = Promise.withResolvers<void>();
      const editorRequested = Promise.withResolvers<void>();
      const editorReleased = Promise.withResolvers<void>();
      let testEditor = false;
      let editorRequests = 0;
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
          if (testEditor && url.pathname === base + 'downloads/line-template.json') {
            editorRequests += 1;
            editorRequested.resolve();
            await editorReleased.promise;
            await route.fulfill({ status: 503 });
            return;
          }
          const path = url.pathname.slice(base.length);
          await route.fulfill({ path: join(output, path, path.endsWith('/') ? 'index.html' : '') });
        });
        await page.goto(origin + base + 'examples/line/', { waitUntil: 'commit' });
        const chart = page.getByRole('img', { name: /Illustrative line chart/ });
        const original = await chart.elementHandle();
        expect(
          await page
            .locator(
              '.line-playground[data-effect-ui-root], [data-effect-ui-root] .line-playground',
            )
            .count(),
        ).toBe(1);
        expect(await chart.locator('.chart-line-series').count()).toBe(2);
        scripts.resolve();
        await page.waitForFunction(
          () =>
            document
              .querySelector('.line-playground')
              ?.closest('astro-island')
              ?.hasAttribute('ssr') === false,
        );
        expect(
          await original.evaluate(
            (node) => node === document.querySelector('.line-playground svg.chart-frame'),
          ),
        ).toBe(true);

        const step = page.getByRole('button', { name: 'Step', exact: true });
        const path = chart.locator('.chart-line-series').last();
        const before = await path.getAttribute('d');
        await step.press('Enter');
        expect(await step.getAttribute('aria-pressed')).toBe('true');
        expect(await path.getAttribute('d')).not.toBe(before);
        const slider = page.getByRole('slider', { name: /Y-axis maximum/ });
        await slider.press('ArrowRight');
        expect(await slider.inputValue()).toBe('110');
        await page.getByRole('combobox', { name: 'Source file' }).selectOption('chart.ts');
        await page.getByRole('link', { name: 'Link to chart.ts, line 1', exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.id === 'source-chart.ts-L1');
        expect(await chart.locator('desc').evaluate((node) => node.namespaceURI)).toBe(
          'http://www.w3.org/2000/svg',
        );

        const saving = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download project' }).press('Enter');
        const saved = await (await saving).path();
        if (!saved) throw new Error('The Line ZIP was not written.');
        const files = unzipSync(new Uint8Array(await Bun.file(saved).arrayBuffer()));
        const settings = files['src/settings.ts'];
        const manifest = files['package.json'];
        if (!settings || !manifest) throw new Error('The Line ZIP lacks settings or its manifest.');
        expect(strFromU8(settings)).toContain('"curve": "step"');
        expect(strFromU8(settings)).toContain('"yMax": 110');
        expect(strFromU8(manifest)).toContain('"@effect/ui"');
        expect(strFromU8(manifest)).not.toContain('"foldkit"');
        if (process.env.PUBLIC_EMBED_EDITOR === 'true') {
          testEditor = true;
          const controls = page.getByRole('tab', { name: 'Controls', exact: true });
          const edit = page.getByRole('tab', { name: 'Edit live' });
          await controls.press('End');
          await page.waitForFunction(() => document.activeElement?.id === 'line-tab-edit');
          await editorRequested.promise;
          const editor = page.locator('.line-editor-host');
          const originalEditor = await editor.elementHandle();
          await edit.press('Home');
          await page.waitForFunction(() => document.activeElement?.id === 'line-tab-controls');
          await controls.press('ArrowRight');
          await page.waitForFunction(() => document.activeElement?.id === 'line-tab-edit');
          expect(
            await originalEditor.evaluate(
              (node) => node === document.querySelector('.line-editor-host'),
            ),
          ).toBe(true);
          expect(editorRequests).toBe(1);
          editorReleased.resolve();
          await page
            .getByRole('status')
            .filter({ hasText: /editor could not connect/ })
            .waitFor();
          await page.getByRole('button', { name: 'Restart from controls' }).click();
          await page.waitForFunction((node) => !node.isConnected, originalEditor);
          await page
            .getByRole('status')
            .filter({ hasText: /editor could not connect/ })
            .waitFor();
          expect(editorRequests).toBe(2);
        }
        expect(errors).toEqual([]);
      } finally {
        scripts.resolve();
        editorReleased.resolve();
        await browser.close();
      }
    },
    25_000,
  );
}
