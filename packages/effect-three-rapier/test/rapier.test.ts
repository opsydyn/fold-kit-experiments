import { beforeAll, expect, test } from 'bun:test';

import {
  body,
  box,
  capsuleCollider,
  cylinder,
  createSceneGraph,
  createSceneLoop,
  group,
  instance,
  instances,
  joint,
  type JointKind,
  mesh,
  type MeshNode,
  physics,
  type PhysicsEngine,
  recordingRendererFactory,
  revoluteJoint,
  ropeJoint,
  scene,
  type SceneEvent,
  sphere,
  sphericalJoint,
  standard,
  type Vec3,
  velocityMotor,
} from '@opsydyn/effect-three';
import { Euler, InstancedMesh, LineSegments, Matrix4, Quaternion, Vector3 } from 'three';

import { loadRapier } from '../src/index.ts';

let engine: PhysicsEngine;
const matrix = new Matrix4();

/** The height of instance `slot` of an instanced mesh. */
function heightAt(mesh: InstancedMesh, slot: number): number {
  mesh.getMatrixAt(slot, matrix);
  return new Vector3().setFromMatrixPosition(matrix).y;
}

beforeAll(async () => {
  engine = await loadRapier();
});

/** A 20 × 1 × 20 slab whose top is at y = 0. */
const floor = mesh({
  key: 'floor',
  position: [0, -0.5, 0],
  geometry: box({ width: 20, height: 1, depth: 20 }),
  material: standard(),
  body: body({ type: 'fixed' }),
});

const ball = (options: Partial<Parameters<typeof body>[0]> = {}, y = 3): MeshNode =>
  mesh({
    key: 'ball',
    position: [0, y, 0],
    geometry: sphere({ radius: 0.5 }),
    material: standard(),
    body: body({ collider: 'ball', ...options }),
  });

/** Runs the graph's clock for `seconds` of 60 Hz frames, returning the ball's heights. */
const run = (graph: ReturnType<typeof createSceneGraph>, from: number, seconds: number) => {
  const heights: Array<number> = [];
  for (let frame = 1; frame <= seconds * 60; frame++) {
    graph.tick(from + frame / 60);
    heights.push(graph.object('ball')?.position.y ?? Number.NaN);
  }
  return heights;
};

test('a ball dropped on a fixed floor comes to rest on it, and the world falls asleep', () => {
  const graph = createSceneGraph({ physics: engine });
  graph.reconcile(scene({ physics: physics(), children: [floor, ball()] }));
  graph.tick(0);
  run(graph, 0, 4);
  expect(graph.object('ball')?.position.y).toBeCloseTo(0.5, 2);
  graph.drawn();
  run(graph, 4, 2);
  expect(graph.needsFrame()).toBe(false);
  graph.dispose();
});

/** The highest the ball gets after first touching the floor. */
function peakAfterLanding(restitution: number): number {
  const graph = createSceneGraph({ physics: engine });
  graph.reconcile(scene({ physics: physics(), children: [floor, ball({ restitution })] }));
  graph.tick(0);
  const heights = run(graph, 0, 3);
  graph.dispose();
  const landed = heights.findIndex((height) => height < 0.55);
  return Math.max(...heights.slice(landed));
}

test('restitution bounces it back up; without it, it stays down', () => {
  // Rapier averages the two colliders' restitution: 0.9 on the 0 floor bounces at 0.45,
  // about half a metre back up from a 2.5 m fall.
  expect(peakAfterLanding(0.9)).toBeGreaterThan(0.85);
  expect(peakAfterLanding(0)).toBeLessThan(0.6);
});

test('an impulse with a new id kicks a resting ball once; collisions are reported', () => {
  const graph = createSceneGraph({ physics: engine });
  const events: Array<SceneEvent> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 0,
    emit: (event) => events.push(event),
  });
  graph.reconcile(scene({ physics: physics(), children: [floor, ball({}, 0.5)] }));
  graph.tick(0);
  run(graph, 0, 1);
  loop.frame();
  expect(events).toContainEqual({ _tag: 'Collision', a: 'floor', b: 'ball', started: true });

  graph.reconcile(
    scene({
      physics: physics(),
      children: [floor, ball({ impulse: { id: 1, impulse: [0, 5, 0] } }, 0.5)],
    }),
  );
  const kicked = run(graph, 1, 1);
  expect(Math.max(...kicked)).toBeGreaterThan(1.5);
  graph.dispose();
});

test('a group body falls as one: a dumbbell rests on both ends', () => {
  const graph = createSceneGraph({ physics: engine });
  graph.reconcile(
    scene({
      physics: physics(),
      children: [
        floor,
        group({
          key: 'dumbbell',
          position: [0, 2, 0],
          body: body({ collider: 'ball' }),
          children: [-1, 1].map((x) =>
            mesh({
              key: `end-${x}`,
              position: [x, 0, 0],
              geometry: sphere({ radius: 0.4 }),
              material: standard(),
            }),
          ),
        }),
      ],
    }),
  );
  graph.tick(0);
  for (let frame = 1; frame <= 240; frame++) graph.tick(frame / 60);
  const dumbbell = graph.object('dumbbell');
  // Both balls on the floor: the group's middle sits a radius up, level.
  expect(dumbbell?.position.y).toBeCloseTo(0.4, 2);
  expect(Math.abs(dumbbell?.rotation.z ?? 1)).toBeLessThan(0.01);
  graph.dispose();
});

test('instanced balls stack: each instance is a body, resting on the one below', () => {
  const graph = createSceneGraph({ physics: engine });
  const column = instances({
    key: 'column',
    geometry: sphere({ radius: 0.5 }),
    material: standard(),
    instances: [1, 3, 5].map((y, i) => instance({ key: `b${i}`, position: [0, y, 0] })),
    body: body({ collider: 'ball' }),
  });
  const events: Array<SceneEvent> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 0,
    emit: (event) => events.push(event),
  });
  graph.reconcile(scene({ physics: physics(), children: [floor, column] }));
  graph.tick(0);
  for (let frame = 1; frame <= 4 * 60; frame++) graph.tick(frame / 60);
  loop.frame();
  const mesh = graph.object('column');
  if (!(mesh instanceof InstancedMesh)) throw new Error('not instanced');
  const heights = [0, 1, 2].map((slot) => heightAt(mesh, slot));
  // A frictionless stack of balls topples; each rests on the floor or another ball.
  for (const y of heights) expect(y).toBeGreaterThan(0.45);
  expect(Math.min(...heights)).toBeCloseTo(0.5, 1);
  // The bottom ball hits the floor; Rapier may name either body first.
  const pairs = events.flatMap((event) =>
    event._tag === 'Collision'
      ? [
          [`${event.a}/${event.aInstance ?? ''}`, `${event.b}/${event.bInstance ?? ''}`]
            .sort()
            .join(' '),
        ]
      : [],
  );
  expect(pairs).toContain('column/b0 floor/');
  graph.dispose();
});

/** A fixed post at y = 5 and a ball two units to its right, joined by `kind`. */
const pendulum = (kind: JointKind, anchorB: Vec3 = [-2, 0, 0]) =>
  scene({
    physics: physics({ joints: [joint({ key: 'arm', a: 'post', b: 'ball', anchorB, kind })] }),
    children: [
      mesh({
        key: 'post',
        position: [0, 5, 0],
        geometry: box({ width: 0.2, height: 0.2, depth: 0.2 }),
        material: standard(),
        body: body({ type: 'fixed', sensor: true }),
      }),
      mesh({
        key: 'ball',
        position: [2, 5, 0],
        geometry: sphere({ radius: 0.25 }),
        material: standard(),
        body: body({ collider: 'ball' }),
      }),
    ],
  });

/** The ball's distance from the post's centre, and its height, over `seconds`. */
const swing = (description: ReturnType<typeof scene>, seconds: number) => {
  const graph = createSceneGraph({ physics: engine });
  graph.reconcile(description);
  graph.tick(0);
  const samples = run(graph, 0, seconds).map((y, i) => ({ y, i }));
  const position = graph.object('ball')?.position ?? new Vector3();
  const reach = position.distanceTo(new Vector3(0, 5, 0));
  graph.dispose();
  return { lowest: Math.min(...samples.map(({ y }) => y)), reach, end: position.y };
};

test('a spherical joint swings the ball on a two unit arm', () => {
  const { lowest, reach } = swing(pendulum(sphericalJoint()), 2);
  expect(lowest).toBeLessThan(3.2);
  expect(reach).toBeCloseTo(2, 1);
});

test('a revolute joint with limits stops the arm at its limit', () => {
  const limit = 0.3;
  const { lowest } = swing(
    pendulum(revoluteJoint({ axis: [0, 0, 1], limits: [-limit, limit] })),
    2,
  );
  // Hinged about z, it may turn only 0.3 rad below level.
  expect(lowest).toBeGreaterThan(5 - 2 * Math.sin(limit) - 0.1);
  expect(lowest).toBeLessThan(5 - 2 * Math.sin(limit) + 0.1);
});

test('a rope joint lets the ball fall until the rope is taut', () => {
  const { reach, end } = swing(pendulum(ropeJoint(3), [0, 0, 0]), 3);
  expect(reach).toBeLessThan(3.1);
  expect(end).toBeLessThan(5);
});

test('reconciling the same scene every frame leaves a rolling ball be: one contact, not one a frame', () => {
  const graph = createSceneGraph({ physics: engine });
  const description = scene({
    physics: physics(),
    children: [floor, ball({ angularVelocity: [0, 0, -6], friction: 1 }, 0.6)],
  });
  const events: Array<SceneEvent> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 0,
    emit: (event) => events.push(event),
  });
  graph.reconcile(description);
  graph.tick(0);
  for (let frame = 1; frame <= 120; frame++) {
    graph.tick(frame / 60);
    loop.frame();
    // As an app does when each collision becomes a Message: the same description again.
    graph.reconcile(description);
  }
  const contacts = events.filter((event) => event._tag === 'Collision' && event.started);
  expect(contacts).toHaveLength(1);
  // And it rolled, rather than being remade at rest each frame.
  expect(graph.object('ball')?.position.x ?? 0).toBeGreaterThan(1);
  graph.dispose();
});

/** A fixed ball and a dynamic one in the same place, held by a joint. */
function collisions(contacts: boolean): number {
  const graph = createSceneGraph({ physics: engine });
  const events: Array<SceneEvent> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 0,
    emit: (event) => events.push(event),
  });
  const held = joint({
    key: 'arm',
    a: 'post',
    b: 'ball',
    anchorB: [-0.1, 0, 0],
    kind: sphericalJoint(),
    contacts,
  });
  graph.reconcile(
    scene({
      physics: physics({ joints: [held] }),
      children: [
        mesh({
          key: 'post',
          position: [0, 5, 0],
          geometry: sphere({ radius: 0.25 }),
          material: standard(),
          body: body({ type: 'fixed', collider: 'ball' }),
        }),
        ball({}, 5),
      ],
    }),
  );
  graph.tick(0);
  run(graph, 0, 0.5);
  loop.frame();
  graph.dispose();
  return events.filter((event) => event._tag === 'Collision').length;
}

test('a joint without contacts lets its bodies overlap without colliding', () => {
  expect(collisions(true)).toBeGreaterThan(0);
  expect(collisions(false)).toBe(0);
});

test('a body’s own capsule collider, not its box, rests on the floor', () => {
  const graph = createSceneGraph({ physics: engine });
  graph.reconcile(
    scene({
      physics: physics(),
      children: [
        floor,
        mesh({
          key: 'ball',
          position: [0, 3, 0],
          geometry: box(),
          material: standard(),
          // A capsule standing 0.5 + 0.25 high from its middle: it rests at y = 0.75, where
          // the unit box would rest at 0.5.
          body: body({ colliders: [capsuleCollider({ halfHeight: 0.5, radius: 0.25 })] }),
        }),
      ],
    }),
  );
  graph.tick(0);
  const heights = run(graph, 0, 3);
  expect(heights.at(-1)).toBeCloseTo(0.75, 1);
  graph.dispose();
});

test('a body with a threshold reports how hard it lands', () => {
  const graph = createSceneGraph({ physics: engine });
  const events: Array<SceneEvent> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 0,
    emit: (event) => events.push(event),
  });
  graph.reconcile(
    scene({ physics: physics(), children: [floor, ball({ contactForces: 1, mass: 5 }, 2)] }),
  );
  graph.tick(0);
  run(graph, 0, 2);
  loop.frame();
  const forces = events.filter((event) => event._tag === 'ContactForce');
  expect(forces.length).toBeGreaterThan(0);
  const strongest = Math.max(
    ...forces.map((event) => (event._tag === 'ContactForce' ? event.totalForceMagnitude : 0)),
  );
  // At rest a 5 kg ball presses 5 × 9.81 ≈ 49 N into the floor; landing presses harder.
  expect(strongest).toBeGreaterThan(40);
  graph.dispose();
});

test('a velocity motor turns a wheel on its hinge', () => {
  const graph = createSceneGraph({ physics: engine });
  const hinge = joint({
    key: 'axle',
    a: 'post',
    b: 'wheel',
    kind: revoluteJoint({ axis: [0, 0, 1], motor: velocityMotor(3, 10) }),
    contacts: false,
  });
  graph.reconcile(
    scene({
      physics: physics({ gravity: [0, 0, 0], joints: [hinge] }),
      children: [
        mesh({
          key: 'post',
          position: [0, 2, 0],
          geometry: box({ width: 0.1, height: 0.1, depth: 0.1 }),
          material: standard(),
          body: body({ type: 'fixed' }),
        }),
        mesh({
          key: 'wheel',
          position: [0, 2, 0],
          geometry: cylinder({ radiusTop: 0.5, radiusBottom: 0.5, height: 0.1 }),
          material: standard(),
          body: body({ collider: 'hull' }),
        }),
      ],
    }),
  );
  graph.tick(0);
  const angleOf = (): number =>
    new Euler().setFromQuaternion(graph.object('wheel')?.quaternion ?? new Quaternion()).z;
  expect(angleOf()).toBeCloseTo(0, 5);
  // At about 3 rad/s about z, half a second turns it well over a radian, in place.
  for (let frame = 1; frame <= 30; frame++) graph.tick(frame / 60);
  expect(Math.abs(angleOf())).toBeGreaterThan(1);
  const spin = graph.object('wheel');
  expect(spin?.position.y).toBeCloseTo(2, 2);
  graph.dispose();
});

test('the debug view draws Rapier’s lines for the colliders', () => {
  const graph = createSceneGraph({ physics: engine });
  graph.reconcile(scene({ physics: physics({ debug: true }), children: [floor, ball()] }));
  const lines = graph.scene.getObjectByName('physics-debug');
  const drawn = lines instanceof LineSegments ? lines.geometry.getAttribute('position').count : 0;
  expect(drawn).toBeGreaterThan(10);
  graph.dispose();
});
