import { expect, it } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { compilePhosphorIcon } from '../src/compile';

it('compiles every pinned official Core SVG in all six weights without a browser or dropped elements', async () => {
  const root = fileURLToPath(new URL('../assets/', import.meta.resolve('@phosphor-icons/core')));
  const counts: number[] = [];
  for (const weight of ['regular', 'thin', 'light', 'bold', 'fill', 'duotone']) {
    const names = (await readdir(`${root}/${weight}`)).filter((name) => name.endsWith('.svg'));
    expect(names.length).toBeGreaterThan(1000);
    for (const name of names) {
      const source = await readFile(`${root}/${weight}/${name}`, 'utf8');
      const icon = compilePhosphorIcon(source);
      const count = (nodes: typeof icon.children): number =>
        nodes.reduce((total, node) => total + 1 + count(node.children), 0);
      expect(count(icon.children)).toBe(
        (source.match(/<(?:g|path|circle|ellipse|rect|line|polyline|polygon)(?=[\s/>])/g) ?? [])
          .length,
      );
    }
    counts.push(names.length);
  }
  expect(new Set(counts).size).toBe(1);
}, 30_000);
