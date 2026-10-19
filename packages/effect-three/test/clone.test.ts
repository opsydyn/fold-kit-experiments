import { expect, test } from 'bun:test';

import {
  AnimationClip,
  Bone,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  type Object3D,
  Skeleton,
  SkinnedMesh,
} from 'three';

import { borrowed, createSceneGraph, play, scene } from '../src/index.ts';

/** A one-bone skinned arm that raises over a second, as a loaded character would. */
const skinnedArm = () => {
  const bone = new Bone();
  bone.name = 'shoulder';
  const geometry = new BoxGeometry(0.2, 1, 0.2);
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new Float32BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute(
    'skinWeight',
    new Float32BufferAttribute(
      Array.from({ length: count * 4 }, (_, index) => (index % 4 === 0 ? 1 : 0)),
      4,
    ),
  );
  const arm = new SkinnedMesh(geometry, new MeshBasicMaterial());
  arm.name = 'arm';
  arm.add(bone);
  arm.bind(new Skeleton([bone]));
  const root = new Group();
  root.add(arm);
  root.animations = [
    new AnimationClip('raise', 1, [
      new NumberKeyframeTrack('shoulder.position[y]', [0, 1], [0, 1]),
    ]),
  ];
  return root;
};

const boneOf = (object: Object3D | undefined) => object?.getObjectByName('shoulder');
const skinOf = (object: Object3D | undefined) => {
  const arm = object?.getObjectByName('arm');
  return arm instanceof SkinnedMesh ? arm : undefined;
};

test('a skinned model shown twice has bones of its own in each place, sharing its geometry', () => {
  const graph = createSceneGraph();
  graph.store.lend('rig', skinnedArm());
  graph.reconcile(
    scene({
      children: [
        borrowed({ key: 'a', id: 'rig', animation: play('raise', { loop: false }) }),
        borrowed({ key: 'b', id: 'rig' }),
      ],
    }),
  );
  graph.tick(0.5);
  const [first, second] = [graph.object('a'), graph.object('b')];
  // Each copy's skeleton drives its own bones: posing one leaves the other at rest.
  expect(boneOf(first)?.position.y).toBeCloseTo(0.5, 5);
  expect(boneOf(second)?.position.y).toBe(0);
  expect(skinOf(second)?.skeleton.bones[0]?.uuid).toBe(boneOf(second)?.uuid);
  expect(skinOf(second)?.geometry).toBe(skinOf(first)?.geometry);
  graph.dispose();
});

test('shadow shorthands set every mesh of what is shown, and leave them be when false', () => {
  const graph = createSceneGraph();
  const model = new Group();
  model.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
  graph.store.lend('crate', model);
  graph.reconcile(scene({ children: [borrowed({ key: 'c', id: 'crate', castShadow: true })] }));
  const mesh = graph.object('c')?.getObjectByProperty('isMesh', true);
  expect(mesh?.castShadow).toBe(true);
  expect(mesh?.receiveShadow).toBe(false);
  graph.reconcile(
    scene({
      children: [borrowed({ key: 'c', id: 'crate', castShadow: true, receiveShadow: true })],
    }),
  );
  expect(mesh?.receiveShadow).toBe(true);
  graph.dispose();
});
