/* oxlint-disable linteffect/no-try-catch -- Release browser and held routes on test failure. */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { chromium, firefox, webkit } from 'playwright';

const origin = 'http://dataset-launcher.test';
const base = process.env.PROMO_BASE_PATH ?? '/';
const output = join(import.meta.dir, '../dist');
const template = base + 'downloads/dataset-template.json';
const editorTitle = 'Dataset code editor and chart preview';

// The installed SDK still creates the actual iframe, posts the project and opens its message port.
const editorDocument = `<!doctype html><title>Editor fixture</title>
  <input aria-label="Local edit">
  <script>
    addEventListener('message', ({ data, source }) => {
      if (data?.action !== 'SDK_INIT') return;
      const channel = new MessageChannel();
      source.postMessage({ action: 'SDK_INIT_SUCCESS', id: data.id, payload: { origin: location.origin } }, '*', [channel.port2]);
    }, { once: true });
  </script>`;

for (const engine of [chromium, firefox, webkit]) {
  test.skipIf(process.env.DATASET_LAUNCHER_BROWSER !== '1')(
    `built Promo preserves, replaces and aborts editor sessions in ${engine.name()}`,
    async () => {
      const browser = await engine.launch();
      const scripts = Promise.withResolvers<void>();
      const pending = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await page.addInitScript((templatePath) => {
          const fetch = window.fetch;
          const observedFetch = (input: RequestInfo | URL, options?: RequestInit) => {
            const value = new URL(
              input instanceof Request ? input.url : String(input),
              location.href,
            );
            if (value.pathname === templatePath) {
              document.documentElement.dataset.editorRequest = 'pending';
              const signal =
                options?.signal ?? (input instanceof Request ? input.signal : undefined);
              signal?.addEventListener(
                'abort',
                () => {
                  document.documentElement.dataset.editorRequest = 'aborted';
                },
                { once: true },
              );
            }
            return fetch(input, options);
          };
          window.fetch = Object.assign(observedFetch, { preconnect: fetch.preconnect });
        }, template);
        let templateRequests = 0;
        const submissions: Array<string | null> = [];
        await page.route('**/*', async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin === 'https://stackblitz.com' && url.pathname === '/run') {
            submissions.push(request.postData());
            await route.fulfill({ contentType: 'text/html', body: editorDocument });
            return;
          }
          if (url.origin !== origin) {
            await route.abort();
            return;
          }
          if (request.resourceType() === 'script') await scripts.promise;
          if (url.pathname === template) {
            templateRequests++;
            if (templateRequests === 2) {
              await route.fulfill({ status: 503, body: 'Unavailable' });
              return;
            }
            if (templateRequests === 4) {
              pending.resolve();
              await release.promise;
              await route.abort();
              return;
            }
          }
          const path = url.pathname.slice(base.length);
          await route.fulfill({ path: join(output, path, path.endsWith('/') ? 'index.html' : '') });
        });

        await page.goto(origin + base + 'examples/datasets/', { waitUntil: 'commit' });
        const launcher = page.locator('.dataset-launcher');
        const open = launcher.getByRole('button', { name: 'Edit live' });
        const button = await open.elementHandle();
        const island = page.locator('astro-island').filter({ has: launcher });
        expect(await island.locator('[data-effect-ui-root]').count()).toBe(1);
        expect(
          await launcher
            .getByRole('link', { name: /Download standalone project/ })
            .getAttribute('href'),
        ).toBe(base + 'downloads/dataset-explorer.zip');
        expect(await launcher.locator('iframe').count()).toBe(0);
        expect(templateRequests).toBe(0);
        scripts.resolve();
        await island.locator('button').first().waitFor();
        await page.waitForFunction(
          () =>
            document
              .querySelector('.dataset-launcher')
              ?.closest('astro-island')
              ?.hasAttribute('ssr') === false,
        );
        expect(await button.evaluate((node) => node.isConnected)).toBe(true);
        await open.press('Enter');
        const iframe = launcher.locator(`iframe[title="${editorTitle}"]`);
        const status = launcher.getByRole('status').filter({ hasText: 'Editor connected.' });
        await status.waitFor();
        const first = await iframe.elementHandle();
        const edit = page
          .frameLocator(`iframe[title="${editorTitle}"]`)
          .getByRole('textbox', { name: 'Local edit' });
        expect(await iframe.getAttribute('allow')).toContain(
          'cross-origin-isolated https://stackblitz.com',
        );
        await edit.fill('retained edit');
        await launcher.getByRole('button', { name: 'Close editor' }).press('Enter');
        await iframe.waitFor({ state: 'hidden' });
        expect(await first.evaluate((node) => node.isConnected)).toBe(true);
        await open.press('Enter');
        await iframe.waitFor();
        expect(await edit.inputValue()).toBe('retained edit');
        expect(templateRequests).toBe(1);

        await launcher.getByRole('button', { name: 'Restart starter' }).press('Enter');
        const retry = launcher.getByRole('button', { name: 'Retry editor' });
        await retry.waitFor();
        expect(await first.evaluate((node) => node.isConnected)).toBe(false);
        expect(await iframe.count()).toBe(0);
        await retry.press('Enter');
        await status.waitFor();
        expect(await edit.inputValue()).toBe('');
        expect(submissions).toHaveLength(2);
        expect(new URLSearchParams(submissions[1] ?? '').get('project[template]')).toBe('node');

        const connected = await iframe.elementHandle();
        await island.evaluate((node) => node.dispatchEvent(new Event('astro:unmount')));
        await iframe.waitFor({ state: 'detached' });
        await page.waitForFunction((node) => node.parentElement === null, connected);
        expect(await connected.evaluate((node) => node.isConnected)).toBe(false);
        expect(await page.locator('.query-explorer').isVisible()).toBe(true);

        await page.reload();
        await page.waitForFunction(
          () =>
            document
              .querySelector('.dataset-launcher')
              ?.closest('astro-island')
              ?.hasAttribute('ssr') === false,
        );
        await open.press('Enter');
        await pending.promise;
        expect(await page.locator('html').getAttribute('data-editor-request')).toBe('pending');
        await island.evaluate((node) => node.dispatchEvent(new Event('astro:unmount')));
        await page.locator('html[data-editor-request="aborted"]').waitFor({ state: 'attached' });
        expect(await iframe.count()).toBe(0);
        expect(submissions).toHaveLength(2);
        expect(pageErrors).toEqual([]);
      } finally {
        scripts.resolve();
        release.resolve();
        await browser.close();
      }
    },
    20_000,
  );
}
