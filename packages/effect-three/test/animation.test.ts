import { expect, test } from 'bun:test';

import { AnimationClip, Group, NumberKeyframeTrack } from 'three';

import { borrowed, createSceneGraph, play, scene } from '../src/kernel/index.ts';

/** A lent rig: a root with an `arm` whose x slides from 0 to 2 over the one-second clip `slide`. */
const rig = () => {
  const root = new Group();
  const arm = new Group();
  arm.name = 'arm';
  root.add(arm);
  root.animations = [
    new AnimationClip('slide', 1, [new NumberKeyframeTrack('arm.position[x]', [0, 1], [0, 2])]),
  ];
  return { root, arm };
};

const showing = (animation: ReturnType<typeof play> | null, key = 'rig') =>
  scene({ children: [borrowed({ key, id: 'rig', animation })] });

test('a clip is a function of scene time: it plays, loops and rewinds', () => {
  const graph = createSceneGraph();
  const { root, arm } = rig();
  graph.store.lend('rig', root);
  graph.reconcile(showing(play('slide')));
  graph.tick(0.25);
  expect(arm.position.x).toBeCloseTo(0.5, 6);
  graph.tick(1.75);
  expect(arm.position.x).toBeCloseTo(1.5, 6);
  // Back in time (DevTools time travel): the pose follows.
  graph.tick(0.5);
  expect(arm.position.x).toBeCloseTo(1, 6);
  graph.dispose();
});

test('a clip that does not loop holds its last frame, and frames stop once it ends', () => {
  const graph = createSceneGraph();
  const { root, arm } = rig();
  graph.store.lend('rig', root);
  graph.reconcile(showing(play('slide', { loop: false, speed: 2 })));
  graph.tick(0.25);
  graph.drawn();
  expect(arm.position.x).toBeCloseTo(1, 6);
  expect(graph.needsFrame()).toBe(true);
  graph.tick(3);
  graph.drawn();
  expect(arm.position.x).toBeCloseTo(2, 4);
  expect(graph.needsFrame()).toBe(false);
  graph.dispose();
});

test('negative speed plays backwards; changing the clip restarts from now; stopping removes it', () => {
  const graph = createSceneGraph();
  const { root, arm } = rig();
  graph.store.lend('rig', root);
  graph.reconcile(showing(play('slide', { speed: -1 })));
  graph.tick(0.25);
  expect(arm.position.x).toBeCloseTo(1.5, 6);

  graph.reconcile(showing(play('slide', { speed: 1 })));
  graph.tick(0.5);
  expect(arm.position.x).toBeCloseTo(0.5, 6);

  // Stopping returns the object to its rest pose.
  graph.reconcile(showing(null));
  graph.drawn();
  graph.tick(0.9);
  expect(arm.position.x).toBe(0);
  expect(graph.needsFrame()).toBe(false);
  graph.dispose();
});

test('a clone shown by a second node plays its own copy of the clip', () => {
  const graph = createSceneGraph();
  const { root } = rig();
  graph.store.lend('rig', root);
  graph.reconcile(
    scene({
      children: [
        borrowed({ key: 'a', id: 'rig', animation: play('slide') }),
        borrowed({ key: 'b', id: 'rig', animation: play('slide', { speed: 0.5 }) }),
      ],
    }),
  );
  graph.tick(0.5);
  const armOf = (key: string) => graph.object(key)?.children[0]?.getObjectByName('arm');
  expect(armOf('a')?.position.x).toBeCloseTo(1, 6);
  expect(armOf('b')?.position.x).toBeCloseTo(0.5, 6);
  graph.dispose();
});
