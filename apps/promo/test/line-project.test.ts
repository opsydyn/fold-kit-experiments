import { expect, test } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unzipSync, strFromU8 } from 'fflate';

import { projectFiles, projectZip } from '../src/examples/line/project';

test('ZIP captures changed settings without mutating the maintained template', async () => {
  const template = { 'src/settings.ts': 'original', 'src/chart.ts': 'export const name = "line";' };
  const settings = { curve: 'step' as const, values: [75, 45, 23, 88, 67], yMax: 150 };
  const files = projectFiles(template, settings);
  const contents = unzipSync(projectZip(files));
  expect(template['src/settings.ts']).toBe('original');
  expect(strFromU8(contents['src/chart.ts'] ?? new Uint8Array())).toBe(
    'export const name = "line";',
  );
  const directory = await mkdtemp(join(tmpdir(), 'foldkit-export-'));
  try {
    const path = join(directory, 'settings.ts');
    await writeFile(path, strFromU8(contents['src/settings.ts'] ?? new Uint8Array()));
    const module = await import(path);
    expect(module.initialSettings).toEqual(settings);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
