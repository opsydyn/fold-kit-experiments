import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const base = process.env.ZLOZ_API_REVIEW_URL ?? 'http://127.0.0.1:4331/';
const browser = await chromium.launch();
await (async () => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(new URL('modules/CLI.html', base).href);
  await expect(page).toHaveTitle('CLI | Foldkit Zloz API');
  await expect(page.locator('body')).toContainText('CliResponse');
  await expect(page.locator('body')).toContainText('zlozCommand');
  await page.screenshot({
    path: new URL('./cli-api.png', import.meta.url).pathname,
    fullPage: false,
  });
  await page.getByRole('link', { name: 'run', exact: true }).first().click();
  await expect(page).toHaveTitle('run | Foldkit Zloz API');
  await expect(page.locator('body')).toContainText('platform services remain injectable');
  expect(errors).toEqual([]);
  await writeFile(
    new URL('./docs-browser.json', import.meta.url),
    JSON.stringify(
      {
        result: 'pass',
        base,
        title: 'CLI | Foldkit Zloz API',
        runnerContract: 'run | Foldkit Zloz API',
        pageErrors: errors,
      },
      null,
      2,
    ) + '\n',
  );
})().finally(() => browser.close());
