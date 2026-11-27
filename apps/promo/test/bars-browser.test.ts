/* oxlint-disable linteffect/no-try-catch -- Close the browser even when an expectation fails. */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { chromium, firefox, webkit } from 'playwright';

const base = process.env.PROMO_BASE_PATH ?? '/';
const origin = 'http://promo-bars.test';
const route = base + 'examples/bars/';
const output = join(import.meta.dir, '../dist');
const svgNamespace = 'http://www.w3.org/2000/svg';

for (const engine of [chromium, firefox, webkit]) {
  test.skipIf(process.env.PROMO_BARS_BROWSER !== '1')(
    `built Promo Bars adopts SSR, inspects with the keyboard and updates SVG paint and size in ${engine.name()}`,
    async () => {
      const browser = await engine.launch();
      try {
        const page = await browser.newPage({ viewport: { width: 940, height: 800 } });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript(() => {
          window.ResizeObserver = class extends window.ResizeObserver {
            private tracksChart = false;

            override observe(target: Element, options?: ResizeObserverOptions) {
              if (target.matches('.primitive-plot')) this.tracksChart = true;
              super.observe(target, options);
            }

            override disconnect() {
              super.disconnect();
              if (this.tracksChart) document.documentElement.dataset.barsObserver = 'disconnected';
            }
          };
        });
        const scripts = Promise.withResolvers<void>();
        await page.route(`${origin}/**`, async (request) => {
          if (request.request().resourceType() === 'script') await scripts.promise;
          const path = new URL(request.request().url()).pathname.slice(base.length);
          await request.fulfill({
            path: join(output, path, path.endsWith('/') ? 'index.html' : ''),
          });
        });

        await page.goto(origin + route, { waitUntil: 'commit' });
        const chart = page.getByRole('group', { name: 'Illustrative monthly activity by series' });
        const bar = chart.getByRole('img', { name: 'Jan, Core: 12' });
        const original = await chart.elementHandle();
        const originalBar = await bar.elementHandle();
        expect(await bar.locator('title').evaluate((node) => node.namespaceURI)).toBe(svgNamespace);
        scripts.resolve();

        const demo = page.locator('.primitive-demo');
        const island = page.locator('astro-island:not([ssr])');
        await island.waitFor({ state: 'attached' });
        const width = () => chart.evaluate((node: SVGSVGElement) => node.viewBox.baseVal.width);
        const waitForResize = (before: number) =>
          page.waitForFunction(
            (previous) =>
              document.querySelector<SVGSVGElement>('.primitive-plot svg')?.viewBox.baseVal
                .width !== previous,
            before,
          );
        await waitForResize(700);
        const wide = await width();
        await page.setViewportSize({ width: 440, height: 800 });
        await waitForResize(wide);
        const narrow = await width();
        expect(narrow).toBeLessThan(wide);
        expect(narrow).toBeGreaterThanOrEqual(220);
        expect(await chart.evaluate((node) => node.getBoundingClientRect().width)).toBeCloseTo(
          narrow,
          0,
        );

        await page.getByRole('button', { name: 'Reset' }).focus();
        await page.keyboard.press('Tab');
        await demo.getByText('Jan · Core: 12', { exact: true }).waitFor();
        expect(await bar.evaluate((node) => node === document.activeElement)).toBe(true);
        expect(await bar.getAttribute('stroke')).toBe('var(--text)');
        await chart.getByRole('img', { name: 'Jan, Tools: 31' }).hover();
        await demo.getByText('Jan · Tools: 31', { exact: true }).waitFor();

        const verticalHeight = await bar.getAttribute('height');
        for (const option of ['stacked', 'horizontal']) {
          const button = demo.getByRole('button', { name: option, exact: true });
          await button.press('Enter');
          await page.waitForFunction(
            (name) =>
              Array.from(document.querySelectorAll('.primitive-controls button')).some(
                (button) =>
                  button.textContent === name && button.getAttribute('aria-pressed') === 'true',
              ),
            option,
          );
        }
        expect(await bar.getAttribute('height')).not.toBe(verticalHeight);
        for (const paint of ['dots', 'hatch', 'gradient']) {
          const id = `bars-${paint}-0`;
          await demo.getByRole('button', { name: paint, exact: true }).press('Enter');
          await page.waitForFunction(
            (expected) =>
              document.querySelector('.primitive-plot rect[role="img"]')?.getAttribute('fill') ===
              expected,
            `url(#${id})`,
          );
          expect(await bar.evaluate((node) => getComputedStyle(node).fill)).toContain(`#${id}`);
          expect(await chart.locator(`#${id}`).evaluate((node) => node.namespaceURI)).toBe(
            svgNamespace,
          );
        }
        expect(await chart.locator('#bars-dots-0').getAttribute('patternUnits')).toBe(
          'userSpaceOnUse',
        );
        expect(await chart.locator('#bars-hatch-0').getAttribute('patternTransform')).toBe(
          'rotate(45)',
        );
        expect(
          await chart.locator('#bars-gradient-0 stop').first().getAttribute('stop-opacity'),
        ).toBe('0.35');

        await demo.getByRole('button', { name: 'Reset' }).press('Enter');
        await demo.getByText('No bar selected.', { exact: true }).waitFor();
        expect(await bar.getAttribute('fill')).toBe('var(--blue)');
        expect(await demo.getByRole('button', { name: 'grouped', pressed: true }).count()).toBe(1);
        expect(await demo.getByRole('button', { name: 'vertical', pressed: true }).count()).toBe(1);
        expect(await width()).toBe(narrow);
        expect(
          await original.evaluate((node) => node === document.querySelector('.primitive-plot svg')),
        ).toBe(true);
        expect(
          await originalBar.evaluate(
            (node) => node === document.querySelector('.primitive-plot rect[role="img"]'),
          ),
        ).toBe(true);
        await demo.getByText('View all data').press('Enter');
        expect(await demo.getByRole('table').getByRole('row').count()).toBe(13);
        await island.evaluate((node) => node.dispatchEvent(new Event('astro:unmount')));
        await page
          .locator('html[data-bars-observer="disconnected"]')
          .waitFor({ state: 'attached' });
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    },
    25_000,
  );
}
