/**
 * Builds the spike page, serves it on localhost (WebGPU needs a secure context), and opens
 * it in headless Chromium with SwiftShader's WebGPU adapter, as the e2e tests do; saves a
 * screenshot and prints what the page reports.
 *
 *   bun spikes/tsl-labels/run.ts [screenshot.png] [?text=…&size=…|?direct]
 */
// The spike borrows the adapter package's Playwright (its browser tests install it).
import { chromium } from '../../../effect-three-foldkit/node_modules/playwright/index.mjs';

const here = new URL('.', import.meta.url).pathname;
const out = `${here}dist/`;
const built = await Bun.build({ entrypoints: [`${here}page.ts`], outdir: out, target: 'browser' });
if (!built.success) throw new AggregateError(built.logs, 'spike build failed');
const font = new URL(
  '../../../../apps/three-promo/public/models/inter-latin-400-normal.woff',
  import.meta.url,
).pathname;
const server = Bun.serve({
  port: 0,
  fetch: (request) => {
    const path = new URL(request.url).pathname;
    if (path === '/') return new Response(Bun.file(`${here}index.html`));
    if (path === '/page.js') return new Response(Bun.file(`${out}page.js`));
    if (path === '/inter-latin-400-normal.woff') return new Response(Bun.file(font));
    return new Response('not found', { status: 404 });
  },
});
const browser = await chromium.launch({
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-unsafe-webgpu',
    '--use-webgpu-adapter=swiftshader',
    '--enable-features=Vulkan',
    '--use-vulkan=swiftshader',
  ],
});
const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
const errors: Array<string> = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
});
await page.goto(`http://localhost:${server.port}/${process.argv[3] ?? ''}`);
await page.waitForFunction(() => Reflect.get(globalThis, '__spike') !== undefined, null, {
  timeout: 30000,
});
console.log(await page.evaluate(() => Reflect.get(globalThis, '__spike')));
await page.waitForTimeout(500);
await page.locator('canvas').screenshot({ path: process.argv[2] ?? `${here}dist/shot.png` });
console.log('errors:', errors.slice(0, 5));
await browser.close();
server.stop();
