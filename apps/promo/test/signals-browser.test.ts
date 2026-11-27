/* oxlint-disable linteffect/no-try-catch -- Release the browser when an assertion fails. */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { chromium, firefox } from 'playwright';

const base = process.env.PROMO_BASE_PATH ?? '/';
const origin = 'http://promo-signals.test';
const output = join(import.meta.dir, '../dist');

for (const engine of [chromium, firefox]) {
  test.skipIf(process.env.PROMO_SIGNALS_BROWSER !== '1')(
    `built Signals adopts SVG, brushes, inspects by keyboard and restores event focus in ${engine.name()}`,
    async () => {
      const browser = await engine.launch();
      try {
        const page = await browser.newPage({ viewport: { width: 940, height: 800 } });
        page.setDefaultTimeout(6000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const scripts = Promise.withResolvers<void>();
        await page.route(`${origin}/**`, async (route) => {
          if (route.request().resourceType() === 'script') await scripts.promise;
          const path = new URL(route.request().url()).pathname.slice(base.length);
          await route.fulfill({ path: join(output, path, path.endsWith('/') ? 'index.html' : '') });
        });
        await page.goto(`${origin}${base}examples/signals/`, { waitUntil: 'commit' });
        const overview = page.locator('[data-chart-role="overview"] svg');
        const latency = page.locator('[data-chart-role="latency"] svg');
        const original = await overview.elementHandle();
        try {
          expect(await overview.locator('clipPath').evaluate((node) => node.namespaceURI)).toBe(
            'http://www.w3.org/2000/svg',
          );
          expect(await page.locator('[data-record-id]').count()).toBe(115);
        } finally {
          scripts.resolve();
        }
        await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
        await page
          .locator('[data-chart-role="overview"] .signal-input-status')
          .getByText('Drag a range · tap to inspect')
          .waitFor();
        expect(
          await original?.evaluate(
            (node) => node === document.querySelector('[data-chart-role="overview"] svg'),
          ),
        ).toBe(true);

        const target = overview.locator('[data-signal-gesture]');
        await target.scrollIntoViewIfNeeded();
        const box = await target.boundingBox();
        if (!box) throw new RangeError('Missing brush target');
        const y = box.y + box.height / 2;
        await page.mouse.move(box.x + box.width * 0.2, y);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.58, y, { steps: 6 });
        await page.mouse.up();
        await page
          .locator('.signal-view-state')
          .getByText(/Selection: .* → .*/)
          .waitFor();

        await latency.press('Home');
        await page
          .locator('.signal-inspector dd')
          .first()
          .getByText(/signal-/)
          .waitFor();
        await page.getByRole('button', { name: 'Pin inspection' }).click();
        await page.getByRole('button', { name: 'Capture baseline' }).click();
        await page
          .locator('.signal-comparison')
          .getByText(/Baseline source/)
          .waitFor();

        const disclosure = page.locator('.signal-event-browser');
        const summary = disclosure.locator('summary');
        await summary.click();
        await disclosure.getByRole('button', { name: /Select event event-gap:/ }).click();
        const announcement = page.locator('.signal-event-announcement');
        await announcement.getByText(/event-gap/).waitFor();
        await page.getByRole('button', { name: 'Clear event' }).press('Enter');
        await announcement.getByText('No event selected', { exact: true }).waitFor();
        expect(await summary.evaluate((node) => node === document.activeElement)).toBe(true);
        expect(await disclosure.getAttribute('open')).not.toBeNull();

        await page.setViewportSize({ width: 430, height: 820 });
        await page.waitForFunction(
          () =>
            Number(
              document
                .querySelector('[data-chart-role="latency"] svg')
                ?.getAttribute('viewBox')
                ?.split(' ')[2],
            ) < 500,
        );
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
}
