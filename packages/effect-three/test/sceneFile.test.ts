import { expect, test } from 'bun:test';

import { box, mesh, scene, type SceneDescription, standard } from '../src/kernel/index.ts';
import { SceneFile } from '../src/runtime/index.ts';
import { scene as anyScene } from './arbitraries.ts';
import { assertProperty } from './property.ts';

/** The scene a file's text reads as; `undefined` when it cannot be read. */
function loadedScene(text: string): SceneDescription | undefined {
  const read = SceneFile.read(text);
  return read._tag === 'Success' ? read.success : undefined;
}

/** Why a file's text cannot be read; empty when it can. */
function whyUnreadable(text: string): string {
  const read = SceneFile.read(text);
  return read._tag === 'Failure' ? read.failure.issue : '';
}

function savesAndLoads(description: SceneDescription): void {
  const text = SceneFile.save(description);
  expect(loadedScene(text)).toEqual(description);
}

const empty = SceneFile.save(scene({}));
const cube = scene({ children: [mesh({ key: 'cube', geometry: box(), material: standard() })] });

test('every scene saved loads back as it was', () =>
  assertProperty(anyScene, savesAndLoads, { runs: 100 }));

function savesIndentedJson(): void {
  const text = SceneFile.save(cube);
  expect(text).toStartWith('{\n  "format": "effect-three/scene",\n  "version": 1,\n  "scene": {');
  expect(text).toContain('"key": "cube"');
}
test('a saved scene is indented JSON in a versioned envelope', savesIndentedJson);

function saysWhyItCannotBeRead(): void {
  const otherFormat = empty.replace('"effect-three/scene"', '"other"');
  const wordyFov = empty.replace('"fov": 50', '"fov": "wide"');
  expect(whyUnreadable('{ not json')).not.toBe('');
  expect(whyUnreadable(empty)).toBe('');
  expect(whyUnreadable(otherFormat)).toContain('format');
  expect(whyUnreadable(wordyFov)).toContain('fov');
}
test('what is not a scene file says why it cannot be read', saysWhyItCannotBeRead);

function loadsOlderFiles(): void {
  const beforeHuds = empty.replace('"hud": null,', '');
  expect(beforeHuds).not.toContain('"hud"');
  expect(loadedScene(beforeHuds)?.hud).toBeNull();
}
test(
  'a file written before a field was added loads with the field at its default',
  loadsOlderFiles,
);
