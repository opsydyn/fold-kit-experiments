/**
 * Rapier in a worker (ADR-017): the same pile and throws as the lockstep test, the world in
 * a worker behind `remotePhysics`. It reaches every step with the world an engine in the
 * page reaches there, by checksum, over a message channel and in a real worker.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';

import {
  body,
  box,
  createSceneGraph,
  createSceneLoop,
  mesh,
  type MeshNode,
  type Physics,
  physics,
  type PhysicsEngine,
  recordingRendererFactory,
  scene,
  type SceneEvent,
  sphere,
  standard,
  Timeline,
} from '@opsydyn/effect-three';

import { loadRapier } from '../src/deterministic.ts';
import { remotePhysics, servePhysics } from '../src/worker.ts';

let engine: PhysicsEngine;
let worker: Worker;

beforeAll(async () => {
  engine = await loadRapier();
  worker = new Worker(new URL('./support/physicsWorker.ts', import.meta.url).href);
});

afterAll(() => worker.terminate());

type Throw = { readonly at: readonly [number, number, number]; readonly push: number };

const floor = mesh({
  key: 'floor',
  position: [0, -0.5, 0],
  geometry: box({ width: 20, height: 1, depth: 20 }),
  material: standard(),
  body: body({ type: 'fixed' }),
});

const pile: ReadonlyArray<MeshNode> = Array.from({ length: 9 }, (_, i) =>
  mesh({
    key: `box-${i}`,
    position: [(i % 3) - 1.1, 0.5 + Math.floor(i / 3) * 1.1, 0.1],
    geometry: box({ width: 0.9, height: 0.9, depth: 0.9 }),
    material: standard(),
    body: body(),
  }),
);

const ballFor = (thrown: Throw, i: number): MeshNode =>
  mesh({
    key: `ball-${i}`,
    position: thrown.at,
    geometry: sphere({ radius: 0.3 }),
    material: standard(),
    body: body({ ccd: true, impulse: { id: 1, impulse: [0, 0, -thrown.push] } }),
  });

const throws: ReadonlyArray<Timeline.Scheduled<Throw>> = [
  { step: 10, input: { at: [0, 1, 6], push: 4 } },
  { step: 40, input: { at: [-1, 2, 6], push: 6 } },
  { step: 41, input: { at: [1, 0.5, 6], push: 5 } },
  { step: 90, input: { at: [0, 2.5, 6], push: 8 } },
];

/** Lets messages between the page and the worker go both ways. */
const settle = () => new Promise((done) => setTimeout(done, 1));

/** Drives the world through the throws to step 240, frames at random gaps, letting the worker answer between frames. */
async function run(physicsEngine: PhysicsEngine, seed: number) {
  let random = seed;
  const next = () => {
    random = (random * 16_807) % 2_147_483_647;
    return random / 2_147_483_647;
  };
  const graph = createSceneGraph({ physics: physicsEngine });
  const reports: Array<Extract<SceneEvent, { readonly _tag: 'PhysicsReached' }>> = [];
  const collided: Array<string> = [];
  let now = 0;
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => now,
    emit: (event) => {
      if (event._tag === 'PhysicsReached') reports.push(event);
      if (event._tag === 'Collision' && event.started) collided.push(`${event.a} ${event.b}`);
    },
  });
  let timeline = throws.reduce(
    (at, { step, input }) => Timeline.schedule(at, step, input),
    Timeline.make<Throw>(240),
  );
  const thrown: Array<Throw> = [];
  const render = () =>
    graph.reconcile(
      scene({
        physics: physics({ until: Timeline.until(timeline) }),
        children: [floor, ...pile, ...thrown.map(ballFor)],
      }),
    );
  render();
  for (let frame = 0; frame < 5000 && timeline.reached !== 240; frame++) {
    now += 0.004 + next() * 0.06;
    loop.frame();
    await settle();
    const last = reports.at(-1);
    if (last === undefined || last.step === timeline.reached) continue;
    const due = Timeline.due(Timeline.reach(timeline, last.step));
    timeline = due.timeline;
    thrown.push(...due.inputs);
    render();
  }
  const shown = graph.object('ball-3')?.position.toArray();
  graph.dispose();
  return { reports, collided: collided.toSorted(), shown };
}

/** A report's run, step and checksum: what peers compare. */
const withoutSnapshot = ({
  run,
  step,
  checksum,
}: {
  run: number;
  step: number;
  checksum: string;
}) => ({
  run,
  step,
  checksum,
});

test('over a message channel, the world reaches every step as the engine in the page does', async () => {
  const here = await run(engine, 11);
  expect(here.reports.map((report) => report.step)).toEqual([10, 40, 41, 90, 240]);
  const channel = new MessageChannel();
  servePhysics(channel.port2, engine);
  const there = await run(remotePhysics(channel.port1), 12);
  expect(there.reports).toEqual(here.reports);
  // The same collisions are heard, and the bodies are shown where the world put them.
  expect(there.collided).toEqual(here.collided);
  expect(there.shown).toEqual(here.shown);
  channel.port1.close();
});

test('in a real worker, the world reaches every step as the engine in the page does', async () => {
  const here = await run(engine, 11);
  const there = await run(remotePhysics(worker), 13);
  expect(there.reports).toEqual(here.reports);
});

/** Reports of the pile under `settings`, until the world reports its `until`. */
async function reportAt(physicsEngine: PhysicsEngine, settings: Partial<Physics>) {
  const graph = createSceneGraph({ physics: physicsEngine });
  const reports: Array<Extract<SceneEvent, { readonly _tag: 'PhysicsReached' }>> = [];
  let now = 0;
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => now,
    emit: (event) => {
      if (event._tag === 'PhysicsReached') reports.push(event);
    },
  });
  // Positions Rapier stores in single precision: the described ones are not its own.
  graph.reconcile(scene({ physics: physics(settings), children: [floor, ...pile] }));
  for (let frame = 0; frame < 200 && reports.at(-1)?.step !== settings.until; frame++) {
    now += 1 / 60;
    loop.frame();
    await settle();
  }
  graph.dispose();
  return reports;
}

test('a world reported where it starts gives the checksum of the engine’s poses, not the described ones', async () => {
  const here = await reportAt(engine, { until: 0 });
  expect(here.map((report) => report.step)).toEqual([0]);
  expect(await reportAt(remotePhysics(worker), { until: 0 })).toEqual(here);
});

test('through a worker, a world snapshots and starts from a snapshot as one in the page does', async () => {
  const here = await reportAt(engine, { until: 0, snapshotAt: 0 });
  const snapshot = here[0]?.snapshot ?? '';
  expect(snapshot.length).toBeGreaterThan(0);
  const there = await reportAt(remotePhysics(worker), { until: 0, snapshotAt: 0 });
  expect(there.map(withoutSnapshot)).toEqual(here.map(withoutSnapshot));
  // Started from it in the worker, and in the page, the world reaches step 30 alike.
  const later = { until: 30, from: { step: 0, snapshot } };
  expect(await reportAt(remotePhysics(worker), later)).toEqual(await reportAt(engine, later));
});
