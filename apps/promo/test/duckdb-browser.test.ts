/* oxlint-disable linteffect/no-try-catch -- Close the browser even when assertions fail. */
import { expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

declare global {
  interface Window {
    duckdbWorkers: { opened: number; closed: number };
  }
}

const origin = 'http://duckdb-promo.test';
const base = process.env.PROMO_BASE_PATH ?? '/';
const output = join(import.meta.dir, '../dist');
const pinned = dirname(fileURLToPath(import.meta.resolve('@duckdb/duckdb-wasm')));
const cdn =
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/@duckdb\/duckdb-wasm@[^/]+\/dist\/(duckdb[-.][\w.-]+)$/;

test.skipIf(process.env.DUCKDB_BROWSER !== '1')(
  'built DuckDB keeps a worker across queries and releases it on island unmount',
  async () => {
    const browser = await chromium.launch();
    const scripts = Promise.withResolvers<void>();
    const workerRequested = Promise.withResolvers<void>();
    const allowWorker = Promise.withResolvers<void>();
    let holdWorker = false;
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(12_000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => {
        const NativeWorker = window.Worker;
        window.duckdbWorkers = { opened: 0, closed: 0 };
        class MeasuredWorker extends NativeWorker {
          constructor(url: string | URL, options?: WorkerOptions) {
            super(url, options);
            window.duckdbWorkers.opened += 1;
          }
          override terminate() {
            window.duckdbWorkers.closed += 1;
            return super.terminate();
          }
        }
        window.Worker = MeasuredWorker;
      });
      const context = page.context();
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const asset = cdn.exec(url.href)?.[1];
        if (asset !== undefined) {
          if (holdWorker && asset.endsWith('.worker.js')) {
            workerRequested.resolve();
            await allowWorker.promise;
            await route.abort();
            return;
          }
          await route.fulfill({
            path: join(pinned, asset),
            headers: { 'access-control-allow-origin': '*' },
          });
        } else if (url.origin === origin && url.pathname.startsWith(base)) {
          if (request.resourceType() === 'script') await scripts.promise;
          const path = url.pathname.slice(base.length);
          await route.fulfill({ path: join(output, path, path.endsWith('/') ? 'index.html' : '') });
        } else {
          await route.abort();
        }
      });
      await page.goto(origin + base + 'examples/duckdb/', { waitUntil: 'commit' });
      const load = page.getByRole('button', { name: 'Load DuckDB' });
      const original = await load.elementHandle();
      const island = page.locator('astro-island').filter({ has: load });
      expect(await island.locator('[data-effect-ui-root]').count()).toBe(1);
      scripts.resolve();
      await island.locator('[data-effect-ui-root]').waitFor();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('astro-island')].some(
          (host) => !host.hasAttribute('ssr') && host.textContent?.includes('Load DuckDB'),
        ),
      );
      expect(await original.evaluate((node) => node.isConnected)).toBe(true);
      const workers = () => page.evaluate(() => window.duckdbWorkers);
      expect(await workers()).toEqual({ opened: 0, closed: 0 });

      await load.click();
      const settled = page.getByText(/Binned 1,000,000 rows in DuckDB/);
      await settled.waitFor();
      expect(await page.locator('figure.plot svg').count()).toBe(2);
      await page
        .getByRole('group', { name: 'Bins', exact: true })
        .getByRole('button', { name: '20', exact: true })
        .click();
      await settled.waitFor();
      await page
        .getByRole('group', { name: 'Kind', exact: true })
        .getByRole('button', { name: 'read', exact: true })
        .click();
      await settled.waitFor();
      expect(
        await page.getByRole('button', { name: 'read', exact: true }).getAttribute('aria-pressed'),
      ).toBe('true');
      const statements = page
        .locator('details')
        .filter({ has: page.getByText(/The \d+ statements sent to DuckDB/) });
      await statements.locator('summary').click();
      expect(
        await statements
          .locator('pre')
          .filter({ hasText: /WHERE kind = 'read'/ })
          .count(),
      ).toBeGreaterThan(1);
      expect(await workers()).toEqual({ opened: 1, closed: 0 });
      const unmount = () =>
        page
          .locator('astro-island')
          .filter({ has: page.getByRole('group', { name: 'Bins', exact: true }) })
          .evaluate((host) => {
            host.remove();
            host.dispatchEvent(new Event('astro:unmount'));
          });
      await unmount();
      await page.waitForFunction(() => window.duckdbWorkers.closed === 1);

      // Abort a second startup while its worker script is still blocked.
      holdWorker = true;
      await page.reload();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('astro-island')].some(
          (host) => !host.hasAttribute('ssr') && host.textContent?.includes('Load DuckDB'),
        ),
      );
      await load.click();
      await workerRequested.promise;
      expect(await workers()).toEqual({ opened: 1, closed: 0 });
      await unmount();
      await page.waitForFunction(() => window.duckdbWorkers.closed === 1);
      allowWorker.resolve();
      expect(errors).toEqual([]);
    } finally {
      scripts.resolve();
      allowWorker.resolve();
      await browser.close();
    }
  },
  60_000,
);
