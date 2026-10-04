import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { unzipSync, strFromU8 } from 'fflate';

import { projectFiles, projectZip } from '../src/examples/histogram/project';
import { projectFiles as scatterFiles } from '../src/examples/scatter/project';
import { buildExampleTemplate } from '../src/lib/example-project';

test('scatter ZIP preserves inspection and domain settings with a runnable scale', async () => {
  const captured = { group: 'b' as const, xMax: 200, yMax: 150, selectedPoint: 'b-03' };
  const files = unzipSync(
    projectZip(scatterFiles(await buildExampleTemplate([], 'scatter'), captured)),
  );
  const directory = await mkdtemp(join(tmpdir(), 'foldkit-scatter-'));
  try {
    for (const [name, bytes] of Object.entries(files)) {
      const path = join(directory, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, strFromU8(bytes));
    }
    const settings = await import(join(directory, 'src/settings.ts'));
    expect(settings.initialSettings).toEqual(captured);
    const geometry = await import(join(directory, 'vendor/foldkit-viz/dist/math/scale.mjs'));
    expect(
      geometry.linear({ domain: [0, settings.initialSettings.xMax], range: [48, 528] })(100),
    ).toBe(288);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// Catches missing compiled dependencies and settings exports that silently revert to defaults.
test('histogram ZIP runs its captured configuration and included bin implementation', async () => {
  const template = await buildExampleTemplate([], 'histogram');
  const files = unzipSync(
    projectZip(projectFiles(template, { dataset: 'clustered', binCount: 10 })),
  );
  const directory = await mkdtemp(join(tmpdir(), 'foldkit-histogram-'));
  try {
    for (const [name, bytes] of Object.entries(files)) {
      const path = join(directory, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, strFromU8(bytes));
    }
    const settings = await import(join(directory, 'src/settings.ts'));
    expect(settings.initialSettings).toEqual({ dataset: 'clustered', binCount: 10 });
    const geometry = await import(join(directory, 'vendor/foldkit-viz/dist/math/bin.mjs'));
    expect(
      geometry
        .bin([0, 20, 100], { domain: [0, 100], thresholds: [20, 40, 60, 80] })
        .map((bucket: { count: number }) => bucket.count),
    ).toEqual([1, 1, 0, 0, 1]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('line export keeps its runnable geometry after sharing project scaffolding', async () => {
  const files = await buildExampleTemplate([], 'line');
  const directory = await mkdtemp(join(tmpdir(), 'foldkit-line-template-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      const path = join(directory, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    }
    const geometry = await import(join(directory, 'vendor/foldkit-viz/dist/shape/line.mjs'));
    expect(
      geometry.line(
        [
          [0, 0],
          [10, 20],
        ],
        { curve: 'linear' },
      ),
    ).toBe('M0,0L10,20');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
