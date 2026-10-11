import { expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Run after the Pages build. Default workspace tests do not depend on stale dist files.
const base = process.env.PROMO_BASE_PATH;
test.skipIf(!base)(
  'built promo links and island modules resolve within the Pages artifact',
  async () => {
    if (!base) throw new Error('Missing Pages base path');
    const directory = join(import.meta.dir, '../dist');
    const pages = readdirSync(directory, { recursive: true }).filter(
      (path): path is string => typeof path === 'string' && path.endsWith('.html'),
    );
    expect(pages.length).toBeGreaterThanOrEqual(10);
    expect(pages).toContain('examples/signals/index.html');
    const home = await Bun.file(join(directory, 'index.html')).text();
    expect(home.includes(`href="${base}examples/signals/"`)).toBe(true);
    expect(home.includes(`href="${base}examples/wordcloud/"`)).toBe(true);
    for (const example of ['signals', 'wordcloud']) {
      for (const theme of ['light', 'dark']) {
        expect(home.includes(`${base}images/showcase/${example}-${theme}.png`)).toBe(true);
      }
    }
    expect(home.includes('<astro-island')).toBe(false);
    for (const page of pages) {
      const html = await Bun.file(join(directory, page)).text();
      const references = html.matchAll(/(?:href|src|component-url|renderer-url)="([^"]+)"/g);
      for (const match of references) {
        const reference = match[1];
        if (!reference?.startsWith('/') || reference.startsWith('//')) continue;
        expect(reference.startsWith(base)).toBe(true);
        const path = new URL(reference, 'https://example.test').pathname.slice(base.length);
        const file = path.endsWith('/') || !path ? join(path, 'index.html') : path;
        expect(await Bun.file(join(directory, file)).exists()).toBe(true);
      }
    }
    const assets = readdirSync(join(directory, '_astro'));
    const wasm = assets.find((name) => /^onig\..*\.wasm$/.test(name));
    const browserHighlighter = assets.find((name) => /^highlighting-browser\..*\.js$/.test(name));
    expect(wasm).toBeDefined();
    expect(browserHighlighter).toBeDefined();
    if (!wasm || !browserHighlighter) throw new Error('Missing self-hosted highlighting assets');
    expect(await Bun.file(join(directory, '_astro', browserHighlighter)).text()).toContain(
      `${base}_astro/${wasm}`,
    );
    const comparison = await Bun.file(join(directory, 'examples/comparison/index.html')).text();
    expect(comparison).toContain(`${base}downloads/comparison-template.json`);
    expect(await Bun.file(join(directory, 'downloads/comparison-template.json')).exists()).toBe(
      true,
    );
    const gallery = await Bun.file(join(directory, 'examples/index.html')).text();
    expect(gallery.match(/class="example-detail"/g)).toHaveLength(18);
    expect(gallery).toContain(`${base}examples/bars/`);
    expect(gallery).toContain(`${base}examples/signals/`);
    expect(gallery).toContain(`${base}examples/wordcloud/`);
    expect(gallery).toContain(`${base}examples/comparison/`);
    expect(gallery).toContain(`${base}examples/datasets/`);
    expect(gallery).toContain('/tree/main/packages/foldkit-viz/src/hierarchy/index.ts');
    expect(gallery).not.toContain('/tree/main/packages/foldkit-viz/src/hierarchy.ts');
    const bars = await Bun.file(join(directory, 'examples/bars/index.html')).text();
    expect(bars).toContain('source-view.ts-L1');
    expect(bars).toContain('source-app.ts-L1');
    expect(bars).toContain('source-line-number');
    expect(bars).toContain(`${base}examples/#grouped-bars`);
    for (const example of ['signals', 'wordcloud']) {
      const page = await Bun.file(join(directory, `examples/${example}/index.html`)).text();
      expect(page.includes('source-view.ts-L1')).toBe(true);
      expect(page.includes('source-line-number')).toBe(true);
      expect(page.includes('class="pl-')).toBe(true);
    }
  },
);
