import { expect, test } from 'bun:test';

import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const dist = new URL('./dist/', import.meta.url).pathname;

test('deterministic WebGL screenshot under Bun + Playwright + SwiftShader', async () => {
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
  const browser = await chromium.launch({
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--force-device-scale-factor=1',
    ],
  });
  const shots: Array<Buffer> = [];
  const infos: Array<unknown> = [];
  for (const _ of [0, 1]) {
    const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
    await page.goto(`http://localhost:${server.port}/`);
    await page.waitForFunction(() => document.title === 'ready');
    shots.push(await page.locator('canvas').screenshot());
    infos.push(
      await page.evaluate(() => {
        const s = Reflect.get(globalThis, '__spike');
        const before = s.info();
        s.dispose();
        return { before, after: s.info() };
      }),
    );
    await page.close();
  }
  await browser.close();
  await server.stop();
  const [a, b] = shots.map((s) => PNG.sync.read(s));
  if (a === undefined || b === undefined) throw new Error('missing shot');
  const diff = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0 });
  const nonBlack = a.data.reduce((n, v, i) => (i % 4 !== 3 && v > 0 ? n + 1 : n), 0);
  console.log({ diff, nonBlack, infos: JSON.stringify(infos[0]) });
  expect(diff).toBe(0);
  expect(nonBlack).toBeGreaterThan(1000);
}, 60_000);
