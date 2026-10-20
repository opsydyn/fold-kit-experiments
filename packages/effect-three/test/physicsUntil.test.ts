/**
 * Worlds driven by `physics({ until })` (ADR-014): stepped toward a step the Model sets,
 * stopped there, reported once with a checksum; changes made while one waits land at that
 * step, so how the frames fell does not change what happens.
 */
import { expect, test } from 'bun:test';

import {
  body,
  box,
  createSceneGraph,
  createSceneLoop,
  type MeshNode,
  mesh,
  physics,
  recordingRendererFactory,
  scene,
  type SceneEvent,
  type SceneNode,
  standard,
} from '../src/kernel/index.ts';
import { fakePhysics } from './support/fakePhysics.ts';

const crate = (key: string, impulse: number | null = null): MeshNode =>
  mesh({
    key,
    position: [0, 10, 0],
    geometry: box(),
    material: standard(),
    body: body({ impulse: impulse === null ? null : { id: impulse, impulse: [impulse, 0, 0] } }),
  });

const driven = (until: number, children: ReadonlyArray<SceneNode>) =>
  scene({ physics: physics({ until }), children });

/** A scene graph with the fake engine, its frame loop, and what the loop emits. */
const setup = () => {
  const { engine, worlds } = fakePhysics();
  const graph = createSceneGraph({ physics: engine });
  const emitted: Array<SceneEvent> = [];
  let now = 0;
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => now,
    emit: (event) => emitted.push(event),
  });
  /** One frame at scene time `seconds`. */
  const frame = (seconds: number) => {
    now = seconds;
    loop.frame();
  };
  const reached = () =>
    emitted.flatMap((event) => (event._tag === 'PhysicsReached' ? [event] : []));
  return { graph, frame, reached, emitted, world: () => worlds.at(-1) };
};

const steps = (world: ReturnType<ReturnType<typeof setup>['world']>) => world?.steps ?? 0;

test('a world on until steps toward it at scene time’s pace, stops there and says so once', () => {
  const { graph, frame, reached } = setup();
  graph.reconcile(driven(6, [crate('a')]));
  frame(0);
  frame(2 / 60);
  expect(reached()).toEqual([]);
  expect(graph.needsFrame()).toBe(true);
  frame(4 / 60);
  frame(10);
  frame(20);
  expect(reached().map((event) => event.step)).toEqual([6]);
  // Nothing moves while it waits, however long, and it says nothing more.
  const y = graph.object('a')?.position.y;
  frame(30);
  expect(graph.object('a')?.position.y).toBe(y);
  expect(reached()).toHaveLength(1);
  // Moving on, it goes on from where it stopped: the time it waited is not owed.
  graph.reconcile(driven(9, [crate('a')]));
  frame(30 + 1 / 60);
  expect(reached()).toHaveLength(1);
  frame(30 + 3 / 60);
  expect(reached().map((event) => event.step)).toEqual([6, 9]);
  graph.dispose();
});

/** Runs inputs at steps 3, 6 and 12 with frames `gap` seconds apart; the reports. */
function run(gap: number) {
  const { graph, frame, reached } = setup();
  const inputs = new Map<number, ReadonlyArray<SceneNode>>([
    [0, [crate('a')]],
    [3, [crate('a', 1)]],
    [6, [crate('a', 1), crate('b')]],
    [12, [crate('a', 2), crate('b', 3)]],
  ]);
  const schedule = [0, 3, 6, 12, 20];
  let at = 0;
  let children = inputs.get(0) ?? [];
  graph.reconcile(driven(0, children));
  for (let time = 0; at < schedule.length && time < 10; time += gap) {
    frame(time);
    const last = reached().at(-1);
    if (last === undefined || last.step !== schedule[at]) continue;
    // The Model hears the world reached its step: that step's inputs, and the next step.
    children = inputs.get(last.step) ?? children;
    at += 1;
    graph.reconcile(driven(schedule[at] ?? last.step, children));
  }
  graph.dispose();
  return reached();
}

test('what changes while a world waits lands at that step, however the frames fall', () => {
  const smooth = run(1 / 60);
  expect(smooth.map((event) => event.step)).toEqual([0, 3, 6, 12, 20]);
  expect(run(1 / 23)).toEqual(smooth);
  expect(run(1 / 144)).toEqual(smooth);
  expect(run(0.4)).toEqual(smooth);
  // The checksum follows the poses: a world that did something else differs.
  expect(new Set(smooth.map((event) => event.checksum)).size).toBe(smooth.length);
});

test('far behind, a world goes straight to until, a second of steps a frame', () => {
  const { graph, frame, world, reached } = setup();
  graph.reconcile(driven(600, [crate('a')]));
  // Ten seconds behind: a second's worth of steps each frame, not one.
  frame(0);
  expect(steps(world())).toBe(60);
  frame(1 / 60);
  expect(steps(world())).toBe(120);
  let frames = 2;
  for (; frames < 30 && reached().length === 0; frames++) frame(frames / 60);
  expect(frames).toBe(10);
  expect(reached().map((event) => event.step)).toEqual([600]);
  graph.dispose();
});

test('close behind an until that moves on, a world keeps scene time’s pace', () => {
  const { graph, frame, world } = setup();
  graph.reconcile(driven(0, [crate('a')]));
  frame(0);
  // The Model moves until on as time passes, a little ahead of the world: about a step a
  // frame (a frame's time can fall a hair short of a step, and the next makes it up).
  for (let i = 1; i <= 30; i++) {
    graph.reconcile(driven(Math.ceil(i / 3) * 3 + 6, [crate('a')]));
    frame(i / 60);
    expect(Math.abs(steps(world()) - i)).toBeLessThanOrEqual(1);
  }
  graph.dispose();
});

test('under reduced motion a world on until still steps: other peers wait on it', () => {
  const { graph, frame, reached, world } = setup();
  graph.setAnimating(false);
  graph.reconcile(driven(3, [crate('a')]));
  expect(graph.needsFrame()).toBe(true);
  frame(0);
  frame(3 / 60);
  expect(reached().map((event) => event.step)).toEqual([3]);
  expect(graph.needsFrame()).toBe(false);
  // A world on scene time does not, as before.
  graph.reconcile(scene({ physics: physics(), children: [crate('a')] }));
  const before = steps(world());
  frame(1);
  expect(steps(world())).toBe(before);
  graph.dispose();
});

test('the report follows the collisions of the steps that led there', () => {
  const { graph, frame, emitted, world } = setup();
  graph.reconcile(driven(2, [crate('a'), crate('b')]));
  frame(0);
  world()?.queue.push({ a: 'a', b: 'b', started: true });
  frame(2 / 60);
  const tags = emitted.map((event) => event._tag);
  expect(tags).toEqual(['Collision', 'PhysicsReached']);
  graph.dispose();
});

test('a lower until holds the world where it is, unreported; a new world counts from 0', () => {
  const { graph, frame, reached, world } = setup();
  graph.reconcile(driven(4, [crate('a')]));
  frame(0);
  frame(4 / 60);
  graph.reconcile(driven(2, [crate('a')]));
  frame(1);
  expect(steps(world())).toBe(4);
  expect(reached().map((event) => event.step)).toEqual([4]);
  // Without physics the world goes; with it again, a new one starts at step 0.
  graph.reconcile(scene({ children: [crate('a')] }));
  graph.reconcile(driven(0, [crate('a')]));
  frame(2);
  expect(reached().map((event) => event.step)).toEqual([4, 0]);
  // Changing until alone reconfigures nothing.
  graph.reconcile(driven(1, [crate('a')]));
  expect(world()?.calls).not.toContain('configure');
  graph.dispose();
});

test('a new run throws the world away: bodies start again where the description puts them', () => {
  const { graph, frame, reached, world } = setup();
  graph.reconcile(driven(30, [crate('a')]));
  frame(0);
  frame(1);
  expect(graph.object('a')?.position.y).toBeLessThan(9);
  const first = world();
  graph.reconcile(scene({ physics: physics({ until: 30, run: 1 }), children: [crate('a')] }));
  expect(first?.disposed).toBe(true);
  expect(world()).not.toBe(first);
  // Back at its start, and the new world counts from 0 again.
  expect(graph.object('a')?.position.y).toBe(10);
  frame(2);
  frame(3);
  expect(reached().map((event) => [event.run, event.step])).toEqual([
    [0, 30],
    [1, 30],
  ]);
  expect(reached()[1]?.checksum).toBe(reached()[0]?.checksum);
  graph.dispose();
});

test('moving until on asks for a frame, even when everything in the world is asleep', () => {
  const { graph, frame, reached } = setup();
  const floor = mesh({
    key: 'floor',
    geometry: box(),
    material: standard(),
    body: body({ type: 'fixed' }),
  });
  graph.reconcile(driven(2, [floor]));
  frame(0);
  frame(2 / 60);
  expect(reached().map((event) => event.step)).toEqual([2]);
  expect(graph.needsFrame()).toBe(false);
  let asked = 0;
  graph.onInvalidated(() => {
    asked += 1;
  });
  graph.reconcile(driven(4, [floor]));
  expect(asked).toBeGreaterThan(0);
  expect(graph.needsFrame()).toBe(true);
  graph.dispose();
});
