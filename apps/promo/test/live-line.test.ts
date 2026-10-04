import { expect, test } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  chartGeometry,
  changeValue,
  changeDomain,
  settingsSource,
} from '../src/examples/line/chart';
const legacyFrame = {
  frame: { width: 560, height: 290, margins: { top: 30, right: 32, bottom: 40, left: 48 } },
};

import { initialSettings } from '../src/examples/line/settings';

test('linear chart maps values onto the labelled axes', () => {
  const chart = chartGeometry(
    { curve: 'linear', values: [0, 50, 100, 50, 0], yMax: 100 },
    legacyFrame,
  );
  const expected = [
    [48, 250],
    [168, 140],
    [288, 30],
    [408, 140],
    [528, 250],
  ];
  chart.points.forEach(([x, y], i) => {
    expect(x).toBeCloseTo(expected[i]?.[0] ?? -1, 8);
    expect(y).toBeCloseTo(expected[i]?.[1] ?? -1, 8);
  });
  expect(chart.path).not.toMatch(/NaN|Infinity/);
});

test('curve and domain changes affect the actual geometry', () => {
  const smooth = chartGeometry(initialSettings);
  const straight = chartGeometry({ ...initialSettings, curve: 'linear' });
  const expanded = chartGeometry({ ...initialSettings, yMax: 200 }, legacyFrame);
  expect(smooth.path).not.toBe(straight.path);
  expect(expanded.points[0]).toEqual([48, 239]);
  expect(expanded.yTicks.at(-1)?.value).toBe(200);
});

test('invalid control payloads preserve finite chart settings', () => {
  for (const value of ['NaN', '', '-1', '101', 'Infinity']) {
    expect(changeValue(initialSettings, 0, value)).toEqual(initialSettings);
  }
  expect(changeValue(initialSettings, -1, '50')).toEqual(initialSettings);
  expect(changeValue(initialSettings, 5, '50')).toEqual(initialSettings);
  expect(changeDomain(initialSettings, '0')).toEqual(initialSettings);
  expect(changeDomain(initialSettings, '201')).toEqual(initialSettings);
  expect(changeValue(initialSettings, 0, '75').values[0]).toBe(75);
  expect(changeDomain(initialSettings, '150').yMax).toBe(150);
});

test('copied settings execute with the current point and curve choices', async () => {
  const settings = { curve: 'step' as const, values: [75, 45, 23, 88, 67], yMax: 150 };
  const source = settingsSource(settings);
  const directory = await mkdtemp(join(tmpdir(), 'foldkit-settings-'));
  try {
    const file = join(directory, 'settings.ts');
    await writeFile(file, source);
    const module = await import(file);
    expect(module.initialSettings).toEqual(settings);
    expect(chartGeometry(module.initialSettings, legacyFrame).points[0]).toEqual([48, 140]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
