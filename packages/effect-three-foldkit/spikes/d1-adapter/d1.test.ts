import { expect, test } from 'bun:test';

import { chromium } from 'playwright';

const dist = new URL('./dist/', import.meta.url).pathname;

test('hybrid CustomElement + Mount adapter: update in place, typed events, release', async () => {
  const build = await Bun.build({
    entrypoints: [new URL('./index.html', import.meta.url).pathname],
    outdir: dist,
  });
  expect(build.success).toBe(true);
  const server = Bun.serve({
    port: 0,
    fetch: (req) =>
      new Response(Bun.file(dist + (new URL(req.url).pathname.slice(1) || 'index.html'))),
  });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: Array<string> = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => (m.type() === 'error' ? errors.push(m.text()) : undefined));
  await page.goto(`http://localhost:${server.port}/`);
  await page.waitForSelector('#scene');
  const log = (): Promise<Array<string>> =>
    page.evaluate(() => [...Reflect.get(globalThis, '__log')]);
  await page.waitForFunction(() => Reflect.get(globalThis, '__log').length > 0);
  await page.click('#color');
  await page.click('#color');
  await page.click('#scene');
  await page.waitForFunction(() => document.querySelector('#clicks')?.textContent === '1');
  await page.click('#visible');
  await page.waitForFunction(() => Reflect.get(globalThis, '__log').includes('release'));
  const final = await log();
  console.log({ final, errors });
  await browser.close();
  await server.stop();
  // Exactly one acquisition and one release across colour changes (update in place).
  expect(final.filter((l) => l.startsWith('mount:'))).toEqual(['mount:{"color":"red"}']);
  expect(final.at(-1)).toBe('release');
  // Foldkit re-sets the property with a fresh object on every render, including the
  // render caused by ClickedNode, so the runtime must dedupe structurally equal scenes.
  expect(final.filter((l) => l.startsWith('update:'))).toEqual([
    'update:blue',
    'update:red',
    'update:red',
  ]);
  expect(errors).toEqual([]);
}, 60_000);
