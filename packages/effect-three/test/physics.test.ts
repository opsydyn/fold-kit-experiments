import { expect, test } from 'bun:test';

import {
  BoxGeometry,
  Euler,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';

import {
  body,
  bodyRef,
  capsuleCollider,
  cuboidCollider,
  borrowed,
  box,
  colliderFor,
  createSceneGraph,
  createSceneLoop,
  fixed,
  fixedJoint,
  group,
  type Instance,
  instance,
  instances,
  indexScene,
  type Joint,
  joint,
  type MeshNode,
  mesh,
  physics,
  recordingRendererFactory,
  revoluteJoint,
  ropeJoint,
  scene,
  type SceneEvent,
  type SceneGraph,
  type SceneNode,
  sphere,
  sphericalJoint,
  standard,
  velocityMotor,
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

const anchor = crate({ key: 'anchor', position: [0, 5, 0], body: body({ type: 'fixed' }) });
const bob = crate({ key: 'bob', position: [2, 5, 0] });
const hinge = (options: Partial<Parameters<typeof joint>[0]> = {}) =>
  joint({
    key: 'hinge',
    a: 'anchor',
    b: 'bob',
    anchorB: [-2, 0, 0],
    kind: sphericalJoint(),
    ...options,
  });
const jointed = (
  joints: ReadonlyArray<Joint>,
  children: ReadonlyArray<SceneNode> = [anchor, bob],
) => scene({ physics: physics({ joints }), children });

test('a joint is made once both its bodies exist, and again when either is remade', () => {
  const { graph, current } = setup();
  graph.reconcile(jointed([hinge()]));
  expect(current()?.calls).toEqual(['add anchor', 'add bob', 'join hinge']);
  expect(current()?.joints.get('hinge')).toEqual({
    joint: {
      anchorA: [0, 0, 0],
      anchorB: [-2, 0, 0],
      contacts: true,
      kind: { _tag: 'Spherical' },
    },
    a: 'anchor',
    b: 'bob',
  });
  // The same description again: nothing. A new collider kind remakes `bob`, and the joint.
  graph.reconcile(jointed([hinge()]));
  expect(current()?.calls).toHaveLength(3);
  graph.reconcile(
    jointed(
      [hinge()],
      [anchor, crate({ key: 'bob', position: [2, 5, 0], body: body({ collider: 'ball' }) })],
    ),
  );
  expect(current()?.calls.slice(3)).toEqual([
    'remove bob',
    'add bob',
    'unjoin hinge',
    'join hinge',
  ]);

  // A changed joint is remade; one whose body goes is dropped; one no longer described goes.
  graph.reconcile(jointed([hinge({ kind: ropeJoint(3) })]));
  expect(current()?.calls.slice(-2)).toEqual(['unjoin hinge', 'join hinge']);
  graph.reconcile(
    jointed([hinge()], [anchor, crate({ key: 'bob', position: [2, 5, 0], body: null })]),
  );
  expect(current()?.calls.slice(-2)).toEqual(['remove bob', 'unjoin hinge']);
  graph.reconcile(jointed([hinge()]));
  expect(current()?.calls.slice(-2)).toEqual(['add bob', 'join hinge']);
  graph.reconcile(jointed([]));
  expect(current()?.calls.at(-1)).toBe('unjoin hinge');
  expect(current()?.calls.filter((call) => call === 'configure')).toEqual([]);
  graph.dispose();
});

test('a fixed joint gets its frames as quaternions; joints can hold instances', () => {
  const { graph, current } = setup();
  const welded = joint({
    key: 'weld',
    a: 'anchor',
    b: bodyRef('balls', 'b'),
    kind: fixedJoint({ frameB: [0, Math.PI, 0] }),
  });
  graph.reconcile(jointed([welded], [anchor, balls([ball('a', 5), ball('b', 10)])]));
  const made = current()?.joints.get('weld');
  expect(made?.b).toBe('balls\u0000b');
  const kind = made?.joint.kind;
  expect(kind?._tag === 'Fixed' ? kind.frameB[1] : 0).toBeCloseTo(1, 9);
  graph.dispose();
});

test('joints are validated: keys unique, bodies named in the scene', () => {
  const graph = createSceneGraph();
  expect(graph.reconcile(jointed([hinge(), hinge()]))._tag).toBe('Invalid');
  expect(indexScene(jointed([hinge(), hinge()]))).toMatchObject({
    _tag: 'Invalid',
    error: { _tag: 'DuplicateJointKey', key: 'hinge' },
  });
  expect(indexScene(jointed([hinge({ b: 'ghost' })]))).toMatchObject({
    _tag: 'Invalid',
    error: { _tag: 'UnknownJointBody', joint: 'hinge', body: 'ghost' },
  });
  graph.dispose();
});

test('a body turned by the simulation keeps its colliders: rounding is not a reshape', () => {
  const { graph, current } = setup();
  const description = world([crate({ scale: [1.3, 1.3, 1.3] })]);
  graph.reconcile(description);
  graph.tick(0);
  const held = current()?.bodies.get('crate');
  if (held === undefined) throw new Error('no body');
  // The simulation turns it; the description, and so a reconcile, says nothing new.
  const turn = new Quaternion().setFromEuler(new Euler(0.3, 0.7, 1.1));
  held.pose = { ...held.pose, quaternion: [turn.x, turn.y, turn.z, turn.w] };
  for (let frame = 1; frame <= 10; frame++) graph.tick(frame / 60);
  graph.reconcile(description);
  expect(current()?.calls).toEqual(['add crate']);
  graph.dispose();
});

test('a body’s own colliders replace its geometry’s, scaled with it; changing them remakes it', () => {
  const { graph, current } = setup();
  const own = (halfHeight: number) =>
    world([
      crate({
        scale: [2, 2, 2],
        body: body({
          colliders: [
            capsuleCollider({ halfHeight, radius: 0.25, position: [0, 0.5, 0] }),
            cuboidCollider({ halfExtents: [1, 0.1, 1], rotation: [0, Math.PI / 2, 0] }),
          ],
        }),
      }),
    ]);
  graph.reconcile(own(0.5));
  const [capsule, cuboid] = current()?.bodies.get('crate')?.colliders ?? [];
  // Scaled by the crate's scale of 2: the capsule's sizes and its offset.
  expect(capsule).toMatchObject({
    shape: { _tag: 'Capsule', halfHeight: 1, radius: 0.5 },
    translation: [0, 1, 0],
  });
  expect(cuboid?.shape).toEqual({ _tag: 'Cuboid', halfExtents: [2, 0.2, 2] });
  expect(cuboid?.rotation[1]).toBeCloseTo(Math.SQRT1_2, 9);
  graph.reconcile(own(0.5));
  expect(current()?.calls).toEqual(['add crate']);
  graph.reconcile(own(0.75));
  expect(current()?.calls).toEqual(['add crate', 'remove crate', 'add crate']);
  graph.dispose();
});

test('contact forces reach the event stream, named by node and instance', () => {
  const { graph, current } = setup();
  graph.reconcile(world([crate({ body: body({ contactForces: 50 }) }), balls([ball('a', 5)])]));
  const emitted: Array<SceneEvent> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 1,
    emit: (event) => emitted.push(event),
  });
  current()?.forces.push({
    a: 'crate',
    b: 'balls\u0000a',
    totalForce: [0, 80, 0],
    totalForceMagnitude: 80,
    maxForceDirection: [0, 1, 0],
    maxForceMagnitude: 80,
  });
  graph.tick(0);
  graph.tick(1 / 60);
  loop.frame();
  expect(emitted).toContainEqual({
    _tag: 'ContactForce',
    a: 'crate',
    b: 'balls',
    bInstance: 'a',
    totalForce: [0, 80, 0],
    totalForceMagnitude: 80,
    maxForceDirection: [0, 1, 0],
    maxForceMagnitude: 80,
  });
  graph.dispose();
});

test('the debug view draws the world’s lines while asked, and goes when not', () => {
  const { graph } = setup();
  const debugLines = () => graph.scene.getObjectByName('physics-debug');
  graph.reconcile(scene({ physics: physics({ debug: true }), children: [crate()] }));
  const lines = debugLines();
  expect(lines).toBeInstanceOf(LineSegments);
  // The fake engine draws a unit line up from each body: the crate is at y = 10.
  const positions =
    lines instanceof LineSegments ? lines.geometry.getAttribute('position') : undefined;
  expect(positions?.getY(0)).toBe(10);
  graph.tick(0);
  graph.tick(0.5);
  expect(positions?.getY(0)).toBeLessThan(10);
  graph.reconcile(scene({ physics: physics(), children: [crate()] }));
  expect(debugLines()).toBeUndefined();
  // In a still (paused) world, turning the lines on asks for the frame that shows them.
  graph.reconcile(scene({ physics: physics({ paused: true }), children: [crate()] }));
  graph.drawn();
  expect(graph.needsFrame()).toBe(false);
  graph.reconcile(scene({ physics: physics({ paused: true, debug: true }), children: [crate()] }));
  expect(graph.needsFrame()).toBe(true);
  graph.dispose();
});

test('a motor travels with its joint to the engine, and a new motor remakes the joint', () => {
  const { graph, current } = setup();
  const driven = (velocity: number) =>
    jointed([hinge({ kind: revoluteJoint({ axis: [0, 0, 1], motor: velocityMotor(velocity) }) })]);
  graph.reconcile(driven(2));
  expect(current()?.joints.get('hinge')?.joint.kind).toEqual({
    _tag: 'Revolute',
    axis: [0, 0, 1],
    limits: null,
    motor: { position: 0, velocity: 2, stiffness: 0, damping: 1 },
  });
  graph.reconcile(driven(3));
  expect(current()?.calls.slice(-2)).toEqual(['unjoin hinge', 'join hinge']);
  graph.dispose();
});
