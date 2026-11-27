/* oxlint-disable linteffect/no-try-catch -- Close the browser even when assertions fail. */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { chromium } from 'playwright';

const origin = 'http://million-points-promo.test';
const base = process.env.PROMO_BASE_PATH ?? '/';
const output = join(import.meta.dir, '../dist');

declare global {
  interface Window {
    scatterDraws: number;
    scatterDeletes: WeakMap<object, number>;
    drawnCanvas: WeakSet<object>;
  }
}

function installCanvasProbe(enableWebGL: boolean) {
  const context = HTMLCanvasElement.prototype.getContext;
  const draw = WebGLRenderingContext.prototype.drawArrays;
  const remove = WebGLRenderingContext.prototype.deleteBuffer;
  window.scatterDraws = 0;
  window.scatterDeletes = new WeakMap();
  window.drawnCanvas = new WeakSet();
  WebGLRenderingContext.prototype.drawArrays = function (mode, first, count) {
    window.scatterDraws += 1;
    window.drawnCanvas.add(this.canvas);
    draw.call(this, mode, first, count);
  };
  WebGLRenderingContext.prototype.deleteBuffer = function (buffer) {
    window.scatterDeletes.set(this.canvas, (window.scatterDeletes.get(this.canvas) ?? 0) + 1);
    remove.call(this, buffer);
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: function (
      this: HTMLCanvasElement,
      kind: string,
      options?: CanvasRenderingContext2DSettings | WebGLContextAttributes,
    ) {
      return !enableWebGL && kind === 'webgl' ? null : context.call(this, kind, options);
    },
  });
}

for (const gpu of [true, false]) {
  test.skipIf(process.env.MILLION_POINTS_BROWSER !== '1')(
    `built Million Points preserves brush and zoom with ${gpu ? 'WebGL' : 'canvas fallback'}`,
    async () => {
      const browser = await chromium.launch({
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(10_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript(installCanvasProbe, gpu);
        await page.route(origin + '/**', async (route) => {
          const path = new URL(route.request().url()).pathname.slice(base.length);
          await route.fulfill({ path: join(output, path, path.endsWith('/') ? 'index.html' : '') });
        });
        await page.goto(origin + base + 'examples/million-points/');
        const host = page
          .locator('astro-island')
          .filter({ has: page.getByRole('button', { name: 'Zoom in' }) });
        expect(await host.getAttribute('client')).toBe('only');
        expect(await host.getAttribute('opts')).toContain('astro-effect-ui');
        const scatter = page.locator('[data-explore="scatter"]');
        const baseCanvas = scatter.locator('canvas[role="img"]');
        const points = scatter.locator('canvas.plot-points');
        await baseCanvas.waitFor();
        if (gpu) {
          await page.waitForFunction(() => window.scatterDraws > 0);
          await points.waitFor();
        } else {
          await page.waitForFunction(
            () =>
              document.querySelectorAll('[data-explore="scatter"] canvas').length === 1 &&
              (document.querySelector<HTMLCanvasElement>('[data-explore="scatter"] canvas')
                ?.width ?? 0) > 300,
          );
        }
        const canvas = await baseCanvas.elementHandle();
        const gpuCanvas = gpu ? await points.elementHandle() : undefined;
        const draws = () => page.evaluate(() => window.scatterDraws);
        const before = await draws();
        const histogram = page.locator('[data-explore="histogram"] svg[role="img"]');
        await histogram.scrollIntoViewIfNeeded();
        const box = await histogram.boundingBox();
        if (!box) throw new Error('The histogram has no drawing surface.');
        const y = box.y + box.height * 0.5;
        await page.mouse.move(box.x + box.width * 0.19, y);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.42, y, { steps: 5 });
        await histogram.locator('.plot-brush').waitFor();
        const highlighted = page.getByText(/1,000,000 points; .* ms highlighted/);
        if (gpu) {
          await highlighted.waitFor();
          expect(await draws()).toBeGreaterThan(before);
          expect(
            await gpuCanvas?.evaluate(
              (node) => node === document.querySelector('canvas.plot-points'),
            ),
          ).toBe(true);
        } else {
          expect(await highlighted.count()).toBe(0);
        }
        expect(
          await canvas.evaluate(
            (node) => node === document.querySelector('[data-explore="scatter"] canvas'),
          ),
        ).toBe(true);
        await page.mouse.up();
        await highlighted.waitFor();
        if (!gpu) await page.waitForFunction((node) => !node.isConnected, canvas);
        const beforeZoom = await baseCanvas.elementHandle();
        await page.getByRole('button', { name: 'Zoom in' }).click();
        await page.waitForFunction((node) => !node.isConnected, beforeZoom);
        await page.getByRole('button', { name: 'Reset', exact: true }).click();
        await highlighted.waitFor({ state: 'detached' });
        if (gpu) {
          const activeCanvas = await points.elementHandle();
          await page.waitForFunction((node) => window.drawnCanvas.has(node), activeCanvas);
          const deletedBefore = await activeCanvas.evaluate(
            (node) => window.scatterDeletes.get(node) ?? 0,
          );
          await host.evaluate((island) => {
            island.remove();
            island.dispatchEvent(new Event('astro:unmount'));
          });
          await page.waitForFunction(
            ({ node, before }) => (window.scatterDeletes.get(node) ?? 0) > before,
            { node: activeCanvas, before: deletedBefore },
          );
        }
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    },
    45_000,
  );
}
