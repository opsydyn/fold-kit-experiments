// Filesystem fixtures must be removed even if assertions fail.
/* oxlint-disable linteffect/no-try-catch */
import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
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
