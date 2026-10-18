import { expect, test } from 'bun:test';

import { Vector3 } from 'three';

import {
  anchorSpace,
  box,
  createSceneGraph,
  group,
  headSpace,
  jointSpace,
  mesh,
  scene,
  standard,
  type XrSpace,
} from '../src/kernel/index.ts';

const tag = (follow: XrSpace | null, parent: readonly [number, number, number] = [0, 0, 0]) =>
  scene({
    children: [
      group({
        key: 'room',
        position: parent,
        children: [
          group({
            key: 'tag',
            position: [1, 1, 1],
            follow,
            children: [mesh({ key: 'card', geometry: box(), material: standard() })],
          }),
        ],
      }),
    ],
  });

const worldOf = (graph: ReturnType<typeof createSceneGraph>) =>
  graph.object('tag')?.getWorldPosition(new Vector3()).toArray();

test('a following group is hidden until its space is found, then sits where the space is', () => {
  const graph = createSceneGraph();
  graph.reconcile(tag(jointSpace('right', 'index-finger-tip'), [0, 0, -2]));
  expect(graph.object('tag')?.visible).toBe(false);

  // Found: placed at the space's world pose, though its parent is moved.
  graph.follow((space) =>
    space._tag === 'Joint' ? { position: [0.2, 1.4, -0.4], quaternion: [0, 0, 0, 1] } : undefined,
  );
  expect(graph.object('tag')?.visible).toBe(true);
  expect(worldOf(graph)?.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0.2, 1.4, -0.4]);

  // Lost (the hand is put down, or the session ends): hidden again.
  graph.follow(() => undefined);
  expect(graph.object('tag')?.visible).toBe(false);
  graph.dispose();
});

test('a group that stops following returns to its own transform; a new space hides it', () => {
  const graph = createSceneGraph();
  graph.reconcile(tag(headSpace()));
  graph.follow(() => ({ position: [5, 5, 5], quaternion: [0, 0, 0, 1] }));
  graph.reconcile(tag(null));
  expect(graph.object('tag')?.visible).toBe(true);
  expect(graph.object('tag')?.position.toArray()).toEqual([1, 1, 1]);
  // Groups that follow nothing are left alone by follow().
  graph.follow(() => ({ position: [9, 9, 9], quaternion: [0, 0, 0, 1] }));
  expect(graph.object('tag')?.position.toArray()).toEqual([1, 1, 1]);
  graph.reconcile(tag(anchorSpace('a1')));
  expect(graph.object('tag')?.visible).toBe(false);
  graph.dispose();
});
