import { expect, test } from 'bun:test';

import { Vector3 } from 'three';
import { BoxGeometry, SphereGeometry } from 'three';

import {
  body,
  box,
  colliderFor,
  createSceneGraph,
  createSceneLoop,
  fixed,
  group,
  type MeshNode,
  mesh,
  physics,
  recordingRendererFactory,
  scene,
  type SceneEvent,
  sphere,
  standard,
} from '../src/kernel/index.ts';
import { fakePhysics } from './support/fakePhysics.ts';

const crate = (options: Partial<Parameters<typeof mesh>[0]> = {}): MeshNode =>
  mesh({
    key: 'crate',
    position: [0, 10, 0],
    geometry: box(),
    material: standard(),
    body: body(),
    ...options,
  });

const world = (children: ReadonlyArray<MeshNode | ReturnType<typeof group>>, paused = false) =>
  scene({ physics: physics({ paused }), children });

const setup = () => {
  const { engine, worlds } = fakePhysics();
  const graph = createSceneGraph({ physics: engine });
  return { graph, worlds, current: () => worlds.at(-1) };
};

test('a dynamic body falls on scene time, in fixed steps, with poses interpolated', () => {
  const { graph, current } = setup();
  graph.reconcile(world([crate()]));
  graph.tick(0);
  expect(current()?.calls).toEqual(['add crate']);
  // A cuboid from the unit box's bounding box.
  expect(current()?.bodies.get('crate')?.shape).toEqual({
    _tag: 'Cuboid',
    halfExtents: [0.5, 0.5, 0.5],
    offset: [0, 0, 0],
  });
  for (let frame = 1; frame <= 60; frame++) graph.tick(frame / 60);
  const y = graph.object('crate')?.position.y ?? 0;
  // About ½·9.81·1² down after a second of frames.
  expect(10 - y).toBeGreaterThan(4.5);
  expect(10 - y).toBeLessThan(5.2);
  expect(graph.needsFrame()).toBe(true);

  // Half a step later the mesh is between the last two steps.
  const before = graph.object('crate')?.position.y ?? 0;
  graph.tick(1 + 1 / 120);
  const between = graph.object('crate')?.position.y ?? 0;
  expect(between).toBeLessThan(before);
  graph.dispose();
});

test('re-rendering the same description changes nothing; a new position teleports', () => {
  const { graph, current } = setup();
  graph.reconcile(world([crate()]));
  graph.tick(0);
  graph.tick(0.5);
  graph.reconcile(world([crate()]));
  expect(current()?.calls).toEqual(['add crate']);

  graph.reconcile(world([crate({ position: [3, 2, 1] })]));
  expect(current()?.calls.at(-1)).toBe('teleport crate');
  expect(graph.object('crate')?.position.toArray()).toEqual([3, 2, 1]);
  graph.dispose();
});

test('an impulse is applied once per id; body settings update in place', () => {
  const { graph, current } = setup();
  const kick = (id: number) => crate({ body: body({ impulse: { id, impulse: [0, 5, 0] } }) });
  graph.reconcile(world([kick(1)]));
  graph.reconcile(world([kick(1)]));
  graph.reconcile(world([kick(2)]));
  expect(current()?.calls.filter((call) => call.startsWith('impulse'))).toHaveLength(2);

  graph.reconcile(world([crate({ body: body({ restitution: 0.8 }) })]));
  expect(current()?.calls.at(-1)).toBe('update crate');
  // A new collider kind needs a new body.
  graph.reconcile(world([crate({ body: body({ collider: 'ball' }) })]));
  expect(current()?.calls.slice(-2)).toEqual(['remove crate', 'add crate']);
  graph.dispose();
});

test('a kinematic body follows its node; paused worlds and fixed bodies hold still', () => {
  const { graph, current } = setup();
  graph.reconcile(
    world([
      crate({ key: 'lift', position: [0, 1, 0], body: body({ type: 'kinematic' }) }),
      crate({ key: 'floor', position: [0, 0, 0], body: body({ type: 'fixed' }) }),
    ]),
  );
  graph.tick(0);
  graph.tick(1 / 60);
  expect(current()?.calls).toContain('kinematic lift 0,1,0');
  expect(graph.object('floor')?.position.y).toBe(0);

  graph.reconcile(world([crate()], true));
  graph.tick(2);
  graph.tick(3);
  graph.drawn();
  expect(graph.object('crate')?.position.y).toBe(10);
  expect(graph.needsFrame()).toBe(false);
  graph.dispose();
});

test('a body under a moved group starts at its world pose and is placed back in the group', () => {
  const { graph, current } = setup();
  graph.reconcile(
    world([
      group({ key: 'shelf', position: [5, 0, 0], children: [crate({ position: [0, 2, 0] })] }),
    ]),
  );
  graph.tick(0);
  expect(current()?.bodies.get('crate')?.pose.position).toEqual([5, 2, 0]);
  graph.tick(0.25);
  // Its local x stays 0: the world pose is converted back into the shelf's space.
  expect(graph.object('crate')?.position.x).toBeCloseTo(0, 9);
  graph.dispose();
});

test('removing bodies or the world frees them; collisions reach the event stream', () => {
  const { graph, worlds, current } = setup();
  graph.reconcile(
    world([crate(), crate({ key: 'ball', geometry: sphere(), position: [0, 5, 0] })]),
  );
  const emitted: Array<SceneEvent> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 1,
    emit: (event) => emitted.push(event),
  });
  current()?.queue.push({ a: 'crate', b: 'ball', started: true });
  graph.tick(0);
  loop.frame();
  expect(emitted).toContainEqual({ _tag: 'Collision', a: 'crate', b: 'ball', started: true });

  graph.reconcile(world([crate()]));
  expect(current()?.calls.at(-1)).toBe('remove ball');
  graph.reconcile(scene({ children: [crate()] }));
  expect(worlds[0]?.disposed).toBe(true);
  graph.dispose();
});

test('colliders scale with the mesh: a ball by its largest scale', () => {
  const ball = colliderFor(new SphereGeometry(1), 'ball', new Vector3(1, 3, 2));
  expect(ball._tag === 'Ball' && ball.radius).toBeCloseTo(3, 6);
  expect(colliderFor(new BoxGeometry(2, 4, 6), 'cuboid', new Vector3(1, 0.5, 2))).toEqual({
    _tag: 'Cuboid',
    halfExtents: [1, 1, 6],
    offset: [0, 0, 0],
  });
});

test('without an engine, bodies stay where the description puts them', () => {
  const graph = createSceneGraph();
  graph.reconcile(world([crate({ rotation: fixed([0, 0, 0]) })]));
  graph.tick(0);
  graph.tick(1);
  expect(graph.object('crate')?.position.y).toBe(10);
  graph.dispose();
});
