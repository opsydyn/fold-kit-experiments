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
  mesh,
  type MeshNode,
  physics,
  type PhysicsEngine,
  recordingRendererFactory,
  scene,
  type SceneEvent,
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

/** Drives the world through `scheduled` to step 240 with frames at random gaps. */
function run(engine: PhysicsEngine, seed: number, scheduled = throws) {
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
    const last = reports.at(-1);
    if (last === undefined || last.step === timeline.reached) continue;
    const due = Timeline.due(Timeline.reach(timeline, last.step));
    timeline = due.timeline;
    thrown.push(...due.inputs);
    render();
  }
  graph.dispose();
  return reports;
}

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
