/**
 * Snapshots of a world on `physics({ until })`: `snapshotAt` is a stop where the world
 * reports a snapshot of itself, and a run started `from` one goes on from that step with
 * the bodies and joints it held, reaching later steps as the world it was taken from did.
 */
import { expect, test } from 'bun:test';

import {
  body,
  box,
  createSceneGraph,
  createSceneLoop,
  joint,
  type MeshNode,
  mesh,
  type Physics,
  type PhysicsEngine,
  physics,
  recordingRendererFactory,
  scene,
  type SceneEvent,
  snapshotBytes,
  snapshotText,
  standard,
} from '../src/kernel/index.ts';
import { SceneFile } from '../src/runtime/index.ts';
import { fakePhysics } from './support/fakePhysics.ts';

const crate = (key: string, x = 0, impulse: number | null = null): MeshNode =>
  mesh({
    key,
    position: [x, 10, 0],
    geometry: box(),
    material: standard(),
    body: body({ impulse: impulse === null ? null : { id: impulse, impulse: [impulse, 0, 0] } }),
  });

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
  /** Frames a second apart until the world has nothing more to do. */
  const settle = () => {
    for (let i = 0; i < 20; i++) {
      now += 1;
      loop.frame();
    }
  };
  const reached = () =>
    emitted.flatMap((event) => (event._tag === 'PhysicsReached' ? [event] : []));
  return { graph, settle, reached };
};

const world = (settings: Partial<Physics>, children: ReadonlyArray<MeshNode>) =>
  scene({ physics: physics(settings), children });

test('a world stops at snapshotAt on its way, reports a snapshot there, and goes on', () => {
  const { engine } = fakePhysics();
  const { graph, settle, reached } = setup(engine);
  graph.reconcile(world({ until: 90, snapshotAt: 30 }, [crate('a', 0, 1), crate('b', 2)]));
  settle();
  expect(reached().map(({ step, snapshot }) => [step, snapshot !== undefined])).toEqual([
    [30, true],
    [90, false],
  ]);
  // Asked for at the step it already waits at: it reports there again, with a snapshot.
  graph.reconcile(world({ until: 90, snapshotAt: 90 }, [crate('a', 0, 1), crate('b', 2)]));
  settle();
  expect(reached().map(({ step, snapshot }) => [step, snapshot !== undefined])).toEqual([
    [30, true],
    [90, false],
    [90, true],
  ]);
  expect(reached()[2]?.checksum).toBe(reached()[1]?.checksum);
  graph.dispose();
});

test('a run started from a snapshot reaches later steps as the world it was taken from', () => {
  const children = [crate('a', 0, 1), crate('b', 2)];
  const first = setup(fakePhysics().engine);
  first.graph.reconcile(world({ until: 120, snapshotAt: 40 }, children));
  first.settle();
  const [taken, end] = first.reached();
  expect(taken?.step).toBe(40);

  const { engine, worlds } = fakePhysics();
  const second = setup(engine);
  const from = { step: 40, snapshot: taken?.snapshot ?? '' };
  second.graph.reconcile(world({ until: 120, from }, children));
  second.settle();
  // It counted on from step 40: eighty steps, to the same world at 120.
  expect(worlds[0]?.steps).toBe(80);
  expect(second.reached()).toEqual(end === undefined ? [] : [end]);
  // The bodies it held were taken on, not added again; their impulses were not given twice.
  expect(
    worlds[0]?.calls.filter((call) => call.startsWith('add') || call.startsWith('impulse')),
  ).toEqual([]);
  first.graph.dispose();
  second.graph.dispose();
});

test('a body the snapshot lacks is added; one the description lacks is removed; joints are kept', () => {
  const linked = (settings: Partial<Physics>, children: ReadonlyArray<MeshNode>) =>
    scene({
      physics: physics({
        ...settings,
        joints: [joint({ key: 'hinge', a: 'a', b: 'b', kind: { _tag: 'Spherical' } })],
      }),
      children,
    });
  const first = setup(fakePhysics().engine);
  first.graph.reconcile(
    linked({ until: 10, snapshotAt: 10 }, [crate('a'), crate('b'), crate('c')]),
  );
  first.settle();
  const snapshot = first.reached()[0]?.snapshot ?? '';

  const { engine, worlds } = fakePhysics();
  const second = setup(engine);
  second.graph.reconcile(
    linked({ until: 20, from: { step: 10, snapshot } }, [crate('a'), crate('b'), crate('d')]),
  );
  expect(worlds[0]?.calls).toEqual(['add d', 'remove c']);
  expect([...(worlds[0]?.joints.keys() ?? [])]).toEqual(['hinge']);
  first.graph.dispose();
  second.graph.dispose();
});

test('an engine that cannot restore starts from the description at step 0; one that cannot snapshot reports without', () => {
  const { engine, worlds } = fakePhysics({ snapshots: false });
  const { graph, settle, reached } = setup(engine);
  graph.reconcile(
    world({ until: 30, snapshotAt: 10, from: { step: 50, snapshot: 'AAAA' } }, [crate('a')]),
  );
  settle();
  expect(worlds[0]?.calls).toEqual(['add a']);
  expect(reached().map(({ step, snapshot }) => [step, snapshot])).toEqual([
    [10, undefined],
    [30, undefined],
  ]);
  graph.dispose();
});

test('snapshots are text a message carries, and scene files keep where a run starts', () => {
  const bytes = Uint8Array.from({ length: 1000 }, (_, i) => (i * 37) % 256);
  expect(snapshotBytes(snapshotText(bytes))).toEqual(bytes);
  expect(snapshotText(Uint8Array.of(1, 2))).toBe('AQI=');
  const saved = world({ until: 4, snapshotAt: 3, from: { step: 2, snapshot: 'AQI=' } }, []);
  expect(SceneFile.read(SceneFile.save(saved))).toMatchObject({
    _tag: 'Success',
    success: { physics: { snapshotAt: 3, from: { step: 2, snapshot: 'AQI=' } } },
  });
  // A file from before them reads with neither.
  const older = SceneFile.save(world({ until: 4 }, []))
    .replace(/\n\s*"snapshotAt": null,?/, '')
    .replace(/\n\s*"from": null,?/, '');
  expect(older).not.toContain('snapshotAt');
  expect(SceneFile.read(older)).toMatchObject({
    _tag: 'Success',
    success: { physics: { snapshotAt: null, from: null } },
  });
});
