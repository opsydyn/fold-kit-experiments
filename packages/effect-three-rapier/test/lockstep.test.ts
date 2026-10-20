/**
 * Real Rapier on `physics({ until })` (ADR-014): a pile of boxes, balls thrown into it at
 * scheduled steps, frames falling at random. Each build reaches every step with the same
 * world (by checksum) however the frames fell, and the deterministic build loads and runs
 * the same engine.
 */
import { beforeAll, expect, test } from 'bun:test';

import {
  body,
  box,
  createSceneGraph,
  createSceneLoop,
  joint,
  mesh,
  type MeshNode,
  physics,
  type PhysicsEngine,
  recordingRendererFactory,
  scene,
  type SceneEvent,
  type PhysicsStart,
  sphere,
  standard,
  Timeline,
} from '@opsydyn/effect-three';

import { loadRapier as loadDeterministic } from '../src/deterministic.ts';
import { loadRapier } from '../src/index.ts';

let standardEngine: PhysicsEngine;
let deterministicEngine: PhysicsEngine;

beforeAll(async () => {
  standardEngine = await loadRapier();
  deterministicEngine = await loadDeterministic();
});

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
    position: [(i % 3) - 1, 0.5 + Math.floor(i / 3), 0],
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

/** Where a run stops for a snapshot, and the snapshot it starts from. */
type Snapshots = { readonly snapshotAt?: number; readonly from?: PhysicsStart };

/**
 * Drives the world through `scheduled` to step 240 with frames at random gaps: from step
 * 0, or `from` a snapshot, the inputs up to its step already in the world.
 */
function run(engine: PhysicsEngine, seed: number, scheduled = throws, snapshots: Snapshots = {}) {
  let random = seed;
  const next = () => {
    random = (random * 16_807) % 2_147_483_647;
    return random / 2_147_483_647;
  };
  const graph = createSceneGraph({ physics: engine });
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
  let timeline = scheduled.reduce(
    (at, { step, input }) => Timeline.schedule(at, step, input),
    Timeline.make<Throw>(240),
  );
  const thrown: Array<Throw> = [];
  if (snapshots.from !== undefined) {
    const due = Timeline.due(Timeline.reach(timeline, snapshots.from.step));
    timeline = due.timeline;
    thrown.push(...due.inputs);
  }
  const render = () =>
    graph.reconcile(
      scene({
        physics: physics({
          until: Timeline.until(timeline),
          snapshotAt: snapshots.snapshotAt ?? null,
          from: snapshots.from ?? null,
        }),
        children: [floor, ...pile, ...thrown.map(ballFor)],
      }),
    );
  render();
  for (let frame = 0; frame < 5000 && timeline.reached !== 240; frame++) {
    now += 0.004 + next() * 0.06;
    loop.frame();
    const last = reports.at(-1);
    // A snapshot's stop is not one the timeline asked for: nothing is due there.
    if (last === undefined || last.step === timeline.reached || last.snapshot !== undefined)
      continue;
    const due = Timeline.due(Timeline.reach(timeline, last.step));
    timeline = due.timeline;
    thrown.push(...due.inputs);
    render();
  }
  graph.dispose();
  return reports;
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

test('each build reaches every step with the same world, however the frames fall', () => {
  for (const engine of [standardEngine, deterministicEngine]) {
    const first = run(engine, 11);
    // It stops only where inputs are due, and at the frontier.
    expect(first.map((report) => report.step)).toEqual([10, 40, 41, 90, 240]);
    for (const seed of [12, 13]) expect(run(engine, seed)).toEqual(first);
  }
});

test('the throws decide the world: without the last one it ends elsewhere', () => {
  const all = run(deterministicEngine, 11);
  const fewer = run(deterministicEngine, 11, throws.slice(0, 3));
  expect(new Set(all.map((report) => report.checksum)).size).toBe(all.length);
  // The same until the throw that was left out, different after it.
  expect(fewer.slice(0, 3)).toEqual(all.slice(0, 3));
  expect(fewer.at(-1)?.checksum).not.toBe(all.at(-1)?.checksum);
});

test('a world started from a snapshot reaches every later step as the world it was taken from', () => {
  for (const engine of [standardEngine, deterministicEngine]) {
    const whole = run(engine, 11, throws, { snapshotAt: 60 });
    const taken = whole.find((report) => report.snapshot !== undefined);
    expect(taken?.step).toBe(60);
    // Taking it changed nothing: the other reports are those of a run without it.
    expect(whole.filter((report) => report.snapshot === undefined)).toEqual(run(engine, 11));
    const from = { step: 60, snapshot: taken?.snapshot ?? '' };
    const resumed = run(engine, 12, throws, { from });
    const after = (reports: typeof whole) =>
      reports.filter((report) => report.step > 60).map(withoutSnapshot);
    expect(resumed.map((report) => report.step)).toEqual([90, 240]);
    expect(after(resumed)).toEqual(after(whole));
  }
});

/** A pendulum: a ball held from a post by a ball-and-socket joint, swinging under gravity. */
function swing(engine: PhysicsEngine, settings: Snapshots) {
  const graph = createSceneGraph({ physics: engine });
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
  graph.reconcile(
    scene({
      physics: physics({
        until: 120,
        snapshotAt: settings.snapshotAt ?? null,
        from: settings.from ?? null,
        joints: [
          joint({
            key: 'rod',
            a: 'post',
            b: 'bob',
            anchorB: [-2, 0, 0],
            kind: { _tag: 'Spherical' },
          }),
        ],
      }),
      children: [
        mesh({
          key: 'post',
          position: [0, 5, 0],
          geometry: box(),
          material: standard(),
          body: body({ type: 'fixed' }),
        }),
        mesh({
          key: 'bob',
          position: [2, 5, 0],
          geometry: sphere({ radius: 0.3 }),
          material: standard(),
          body: body(),
        }),
      ],
    }),
  );
  for (let frame = 0; frame < 20; frame++) {
    now += 1;
    loop.frame();
  }
  graph.dispose();
  return reports;
}

test('a jointed world keeps its joints through a snapshot', () => {
  const whole = swing(deterministicEngine, { snapshotAt: 30 });
  const snapshot = whole[0]?.snapshot ?? '';
  const resumed = swing(deterministicEngine, { from: { step: 30, snapshot } });
  expect(resumed.map((report) => report.step)).toEqual([120]);
  expect(resumed[0]?.checksum).toBe(whole[1]?.checksum);
  // And a swing never snapshotted ends where both did.
  expect(swing(deterministicEngine, {}).at(-1)?.checksum).toBe(whole[1]?.checksum);
});
