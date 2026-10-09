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
    expect(pages.length).toBeGreaterThanOrEqual(7);
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
    const comparison = await Bun.file(join(directory, 'examples/comparison/index.html')).text();
    expect(comparison).toContain(`${base}downloads/comparison-template.json`);
    expect(await Bun.file(join(directory, 'downloads/comparison-template.json')).exists()).toBe(
      true,
    );
  },
);
