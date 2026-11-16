/**
 * The starter, built, in Chromium: charts drawn, no script, no console errors, and usable
 * at phone width in light and dark. Run by `bun run test:browser`.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Browser, chromium } from 'playwright';

const bin = join(import.meta.dir, '..', 'src', 'bin.ts');
/** The starter, built, and a browser to read it in. */
async function setUp(): Promise<{ readonly browser: Browser; readonly site: string }> {
  const dir = join(mkdtempSync(join(tmpdir(), 'foldkit-dash-')), 'site');
  for (const args of [
    ['new', dir],
    ['build', '-C', dir],
  ]) {
    expect(Bun.spawnSync(['bun', bin, ...args]).exitCode).toBe(0);
  }
  return { browser: await chromium.launch(), site: `file://${join(dir, 'dist', 'index.html')}` };
}

const ready = setUp();

beforeAll(async () => {
  await ready;
});

afterAll(async () => {
  await (await ready).browser.close();
});

for (const [name, viewport] of [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1280, height: 900 }],
] as const) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the built page reads at ${name} width, ${colorScheme}`, async () => {
      const { browser, site } = await ready;
      const page = await browser.newPage({ viewport, colorScheme });
      const errors: Array<string> = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(site);
      const shown = await page.evaluate(() => ({
        scripts: document.scripts.length,
        figures: document.querySelectorAll('figure.chart svg').length,
        tables: document.querySelectorAll('figure.chart table').length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        widest: Math.max(
          ...[...document.querySelectorAll('figure.chart svg')].map(
            (svg) => svg.getBoundingClientRect().width,
          ),
        ),
        background: getComputedStyle(document.body).backgroundColor,
        heading: document.querySelector('h1')?.textContent,
      }));
      expect(shown.scripts).toBe(0);
      expect(shown.figures).toBeGreaterThanOrEqual(2);
      expect(shown.tables).toBe(2);
      expect(shown.overflow).toBeLessThanOrEqual(0);
      expect(shown.widest).toBeLessThanOrEqual(viewport.width);
      expect(shown.heading).toBe('Weekly sales');
      expect(shown.background).toBe(
        colorScheme === 'dark' ? 'rgb(20, 20, 22)' : 'rgb(251, 251, 250)',
      );
      expect(errors).toEqual([]);
      await page.close();
    });
  }
}
