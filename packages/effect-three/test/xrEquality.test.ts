import { expect, test } from 'bun:test';

import { labelMaterialEquals, xrEquals, xrSpaceEquals } from '../src/kernel/equality.ts';
import {
  anchorSpace,
  controllerSpace,
  glide,
  headSpace,
  jointSpace,
  meshSpace,
  planeSpace,
  sharedMaterial,
  standard,
  xr,
  xrAnchor,
} from '../src/kernel/index.ts';

test('xr settings are equal field by field, anchors in order and in full', () => {
  const desk = xrAnchor({ id: 'desk', position: [1, 0, -1] });
  const settings = xr({ anchors: [desk], planes: true, meshes: true, glide: glide() });
  expect(xrEquals(settings, structuredClone(settings))).toBe(true);
  expect(xrEquals(null, null)).toBe(true);
  expect(xrEquals(settings, null)).toBe(false);
  // An anchor moved, turned, renamed, added or removed is a change.
  const anchored = (...anchors: ReadonlyArray<ReturnType<typeof xrAnchor>>) =>
    xrEquals(settings, { ...settings, anchors });
  expect(anchored(xrAnchor({ id: 'desk', position: [1, 0, -1] }))).toBe(true);
  expect(anchored(xrAnchor({ id: 'desk', position: [2, 0, -1] }))).toBe(false);
  expect(anchored(xrAnchor({ id: 'desk', position: [1, 0, -1], rotation: [0, 1, 0] }))).toBe(false);
  expect(anchored(xrAnchor({ id: 'shelf', position: [1, 0, -1] }))).toBe(false);
  expect(anchored(desk, desk)).toBe(false);
  expect(anchored()).toBe(false);
  expect(xrEquals(settings, { ...settings, meshes: false })).toBe(false);
  expect(xrEquals(settings, { ...settings, glide: glide({ speed: 3 }) })).toBe(false);
});

test('tracked spaces are equal when they name the same thing', () => {
  const spaces = [
    headSpace(),
    jointSpace('left', 'wrist'),
    controllerSpace('left'),
    controllerSpace('left', 'ray'),
    anchorSpace('a'),
    planeSpace('a'),
    meshSpace('a'),
  ];
  spaces.forEach((a, i) =>
    spaces.forEach((b, j) => expect(xrSpaceEquals(a, structuredClone(b))).toBe(i === j)),
  );
  expect(xrSpaceEquals(null, null)).toBe(true);
  expect(xrSpaceEquals(headSpace(), null)).toBe(false);
  expect(xrSpaceEquals(jointSpace('left', 'wrist'), jointSpace('right', 'wrist'))).toBe(false);
});

test('a label’s material is equal by reference kind and content', () => {
  expect(labelMaterialEquals(null, null)).toBe(true);
  expect(labelMaterialEquals(null, standard())).toBe(false);
  expect(labelMaterialEquals(standard({ roughness: 0.2 }), standard({ roughness: 0.2 }))).toBe(
    true,
  );
  expect(labelMaterialEquals(sharedMaterial('gold'), standard())).toBe(false);
  expect(labelMaterialEquals(sharedMaterial('gold'), sharedMaterial('gold'))).toBe(true);
});
