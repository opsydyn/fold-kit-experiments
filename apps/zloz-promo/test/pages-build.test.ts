import { expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Opt in after a production build; workspace tests must not inspect stale artifacts.
const base = process.env.ZLOZ_PROMO_BASE_PATH;
test.skipIf(!base)(
  'Zloz Pages links and interactive modules resolve under the public base',
  async () => {
    if (!base) throw new Error('Missing Zloz Pages base path');
    const directory = join(import.meta.dir, '../dist');
    const pages = readdirSync(directory, { recursive: true }).filter(
      (path): path is string => typeof path === 'string' && path.endsWith('.html'),
    );
    expect(pages).toContain('index.html');
    expect(pages).toContain('docs/index.html');
    for (const page of pages) {
      const html = await Bun.file(join(directory, page)).text();
      expect(html).not.toContain('http://localhost:');
      expect(html).not.toContain('http://127.0.0.1:');
      for (const match of html.matchAll(/(?:href|src|component-url|renderer-url)="([^"]+)"/g)) {
        const reference = match[1];
        if (!reference?.startsWith('/') || reference.startsWith('//')) continue;
        expect(reference.startsWith(base)).toBe(true);
        const path = new URL(reference, 'https://example.test').pathname.slice(base.length);
        const file = path.endsWith('/') || !path ? join(path, 'index.html') : path;
        expect(await Bun.file(join(directory, file)).exists()).toBe(true);
      }
    }
    const home = await Bun.file(join(directory, 'index.html')).text();
    expect(home).toContain('https://zloz.opsydyn.xyz/');
    expect(home).toContain('<astro-island');
    expect(home).toContain(`${base}downloads/order-context.json`);
    expect(home).toContain(`${base}downloads/order-context.mermaid.json`);
    expect(home).toContain('source-line-number');
    expect(home).toContain('class="pl-');
  },
);
