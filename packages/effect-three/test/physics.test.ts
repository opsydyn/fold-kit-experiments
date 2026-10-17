import { expect, test } from 'bun:test';

import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, SphereGeometry, Vector3 } from 'three';

import {
  body,
  borrowed,
  box,
  colliderFor,
  createSceneGraph,
  createSceneLoop,
  fixed,
  group,
  type Instance,
  instance,
  instances,
  type MeshNode,
  mesh,
  physics,
  recordingRendererFactory,
  scene,
  type SceneEvent,
  type SceneGraph,
  type SceneNode,
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

const world = (children: ReadonlyArray<SceneNode>, paused = false) =>
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
  expect(current()?.bodies.get('crate')?.colliders).toEqual([
    {
      shape: { _tag: 'Cuboid', halfExtents: [0.5, 0.5, 0.5] },
      translation: [0, 0, 0],
      rotation: [0, 0, 0, 1],
    },
  ]);
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
  const ball = colliderFor(new SphereGeometry(1), 'ball', new Vector3(1, 3, 2)).shape;
  expect(ball._tag === 'Ball' && ball.radius).toBeCloseTo(3, 6);
  expect(colliderFor(new BoxGeometry(2, 4, 6), 'cuboid', new Vector3(1, 0.5, 2)).shape).toEqual({
    _tag: 'Cuboid',
    halfExtents: [1, 1, 6],
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

test('a body on a group has a collider per mesh inside it, placed in the group', () => {
  const { graph, current } = setup();
  graph.reconcile(
    scene({
      physics: physics(),
      children: [
        group({
          key: 'dumbbell',
          position: [0, 5, 0],
          body: body(),
          children: [
            mesh({ key: 'left', position: [-1, 0, 0], geometry: box(), material: standard() }),
            mesh({
              key: 'right',
              position: [1, 0, 0],
              rotation: fixed([0, Math.PI / 2, 0]),
              scale: [2, 2, 2],
              geometry: box(),
              material: standard(),
            }),
          ],
        }),
      ],
    }),
  );
  const colliders = current()?.bodies.get('dumbbell')?.colliders ?? [];
  expect(colliders.map((collider) => collider.translation)).toEqual([
    [-1, 0, 0],
    [1, 0, 0],
  ]);
  // The right block's collider is its world size, turned as it is.
  expect(colliders[1]?.shape).toEqual({ _tag: 'Cuboid', halfExtents: [1, 1, 1] });
  expect(colliders[1]?.rotation[1]).toBeCloseTo(Math.SQRT1_2, 9);
  graph.dispose();
});

test('a borrowed model gets colliders when it is lent, and loses them when withdrawn', () => {
  const { graph, current } = setup();
  graph.reconcile(
    scene({
      physics: physics(),
      children: [borrowed({ key: 'robot', id: 'robot', position: [0, 3, 0], body: body() })],
    }),
  );
  expect(current()?.bodies.get('robot')?.colliders).toEqual([]);
  const model = new Group();
  model.add(new Mesh(new BoxGeometry(1, 2, 1)));
  const withdraw = graph.store.lend('robot', model);
  expect(current()?.bodies.get('robot')?.colliders).toHaveLength(1);
  expect(current()?.calls.slice(-2)).toEqual(['remove robot', 'add robot']);
  withdraw();
  expect(current()?.bodies.get('robot')?.colliders).toEqual([]);
  graph.dispose();
});

const ball = (key: string, y: number, color = 0xffffff) =>
  instance({ key, position: [0, y, 0], scale: [2, 2, 2], color });

const balls = (children: ReadonlyArray<Instance>) =>
  instances({
    key: 'balls',
    position: [3, 0, 0],
    geometry: sphere(),
    material: standard(),
    instances: children,
    body: body({ collider: 'ball' }),
  });

const heightOf = (graph: SceneGraph, slot: number): number => {
  const object = graph.object('balls');
  if (!(object instanceof InstancedMesh)) return Number.NaN;
  object.getMatrixAt(slot, scratch);
  return new Vector3().setFromMatrixPosition(scratch).y;
};

const scratch = new Matrix4();

test('every instance of a bodied instances node is a body, falling in its own slot', () => {
  const { graph, current } = setup();
  graph.reconcile(world([balls([ball('a', 5), ball('b', 10)])]));
  graph.tick(0);
  expect(current()?.calls).toEqual(['add balls\u0000a', 'add balls\u0000b']);
  const held = current()?.bodies.get('balls\u0000b');
  // World pose: the node's position plus the instance's; a ball collider at the instance's scale.
  expect(held?.pose.position).toEqual([3, 10, 0]);
  const shape = held?.colliders[0]?.shape;
  expect(shape?._tag === 'Ball' ? shape.radius : 0).toBeCloseTo(2, 6);
  for (let frame = 1; frame <= 60; frame++) graph.tick(frame / 60);
  expect(10 - heightOf(graph, 1)).toBeGreaterThan(4.5);
  expect(5 - heightOf(graph, 0)).toBeGreaterThan(4.5);
  graph.dispose();
});

test('instance bodies survive other instances changing and the mesh growing', () => {
  const { graph, current } = setup();
  graph.reconcile(world([balls([ball('a', 5), ball('b', 10)])]));
  graph.tick(0);
  for (let frame = 1; frame <= 30; frame++) graph.tick(frame / 60);
  const fallen = heightOf(graph, 0);
  expect(fallen).toBeLessThan(5);

  // A new colour for `a` rewrites its slot; it stays where it fell, not where it began.
  graph.reconcile(world([balls([ball('a', 5, 0xff0000), ball('b', 10)])]));
  expect(heightOf(graph, 0)).toBeCloseTo(fallen, 9);

  // Twenty more instances outgrow the 16 slots: the mesh is replaced, the bodies are not.
  const more = Array.from({ length: 20 }, (_, i) => ball(`n${i}`, 20));
  graph.reconcile(world([balls([ball('a', 5, 0xff0000), ball('b', 10), ...more])]));
  expect(current()?.calls.filter((call) => call.startsWith('remove'))).toEqual([]);
  expect(heightOf(graph, 0)).toBeCloseTo(fallen, 9);
  expect(heightOf(graph, 21)).toBe(20);

  // Moving `b` in the description teleports it alone; dropping `a` removes its body.
  graph.reconcile(world([balls([ball('b', 12), ...more])]));
  expect(current()?.calls.slice(-2)).toEqual(['teleport balls\u0000b', 'remove balls\u0000a']);
  expect(heightOf(graph, 0)).toBe(12);
  graph.dispose();
});

test('collisions name the instance as well as the node', () => {
  const { graph, current } = setup();
  graph.reconcile(world([crate(), balls([ball('a', 5)])]));
  const emitted: Array<SceneEvent> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 1,
    emit: (event) => emitted.push(event),
  });
  current()?.queue.push({ a: 'balls\u0000a', b: 'crate', started: true });
  graph.tick(0);
  loop.frame();
  expect(emitted).toContainEqual({
    _tag: 'Collision',
    a: 'balls',
    aInstance: 'a',
    b: 'crate',
    started: true,
  });
  graph.dispose();
});
