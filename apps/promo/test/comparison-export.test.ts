// Filesystem fixtures must be removed even if assertions fail.
/* oxlint-disable linteffect/no-try-catch */
import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { Option, Schema } from 'effect';
import { strFromU8, unzipSync } from 'fflate';

import { Message, update } from '../../web/src/apps/comparison/main';
import { init } from '../../web/src/apps/comparison/model';
import { Settings } from '../../web/src/apps/comparison/settings';
import * as Scatter from '../../web/src/ui/scatter-chart';
import { captureSettings, projectFiles, projectZip } from '../src/examples/comparison/project';
import { collectComparisonSources } from '../src/lib/comparison-sources';
import { buildExampleTemplate } from '../src/lib/example-project';
import * as ExampleProject from '../src/lib/example-project';

const settings: Settings = {
  panels: [
    { id: 2, kind: 'histogram' },
    { id: 3, kind: 'scatter' },
    { id: 1, kind: 'scatter' },
  ],
  linkInspections: false,
  nextPanelId: 4,
};
const initialPath = 'src/web/src/apps/comparison/initial-settings.ts';

test('template builder rejects initial Viz traversal before filesystem lookup', async () => {
  for (const subpath of [
    '../__task5_missing_boundary_probe__',
    'math/../../outside',
    '/absolute',
    'math//scale',
  ]) {
    const result = await buildExampleTemplate(
      [{ name: 'main.ts', content: `export * from '@opsydyn/foldkit-viz/${subpath}';` }],
      'comparison',
    ).then(
      () => null,
      (error) => error,
    );
    expect(result).toBeInstanceOf(RangeError);
  }
});

test.each(['linked', 'entry', 'external/outside'])(
  'vendor collector rejects canonical dist escape through %s',
  async (entry) => {
    const root = await mkdtemp('/private/tmp/comparison-vendor-symlinks-');
    const dist = join(root, 'dist');
    try {
      await mkdir(dist);
      for (const extension of ['mjs', 'd.mts']) {
        await writeFile(join(root, 'outside.' + extension), 'export const privateValue = 42;');
        await symlink(join(root, 'outside.' + extension), join(dist, 'linked.' + extension));
        await writeFile(join(dist, 'entry.' + extension), "export * from './linked.mjs';");
      }
      // A symlinked directory must not bypass the same boundary.
      await symlink(root, join(dist, 'external'));
      const result = await ExampleProject.collectVizModules(dist, [entry]).then(
        () => null,
        (error) => error,
      );
      expect(result).toBeInstanceOf(RangeError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test('vendor collector rejects lexical dependency escapes but permits internal parent edges and symlinks', async () => {
  const root = await mkdtemp('/private/tmp/comparison-vendor-edges-');
  const dist = join(root, 'dist');
  try {
    await mkdir(join(dist, 'nested'), { recursive: true });
    for (const extension of ['mjs', 'd.mts']) {
      await writeFile(join(root, 'outside.' + extension), 'export const privateValue = 42;');
      await writeFile(join(dist, 'escape.' + extension), "export * from '../outside.mjs';");
      await writeFile(join(dist, 'shared.' + extension), 'export const shared = 1;');
      await symlink(join(dist, 'shared.' + extension), join(dist, 'alias.' + extension));
      await writeFile(join(dist, 'nested/entry.v2.' + extension), "export * from '../alias.mjs';");
    }
    const escaped = await ExampleProject.collectVizModules(dist, ['escape']).then(
      () => null,
      (error) => error,
    );
    expect(escaped).toBeInstanceOf(RangeError);
    const files = await ExampleProject.collectVizModules(dist, ['nested/entry.v2']);
    expect(files['vendor/foldkit-viz/dist/alias.mjs']).toBe('export const shared = 1;');
    expect(files['vendor/foldkit-viz/dist/alias.d.mts']).toBe('export const shared = 1;');
    expect(Object.keys(files).sort()).toEqual([
      'vendor/foldkit-viz/dist/alias.d.mts',
      'vendor/foldkit-viz/dist/alias.mjs',
      'vendor/foldkit-viz/dist/nested/entry.v2.d.mts',
      'vendor/foldkit-viz/dist/nested/entry.v2.mjs',
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('snapshot ZIP round-trips [2,3,1], linking off and counter 4 without transient state', async () => {
  const resized = update(
    init(settings).model,
    Message.GotScatterMessage({
      id: 3,
      message: Scatter.Message.RecordedChartWidth({ width: 700 }),
    }),
  ).model;
  const inspected = update(
    resized,
    Message.GotScatterMessage({ id: 3, message: Scatter.Message.HoveredPoint({ index: 2 }) }),
  ).model;
  const captured = captureSettings(inspected);
  expect(captured).toEqual(settings);
  const template = await buildExampleTemplate(await collectComparisonSources(), 'comparison');
  const before = { ...template };
  const first = projectFiles(template, captured);
  const second = projectFiles(template, { panels: [], linkInspections: true, nextPanelId: 9 });
  expect(template).toEqual(before);
  expect(first[initialPath]).not.toBe(second[initialPath]);
  expect(first['src/web/src/apps/comparison/settings.ts']).toBe(
    template['src/web/src/apps/comparison/settings.ts'],
  );
  const bytes = unzipSync(projectZip(first));
  const directory = await mkdtemp('/private/tmp/comparison-snapshot-');
  try {
    const target = join(directory, initialPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, strFromU8(Option.getOrThrow(Option.fromNullishOr(bytes[initialPath]))));
    const exported = await import(target);
    expect(Schema.decodeUnknownSync(Settings)(exported.initialSettings)).toEqual(settings);
    expect(Object.keys(exported.initialSettings).sort()).toEqual([
      'linkInspections',
      'nextPanelId',
      'panels',
    ]);
    expect(Object.keys(exported.initialSettings.panels[0]).sort()).toEqual(['id', 'kind']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('invalid duplicate IDs cannot enter an exported project', () => {
  const panel = Option.getOrThrow(Option.fromNullishOr(settings.panels[0]));
  expect(() => projectFiles({}, { ...settings, panels: [panel, panel] })).toThrow();
});
