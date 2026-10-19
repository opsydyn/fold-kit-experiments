import { expect, test } from 'bun:test';

import { Euler, Quaternion } from 'three';

import {
  basic,
  billboard,
  box,
  createSceneGraph,
  fixed,
  group,
  mesh,
  perspectiveCamera,
  type Rotation,
  scene,
  type Vec3,
} from '../src/index.ts';

/** A sign on a turned post, seen from `eye`. */
const signScene = (eye: Vec3, rotation: Rotation) =>
  scene({
    camera: perspectiveCamera({ position: eye, lookAt: [0, 0, 0] }),
    children: [
      group({
        key: 'post',
        position: [1, 0, 0],
        rotation: fixed([0.4, 1.1, -0.3]),
        children: [mesh({ key: 'sign', geometry: box(), material: basic(), rotation })],
      }),
    ],
  });

const worldTurn = (graph: ReturnType<typeof createSceneGraph>, key: string): Quaternion => {
  const turn = new Quaternion();
  graph.object(key)?.getWorldQuaternion(turn);
  return turn;
};

/** Whether two rotations are the same, whichever sign their quaternions have. */
const sameTurn = (a: Quaternion, b: Quaternion): boolean => Math.abs(a.dot(b)) > 1 - 1e-9;

test('a billboard turns so its world rotation is the camera’s, whatever its parent’s', () => {
  const graph = createSceneGraph();
  graph.reconcile(signScene([0, 2, 8], billboard()));
  graph.tick(0);
  const camera = new Quaternion();
  graph.camera.getWorldQuaternion(camera);
  expect(sameTurn(worldTurn(graph, 'sign'), camera)).toBe(true);

  // The camera moves round: the sign follows on the next frame.
  graph.reconcile(signScene([8, 1, 0], billboard()));
  graph.tick(0.1);
  graph.camera.getWorldQuaternion(camera);
  expect(sameTurn(worldTurn(graph, 'sign'), camera)).toBe(true);
  graph.dispose();
});

test('a locked axis stays at 0 in the node’s own angles', () => {
  const graph = createSceneGraph();
  graph.reconcile(signScene([3, 4, 6], billboard({ lockX: true, lockZ: true })));
  graph.tick(0);
  const own = graph.object('sign')?.rotation ?? new Euler(1, 1, 1);
  expect(own.x).toBe(0);
  expect(own.z).toBe(0);
  expect(own.y).not.toBe(0);
  graph.dispose();
});

test('a billboard made fixed stops turning, and keeps the angles it is given', () => {
  const graph = createSceneGraph();
  graph.reconcile(signScene([0, 2, 8], billboard()));
  graph.tick(0);
  graph.reconcile(signScene([0, 2, 8], fixed([0, 0, 0.5])));
  graph.tick(0.1);
  expect(graph.object('sign')?.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0.5]);
  graph.dispose();
});
