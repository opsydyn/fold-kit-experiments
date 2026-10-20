/**
 * Timelines of physics steps (ADR-014): inputs handed out at the step they were stamped
 * with, the world held there until they are. Driving a scene graph's world with one, any
 * frame timing, and a replay from the start, give the same world at every step.
 */
import { expect, test } from 'bun:test';

import {
  body,
  box,
  createSceneGraph,
  createSceneLoop,
  mesh,
  physics,
  recordingRendererFactory,
  scene,
  type SceneEvent,
  standard,
  Timeline,
} from '../src/kernel/index.ts';
import { seededRandom } from '../src/kernel/seeded.ts';
import { fakePhysics } from './support/fakePhysics.ts';

test('inputs are handed out at their step, in order; until stops at the next one', () => {
  let timeline = Timeline.make<string>(0);
  expect(Timeline.until(timeline)).toBe(0);
  timeline = Timeline.extend(timeline, 10);
  timeline = Timeline.schedule(timeline, 6, 'b');
  timeline = Timeline.schedule(timeline, 3, 'a');
  timeline = Timeline.schedule(timeline, 6, 'c');
  expect(timeline.inputs.map((each) => each.input)).toEqual(['a', 'b', 'c']);
  // Nothing is due before the world says where it is.
  expect(Timeline.due(timeline).inputs).toEqual([]);
  expect(Timeline.until(timeline)).toBe(3);

  timeline = Timeline.reach(timeline, 3);
  const first = Timeline.due(timeline);
  expect(first.inputs).toEqual(['a']);
  expect(Timeline.until(first.timeline)).toBe(6);
  // Asking again hands out nothing more.
  expect(Timeline.due(first.timeline).inputs).toEqual([]);

  const second = Timeline.due(Timeline.reach(first.timeline, 6));
  expect(second.inputs).toEqual(['b', 'c']);
  expect(Timeline.until(second.timeline)).toBe(10);
  // The frontier never goes back.
  expect(Timeline.extend(second.timeline, 4).frontier).toBe(10);

  // A restart hands everything out again, from the start.
  const again = Timeline.restart(second.timeline);
  expect(again.applied).toBe(0);
  expect(again.reached).toBeNull();
  expect(Timeline.until(again)).toBe(3);
});

test('an input stamped with the step the world waits at is due at once', () => {
  let timeline = Timeline.reach(Timeline.make<string>(4), 4);
  expect(Timeline.due(timeline).inputs).toEqual([]);
  timeline = Timeline.schedule(timeline, 4, 'now');
  expect(Timeline.until(timeline)).toBe(4);
  expect(Timeline.due(timeline).inputs).toEqual(['now']);
});

type Kick = { readonly key: string; readonly push: number };

/**
 * A world driven by a timeline of kicks (each adds a crate, or pushes one again), with
 * frames at seeded random gaps: every report it makes.
 */
const drive = (inputs: ReadonlyArray<Timeline.Scheduled<Kick>>, frontier: number, seed: number) => {
  const random = seededRandom(seed);
  const { engine } = fakePhysics();
  const graph = createSceneGraph({ physics: engine });
  const reports: Array<SceneEvent> = [];
  let now = 0;
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => now,
    emit: (event) => {
      if (event._tag === 'PhysicsReached') reports.push(event);
    },
  });
  let timeline = inputs.reduce(
    (at, { step, input }) => Timeline.schedule(at, step, input),
    Timeline.make<Kick>(frontier),
  );
  /** The world's state in the Model: each crate's latest push, by key. */
  const pushes = new Map<string, number>();
  const render = () =>
    graph.reconcile(
      scene({
        physics: physics({ until: Timeline.until(timeline) }),
        children: [...pushes].map(([key, push]) =>
          mesh({
            key,
            position: [0, 10, 0],
            geometry: box(),
            material: standard(),
            body: body({ impulse: { id: push, impulse: [push, push, 0] } }),
          }),
        ),
      }),
    );
  render();
  for (let frame = 0; frame < 2000 && timeline.reached !== frontier; frame++) {
    now += 0.002 + random() * 0.1;
    loop.frame();
    const last = reports.at(-1);
    if (last?._tag !== 'PhysicsReached' || last.step === timeline.reached) continue;
    const next = Timeline.due(Timeline.reach(timeline, last.step));
    timeline = next.timeline;
    for (const kick of next.inputs) pushes.set(kick.key, kick.push);
    render();
  }
  graph.dispose();
  return reports;
};

test('a timeline gives the same world at every step, however the frames fall', () => {
  const random = seededRandom(7);
  const inputs = Array.from({ length: 12 }, (_, i) => ({
    step: Math.floor(random() * 90),
    input: { key: `crate-${i % 4}`, push: i + 1 },
  }));
  const first = drive(inputs, 120, 1);
  expect(first.at(-1)).toMatchObject({ step: 120 });
  for (const seed of [2, 3, 4, 5]) expect(drive(inputs, 120, seed)).toEqual(first);
  // Other inputs, another world.
  const moved = inputs.map((each, i) => (i === 5 ? { ...each, step: each.step + 1 } : each));
  expect(drive(moved, 120, 1).at(-1)).not.toEqual(first.at(-1));
});
