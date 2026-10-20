/**
 * Assets a scene asks for (ADR-015): data in the description, validated with it, kept in
 * scene files, and read back from descriptions stored before the field existed.
 */
import { expect, test } from 'bun:test';

import {
  assetsEqual,
  environmentAsset,
  fontAsset,
  indexScene,
  modelAsset,
  scene,
  textureAsset,
} from '../src/kernel/index.ts';
import { SceneFile } from '../src/runtime/index.ts';

const robot = modelAsset({ id: 'robot', url: 'robot.glb' });

test('each builder names its kind; a scene asks for none unless told', () => {
  expect(robot).toEqual({ kind: 'model', id: 'robot', url: 'robot.glb' });
  expect(textureAsset({ id: 'floor', url: 'tiles.png' }).kind).toBe('texture');
  expect(environmentAsset({ id: 'sky', url: 'sky.hdr' }).kind).toBe('environment');
  expect(fontAsset({ id: 'type', url: 'inter.json' }).kind).toBe('font');
  expect(scene({}).assets).toEqual([]);
});

test('two assets with one id are refused, as two nodes with one key are', () => {
  const twice = scene({ assets: [robot, textureAsset({ id: 'robot', url: 'tiles.png' })] });
  expect(indexScene(twice)).toEqual({
    _tag: 'Invalid',
    error: { _tag: 'DuplicateAssetId', id: 'robot' },
  });
  expect(indexScene(scene({ assets: [robot] }))._tag).toBe('Indexed');
});

test('lists are equal when they ask for the same assets in the same order', () => {
  const floor = textureAsset({ id: 'floor', url: 'tiles.png' });
  expect(assetsEqual([robot, floor], [{ ...robot }, { ...floor }])).toBe(true);
  expect(assetsEqual([robot, floor], [floor, robot])).toBe(false);
  expect(assetsEqual([robot], [{ ...robot, url: 'other.glb' }])).toBe(false);
  expect(assetsEqual([robot], [])).toBe(false);
});

test('a scene file keeps its assets, and one written before them reads with none', () => {
  expect(SceneFile.read(SceneFile.save(scene({ assets: [robot] })))).toMatchObject({
    _tag: 'Success',
    success: { assets: [robot] },
  });
  // A file from before assets: the same envelope, its scene without the field.
  const older = SceneFile.save(scene({})).replace(/\n\s*"assets": \[\],?/, '');
  expect(older).not.toContain('"assets"');
  expect(SceneFile.read(older)).toMatchObject({ _tag: 'Success', success: { assets: [] } });
});
