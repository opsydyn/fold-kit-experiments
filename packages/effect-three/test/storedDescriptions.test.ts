/** Descriptions stored before a field was added still decode, the field at its default. */
import { expect, test } from 'bun:test';

import { Schema } from 'effect';

import { SceneSchema } from '../src/runtime/index.ts';

/** A camera as 0.2 stored it: no `shake`. */
const storedCamera = {
  _tag: 'Perspective',
  fov: 50,
  near: 0.1,
  far: 100,
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  damping: 0,
  autoRotate: 0,
};

const storedTransform = {
  position: [0, 0, 0],
  rotation: { _tag: 'Fixed', euler: [0, 0, 0] },
  scale: [1, 1, 1],
  transition: { _tag: 'Instant' },
  behaviour: null,
  interactive: false,
  body: null,
};

/** A group as 0.2 stored it: no `detail`. */
const storedGroup = { _tag: 'Group', key: 'g', ...storedTransform, children: [], follow: null };

/** A borrowed model as 0.2 stored it: no shadow shorthands. */
const storedModel = { _tag: 'Borrowed', key: 'b', id: 'car', animation: null, ...storedTransform };

const decodeNode = Schema.decodeUnknownSync(SceneSchema.SceneNode);
const decodeCamera = Schema.decodeUnknownSync(SceneSchema.Camera);

test('a camera stored without a shake decodes with none', () => {
  const camera = decodeCamera(storedCamera);
  expect(camera).toMatchObject({ shake: null });
});

test('a group stored without levels of detail decodes showing every child', () => {
  expect(decodeNode(storedGroup)).toMatchObject({ detail: null });
});

test('a borrowed model stored without shadow shorthands decodes leaving its meshes be', () => {
  expect(decodeNode(storedModel)).toMatchObject({ castShadow: false, receiveShadow: false });
});
