// Filesystem fixtures must be removed even if assertions fail.
/* oxlint-disable linteffect/no-try-catch */
import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectComparisonSources } from '../src/lib/comparison-sources';
import { buildExampleTemplate } from '../src/lib/example-project';

const appsRoot = fileURLToPath(new URL('../../', import.meta.url));

test('collector rejects traversal-bearing Viz subpaths before they reach vendoring', async () => {
  const root = await mkdtemp(join(tmpdir(), 'comparison-viz-subpaths-'));
  const entry = 'promo/src/examples/comparison/main.ts';
  try {
    await mkdir(dirname(join(root, entry)), { recursive: true });
    for (const subpath of [
      '../__task5_missing_boundary_probe__',
      'math/../../outside',
      './math/scale',
      '/math/scale',
      'math//scale',
      'math\\scale',
      'math/%2e%2e/scale',
      'math/scale?raw',
    ]) {
      await writeFile(
        join(root, entry),
        `export * from ${JSON.stringify('@opsydyn/foldkit-viz/' + subpath)};`,
      );
      const result = await collectComparisonSources({ appsRoot: root, entries: [entry] }).then(
        () => null,
        (error) => error,
      );
      expect(result).toBeInstanceOf(RangeError);
    }
    await writeFile(join(root, entry), "export * from '@opsydyn/foldkit-viz/_internal/scale.v2';");
    expect(await collectComparisonSources({ appsRoot: root, entries: [entry] })).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('collector still finds maintained sources after the server bundler relocates its module', async () => {
  const directory = await mkdtemp(join(appsRoot, 'promo/.comparison-collector-'));
  try {
    const build = await Bun.build({
      entrypoints: [fileURLToPath(new URL('../src/lib/comparison-sources.ts', import.meta.url))],
      outdir: directory,
      target: 'bun',
      packages: 'external',
    });
    expect(build.success).toBe(true);
    const bundled = await import(join(directory, 'comparison-sources.js'));
    expect(await bundled.collectComparisonSources()).toEqual(await collectComparisonSources());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('collector includes unchanged transitive maintained sources and CSS, not loaders or tests', async () => {
  const sources = await collectComparisonSources();
  const names = sources.map(({ name }) => name);
  for (const name of [
    'promo/src/examples/comparison/main.ts',
    'web/src/apps/comparison/main.ts',
    'web/src/apps/comparison/settings.ts',
    'web/src/apps/comparison/initial-settings.ts',
    'web/src/apps/comparison/comparison.css',
    'web/src/ui/scatter-chart/index.ts',
    'web/src/ui/histogram-chart/index.ts',
    'web/src/ui/shared/inspection.ts',
  ]) {
    expect(names).toContain(name);
  }
  expect(names.some((name) => /(?:test|stories)\.|\/app\.ts$/.test(name))).toBe(false);
  for (const source of sources)
    expect(source.content).toBe(await readFile(join(appsRoot, source.name), 'utf8'));
  const files = await buildExampleTemplate(sources, 'comparison');
  expect(files['src/entry.ts']).toContain('./promo/src/examples/comparison/main');
  expect(files['src/web/src/apps/comparison/comparison.css']).toBe(
    await readFile(join(appsRoot, 'web/src/apps/comparison/comparison.css'), 'utf8'),
  );
  expect(files['index.html']).not.toContain('Give your data shape');
});

test('parser follows import, export-from, type and side-effect edges without following comments', async () => {
  const root = await mkdtemp(join(tmpdir(), 'comparison-sources-'));
  const entry = 'promo/src/examples/comparison/main.ts';
  const put = async (name: string, content: string) => {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), content);
  };
  try {
    await put(
      entry,
      "// import './missing-comment';\nexport { value } from './child';\nimport type { Kind } from './types';\nimport './style.css';",
    );
    await put('promo/src/examples/comparison/child.ts', 'export const value = 1;');
    await put('promo/src/examples/comparison/types.ts', 'export type Kind = string;');
    await put('promo/src/examples/comparison/style.css', 'body { margin: 0; }');
    expect((await collectComparisonSources({ appsRoot: root, entries: [entry] })).length).toBe(4);
    for (const edge of ['./missing', '../../../../outside', './bad.test', '#repository/alias']) {
      await put(entry, `export * from '${edge}';`);
      const result = await collectComparisonSources({ appsRoot: root, entries: [entry] }).then(
        () => null,
        (error) => error,
      );
      expect(result).toBeInstanceOf(Error);
    }
    await put('outside.ts', 'export const value = 1;');
    await symlink(join(root, 'outside.ts'), join(root, 'promo/src/examples/comparison/escape.ts'));
    await put(entry, "export * from './escape';");
    const escaped = await collectComparisonSources({ appsRoot: root, entries: [entry] }).then(
      () => null,
      (error) => error,
    );
    expect(escaped).toBeInstanceOf(Error);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
