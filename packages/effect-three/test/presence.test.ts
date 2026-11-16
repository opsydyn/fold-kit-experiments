/**
 * Co-presence (ADR-020): an immersive session reporting where the player's head and hands
 * are (`xr({ poses })`, `XrPoses`), and the avatar that shows another player.
 */
import { expect, test } from 'bun:test';

import { Euler, Quaternion } from 'three';

import {
  avatar,
  createPicker,
  createSceneGraph,
  createXrTracker,
  indexScene,
  type Quat,
  scene,
  xr,
  xrEquals,
  type XrPoses,
} from '../src/kernel/index.ts';
import { SceneFile } from '../src/runtime/index.ts';

const turned = (x: number, y: number, z: number): Quat => {
  const q = new Quaternion().setFromEuler(new Euler(x, y, z));
  return [q.x, q.y, q.z, q.w];
};

const poses: XrPoses = {
  head: { position: [0, 1.6, 2], quaternion: turned(0, Math.PI / 4, 0) },
  left: { position: [-0.2, 1.1, 1.7], quaternion: turned(0, 0, 0) },
  right: null,
};

const keys = (node: { readonly key: string; readonly children?: ReadonlyArray<unknown> }) =>
  node.key;

test('poses are off unless asked for, and asking changes the settings', () => {
  expect(xr().poses).toBeNull();
  expect(xr({ poses: 0.05 }).poses).toBe(0.05);
  expect(xrEquals(xr(), xr({ poses: 0.05 }))).toBe(false);
  expect(xrEquals(xr({ poses: 0.05 }), xr({ poses: 0.05 }))).toBe(true);
  // Saved and read back with the scene, and read from files saved before poses existed.
  const saved = SceneFile.save(scene({ xr: xr({ poses: 0.1 }), children: [] }));
  expect(SceneFile.read(saved)).toMatchObject({ success: { xr: { poses: 0.1 } } });
  const older = saved.replace(/\s*"poses": 0\.1,/, '');
  expect(older).not.toContain('poses');
  expect(SceneFile.read(older)).toMatchObject({ success: { xr: { poses: null } } });
  expect(SceneFile.read(saved.replace('"poses": 0.1', '"poses": 0'))._tag).toBe('Failure');
});

test('a pose report is an XrPoses event, as it came', () => {
  const route = createXrTracker(createPicker(createSceneGraph()));
  expect(route({ _tag: 'Poses', ...poses })).toEqual([{ _tag: 'XrPoses', ...poses }]);
});

test('an avatar has a head where the player looks, and the hands they have tracked', () => {
  const shown = avatar('avatar-bob', poses, { color: 0x88ccff, seconds: 0.1 });
  expect(shown.key).toBe('avatar-bob');
  expect(shown.children.map(keys)).toEqual(['avatar-bob-head', 'avatar-bob-left']);
  const [head, left] = shown.children;
  expect(head?._tag === 'Group' && head.position).toEqual([0, 1.6, 2]);
  // The head turns as the pose does; a quarter turn of yaw is π/4 about y.
  const rotation = head?._tag === 'Group' ? head.rotation : undefined;
  expect(rotation?._tag).toBe('Fixed');
  const euler = rotation?._tag === 'Fixed' ? rotation.euler : [0, 0, 0];
  expect(euler[1]).toBeCloseTo(Math.PI / 4, 9);
  // Each part eases to its next pose over the report interval.
  expect(left?.transition).toEqual({ _tag: 'Ease', seconds: 0.1, easing: 'linear' });
  expect(avatar('a', { ...poses, left: null }).children.map(keys)).toEqual(['a-head']);
  expect(avatar('a', { ...poses, right: poses.head }).children.map(keys)).toEqual([
    'a-head',
    'a-left',
    'a-right',
  ]);
});

test('avatars are ordinary scene nodes: they decode and index with the scene', () => {
  const two = scene({ children: [avatar('avatar-a', poses), avatar('avatar-b', poses)] });
  expect(indexScene(two, new Set())._tag).not.toBe('Invalid');
  expect(SceneFile.read(SceneFile.save(two))).toMatchObject({ success: two });
});
