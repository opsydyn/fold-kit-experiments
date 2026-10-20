import { expect, test } from 'bun:test';

import {
  box,
  group,
  type InspectedField,
  mesh,
  type SceneNode,
  standard,
} from '../src/kernel/index.ts';
import { Inspector, SceneSchema } from '../src/runtime/index.ts';

const crate = mesh({
  key: 'crate',
  position: [1, 2, 3],
  geometry: box({ width: 2 }),
  material: standard({ color: 0xff8800, roughness: 0.4, side: 'front' }),
});

const fieldsOf = (node: SceneNode) => Inspector.fields(SceneSchema.SceneNode, node);

const at = (fields: ReadonlyArray<InspectedField>, ...path: ReadonlyArray<string | number>) =>
  fields.find((field) => field.path.join('.') === path.join('.'));

test('a mesh shows its fields by kind, read from the scene schema', () => {
  const fields = fieldsOf(crate);
  expect(at(fields, '_tag')).toMatchObject({ _tag: 'Fixed', text: 'Mesh' });
  expect(at(fields, 'key')).toMatchObject({ _tag: 'Text', value: 'crate' });
  expect(at(fields, 'position')).toMatchObject({ _tag: 'Vector', value: [1, 2, 3] });
  expect(at(fields, 'geometry', 'width')).toMatchObject({ _tag: 'Number', value: 2 });
  expect(at(fields, 'material', 'color')).toMatchObject({ _tag: 'Colour', value: 0xff8800 });
  expect(at(fields, 'material', 'side')).toMatchObject({
    _tag: 'Choice',
    value: 'front',
    options: ['front', 'back', 'double'],
  });
  expect(at(fields, 'castShadow')).toMatchObject({ _tag: 'Toggle', value: false });
  expect(at(fields, 'edges')).toMatchObject({ _tag: 'Fixed', text: 'null' });
});

test('a group shows how many children it holds, not the children', () => {
  const shelf = group({ key: 'shelf', children: [crate, { ...crate, key: 'other' }] });
  const fields = fieldsOf(shelf);
  expect(at(fields, 'children')).toMatchObject({ _tag: 'Fixed', text: '2 items' });
  expect(fields.some((field) => field.path[0] === 'children' && field.path.length > 1)).toBe(false);
});

test('edits the schema accepts are made; the rest say why', () => {
  const moved = Inspector.edit(SceneSchema.SceneNode, crate, ['position', 1], 5);
  expect(moved).toMatchObject({ _tag: 'Success', success: { position: [1, 5, 3] } });
  // The original is untouched.
  expect(crate.position).toEqual([1, 2, 3]);
  const rough = Inspector.edit(SceneSchema.SceneNode, crate, ['material', 'roughness'], 1.5);
  expect(rough._tag).toBe('Failure');
  expect(rough._tag === 'Failure' ? rough.failure : '').toContain('roughness');
  const flat = Inspector.edit(SceneSchema.SceneNode, crate, ['geometry', 'width'], -1);
  expect(flat._tag).toBe('Failure');
});
