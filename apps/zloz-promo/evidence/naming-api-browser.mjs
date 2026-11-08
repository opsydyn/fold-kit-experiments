import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const url = process.env.ZLOZ_API_REVIEW_URL ?? 'http://127.0.0.1:4331/';
const browser = await chromium.launch();
await (async () => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(url);
  await expect(page).toHaveTitle('Foldkit Zloz API');
  await expect(page.locator('body')).not.toContainText('FoldKit Flow API');
  await expect(page.getByRole('heading', { name: 'Foldkit Zloz public contract' })).toBeVisible();
  await page.screenshot({
    path: new URL('./naming-api-light.png', import.meta.url).pathname,
    fullPage: false,
  });
  for (const module of ['Core', 'FoldKit', 'ELK', 'Force', 'ForceEligibility', 'Mermaid']) {
    const response = await page.goto(new URL(`modules/${module}.html`, url).href);
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle(`${module} | Foldkit Zloz API`);
  }
  expect(errors).toEqual([]);
  await writeFile(
    new URL('./naming-api-browser.json', import.meta.url),
    JSON.stringify(
      { result: 'pass', url, title: 'Foldkit Zloz API', modules: 6, pageErrors: errors },
      null,
      2,
    ) + '\n',
  );
})().finally(() => browser.close());
