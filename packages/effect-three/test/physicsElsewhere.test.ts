/**
 * A world that steps elsewhere (ADR-017), as one in a worker does: what the scene graph
 * asks of it is done later, when a test delivers it, and the graph learns what came back
 * through `received`. Reports of `until` wait for the steps to come back, and say what a
 * world stepping on the spot would have said.
 */
import { expect, test } from 'bun:test';

import {
  body,
  box,
  type BodyPose,
  type Collision,
  createSceneGraph,
  createSceneLoop,
  mesh,
  type PhysicsEngine,
  type PhysicsWorld,
  physics,
  recordingRendererFactory,
  scene,
  type SceneEvent,
  type SceneNode,
  standard,
} from '../src/kernel/index.ts';
import { type FakeWorld, fakePhysics } from './support/fakePhysics.ts';

/** An engine whose worlds do what they are asked only when `deliver` is called. */
const elsewhere = () => {
  const { engine: inner, worlds: inside } = fakePhysics();
  const deliveries: Array<() => void> = [];
  const engine: PhysicsEngine = {
    createWorld: (initial) => {
      // SAFETY: the fake engine's worlds are fake worlds, with their bodies to read.
      const world = inner.createWorld(initial) as FakeWorld;
      const asked: Array<(target: PhysicsWorld) => ReadonlyArray<Collision> | void> = [];
      const poses = new Map<string, BodyPose>();
      let arrived: Array<Collision> = [];
      let owed = 0;
      const later =
        <A extends ReadonlyArray<unknown>>(call: (target: PhysicsWorld, ...args: A) => void) =>
        (...args: A): void => {
          asked.push((target) => call(target, ...args));
        };
      deliveries.push(() => {
        for (const call of asked.splice(0)) arrived.push(...(call(world) ?? []));
        for (const key of world.bodies.keys()) {
          const pose = world.pose(key);
          if (pose !== undefined) poses.set(key, pose);
        }
        owed = 0;
      });
      return {
        configure: later((target, settings) => target.configure(settings)),
        add: later((target, key, described, colliders, pose) =>
          target.add(key, described, colliders, pose),
        ),
        update: later((target, key, described) => target.update(key, described)),
        teleport: later((target, key, pose) => target.teleport(key, pose)),
        moveKinematic: later((target, key, pose) => target.moveKinematic(key, pose)),
        applyImpulse: later((target, key, impulse) => target.applyImpulse(key, impulse)),
        remove: later((target, key) => target.remove(key)),
        addJoint: later((target, id, joint, a, b) => target.addJoint(id, joint, a, b)),
        removeJoint: later((target, id) => target.removeJoint(id)),
        step: (seconds) => {
          owed += 1;
          asked.push((target) => target.step(seconds));
          return [];
        },
        contactForces: () => world.contactForces(),
        debugLines: () => world.debugLines(),
        pose: (key) => poses.get(key),
        awake: () => owed > 0 || world.awake(),
        dispose: () => world.dispose(),
        received: () => {
          const collisions = arrived;
          arrived = [];
          return { collisions, pending: owed > 0 || asked.length > 0 };
        },
      };
    },
  };
  return {
    engine,
    inside,
    deliver: () => {
      for (const delivery of deliveries) delivery();
    },
  };
};

const crate = (key: string): SceneNode =>
  mesh({ key, position: [0, 10, 0], geometry: box(), material: standard(), body: body() });

const driven = (until: number) =>
  scene({ physics: physics({ until }), children: [crate('a'), crate('b')] });

const setup = (engine: PhysicsEngine) => {
  const graph = createSceneGraph({ physics: engine });
  const emitted: Array<SceneEvent> = [];
  let now = 0;
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => now,
    emit: (event) => emitted.push(event),
  });
  const frame = (seconds: number) => {
    now = seconds;
    loop.frame();
  };
  const tagged = <T extends SceneEvent['_tag']>(tag: T) =>
    emitted.filter((event): event is Extract<SceneEvent, { _tag: T }> => event._tag === tag);
  return { graph, frame, tagged };
};

test('a world stepping elsewhere is reported at until once its steps come back, as one stepping here', () => {
  const here = setup(fakePhysics().engine);
  here.graph.reconcile(driven(6));
  for (const time of [0, 3 / 60, 6 / 60, 1]) here.frame(time);
  const expected = here.tagged('PhysicsReached');
  expect(expected.map((event) => event.step)).toEqual([6]);

  const away = elsewhere();
  const there = setup(away.engine);
  there.graph.reconcile(driven(6));
  for (const time of [0, 3 / 60, 6 / 60, 1]) there.frame(time);
  // Asked for all six steps, none back yet: nothing to report, and frames still wanted.
  expect(there.tagged('PhysicsReached')).toEqual([]);
  expect(there.graph.needsFrame()).toBe(true);
  away.deliver();
  there.frame(1 + 1 / 60);
  expect(there.tagged('PhysicsReached')).toEqual(expected);
  // The bodies are shown where the world put them.
  expect(there.graph.object('a')?.position.y).toBe(here.graph.object('a')?.position.y ?? 0);
  here.graph.dispose();
  there.graph.dispose();
});

test('collisions from elsewhere are heard in the frame after they come back', () => {
  const away = elsewhere();
  const there = setup(away.engine);
  there.graph.reconcile(scene({ physics: physics(), children: [crate('a'), crate('b')] }));
  there.frame(0);
  there.frame(1 / 60);
  away.inside.at(-1)?.queue.push({ a: 'a', b: 'b', started: true });
  away.deliver();
  expect(there.tagged('Collision')).toEqual([]);
  there.frame(2 / 60);
  expect(there.tagged('Collision').map(({ a, b, started }) => [a, b, started])).toEqual([
    ['a', 'b', true],
  ]);
  there.graph.dispose();
});
