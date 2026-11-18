import { expect, test } from 'bun:test';

import * as Domain from '@alchemy.run/domain';
import type { Delivery } from '@alchemy.run/domain/Platform';
import { Effect, Schema } from 'effect';

import { constructView, declaredView, readyStorage, realKit } from './domain-store-fixture';
import fixture from './fixtures/domain-view-storage-v1.json';

// oxlint-disable-next-line foldkit/no-module-level-mutable-state -- Test-only schema probe counts calls in serial tests; no application Model or runtime state is held here.
let codecChecks = 0;
const CountedState = Schema.Struct({ total: Schema.Number }).pipe(
  Schema.check(
    Schema.makeFilter(() => {
      codecChecks += 1;
      return true;
    }),
  ),
);
class Stepped extends Domain.Event('ProofStepped', {
  amount: Schema.Number,
  copies: Schema.Number,
}) {}
class Step extends Domain.Command('ProofStep', {
  target: Schema.String,
  input: { amount: Schema.Number },
  events: [Stepped],
}) {}
class Source extends Domain.Aggregate('ProofSource', {
  id: Schema.String,
  state: Schema.Number,
  initial: 0,
  commands: [Step],
  decide: { ProofStep: () => [] },
  evolve: { ProofStepped: (state, event) => state + event.amount },
}) {}
class Tick extends Domain.Event('ProofTick', { total: Schema.Number, index: Schema.Number }) {}
class View extends Domain.View('ProofView', {
  from: [Source],
  key: Source,
  state: CountedState,
  initial: { total: 0 },
  events: [Tick],
  evolve: { ProofStepped: (state, event) => ({ total: state.total + event.amount }) },
  emit: {
    ProofStepped: (event, context) =>
      Array.from(
        { length: event.copies },
        (_, index) => new Tick({ total: context.after?.total ?? 0, index }),
      ),
  },
}) {}
class Model extends Domain.Model('SnapshotFixture', { aggregates: [Source], views: [View] }) {}
class Rebuilt extends Domain.View('ProofRebuilt', {
  ...View.definition,
  version: 1,
}) {}
class RebuiltModel extends Domain.Model('RebuiltFixture', {
  aggregates: [Source],
  views: [Rebuilt],
}) {}
// SAFETY: The literal JSON fixes the SDK discriminants; the real Kernel decoder validates its event/envelope on every use.
const delivery = fixture.delivery as Delivery;

test('the read meter records one get for one standalone SDK snapshot read', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const kit = yield* realKit(Model.definitions, View);
      const declaration = yield* declaredView(View, kit);
      const storage = readyStorage(kit, { snapshot: fixture.snapshot });
      const view = yield* constructView(declaration, storage);
      storage.clear();
      expect(yield* view.read()).toEqual(fixture.snapshot);
      expect(storage.trace).toEqual([
        {
          operation: 'get',
          keys: ['snapshot'],
          transaction: 0,
          gate: 0,
          bytes: new TextEncoder().encode(JSON.stringify(fixture.snapshot)).length,
        },
      ]);
    }).pipe(Effect.scoped),
  );
});

test('a stored newer generation is retained on read rather than silently reset', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const kit = yield* realKit(Model.definitions, View);
      const declaration = yield* declaredView(View, kit);
      const snapshot = { ...fixture.snapshot, generation: 2 };
      const storage = readyStorage(kit, { snapshot });
      const view = yield* constructView(declaration, storage);
      expect(yield* view.read()).toEqual(snapshot);
      expect(storage.dump().snapshot).toEqual(snapshot);
      expect(
        storage.trace.filter((row) => row.operation === 'put' || row.operation === 'delete'),
      ).toEqual([]);
    }).pipe(Effect.scoped),
  );
});

test('duplicate and out-of-order batch entries preserve checkpoint, emitted history and original input-log semantics', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const kit = yield* realKit(Model.definitions, View);
      const declaration = yield* declaredView(View, kit);
      const storage = readyStorage(kit, { snapshot: fixture.snapshot, 'in-seq': 4 });
      const view = yield* constructView(declaration, storage);
      const later = { ...delivery, seq: 6, envelope: { ...delivery.envelope, seq: 6 } };
      yield* view.receive('board', [later, delivery, later]);
      expect(storage.dump().snapshot).toEqual({
        state: { total: 12 },
        version: 4,
        seq: 5,
        checkpoints: { 'ProofSource/board': 6 },
      });
      expect(yield* view.after(4)).toEqual([fixture.expectedEntry]);
      // beta.85 logs arrivals newer than the pre-batch checkpoint, including within-batch repeats.
      expect(storage.dump()['in-seq']).toBe(7);
      expect([5, 6, 7].map((seq) => storage.dump()[`in:${String(seq).padStart(12, '0')}`])).toEqual(
        [later, delivery, later],
      );
    }).pipe(Effect.scoped),
  );
});

test('literal snapshot, input log and historical state survive the real exported SDK view constructor', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const kit = yield* realKit(Model.definitions, View);
      const declaration = yield* declaredView(View, kit);
      const storage = readyStorage(kit, { snapshot: fixture.snapshot, 'in-seq': 4 });
      const view = yield* constructView(declaration, storage);
      expect(view.callbacks).toEqual(['domain:outbox', 'domain:backfill']);
      yield* view.receive('board', [delivery]);
      expect(storage.dump().snapshot).toEqual(fixture.expectedSnapshot);
      expect(storage.dump()['entry:000000000005']).toEqual(fixture.expectedEntry);
      expect(storage.dump()['in:000000000005']).toEqual(delivery);
      expect(storage.dump()['in-seq']).toBe(5);
      expect(yield* view.read()).toEqual(fixture.expectedSnapshot);
    }).pipe(Effect.scoped),
  );
});

test('unchanged beta.85 executes two snapshot reads in the same exclusive apply transaction', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const kit = yield* realKit(Model.definitions, View);
      const declaration = yield* declaredView(View, kit);
      const storage = readyStorage(kit, { snapshot: fixture.snapshot });
      const view = yield* constructView(declaration, storage);
      storage.clear();
      codecChecks = 0;
      yield* view.receive('board', [delivery]);
      const reads = storage.trace.filter(
        (row) => row.operation === 'get' && row.keys.includes('snapshot'),
      );
      expect(reads).toHaveLength(2);
      expect(reads[0]?.transaction).toBeGreaterThan(0);
      expect(reads[0]?.gate).toBeGreaterThan(0);
      expect(reads[1]).toEqual(reads[0]);
      expect(codecChecks).toBe(3);
      const transaction = reads[0]?.transaction;
      expect(
        storage.trace.filter((row) => row.transaction === transaction).map((row) => row.operation),
      ).toContain('commit');
    }).pipe(Effect.scoped),
  );
});

test('an absent snapshot uses initial state; duplicates neither persist another input nor emit history', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const kit = yield* realKit(Model.definitions, View);
      const declaration = yield* declaredView(View, kit);
      const storage = readyStorage(kit);
      const view = yield* constructView(declaration, storage);
      yield* view.receive('board', [delivery]);
      expect(storage.dump().snapshot).toEqual({
        state: { total: 2 },
        version: 1,
        seq: 1,
        checkpoints: { 'ProofSource/board': 5 },
      });
      const persisted = storage.dump();
      storage.clear();
      yield* view.receive('board', [delivery]);
      expect(storage.dump()).toEqual(persisted);
      expect(storage.trace.filter((row) => row.operation === 'put')).toEqual([]);
      expect(
        storage.trace.filter((row) => row.operation === 'get' && row.keys.includes('snapshot')),
      ).toHaveLength(2);
    }).pipe(Effect.scoped),
  );
});

test('stale generation clears old history/input/routing before using initial state; newer delivery rolls back', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const kit = yield* realKit(RebuiltModel.definitions, Rebuilt);
      const declaration = yield* declaredView(Rebuilt, kit);
      const seed = {
        snapshot: fixture.snapshot,
        'in-seq': 4,
        routed: { old: 99 },
        'entry:000000000004': { old: 'history' },
        'in:000000000004': { old: 'input' },
        unrelated: { retained: true },
      };
      const storage = readyStorage(kit, seed);
      const view = yield* constructView(declaration, storage);
      const current: Delivery = {
        ...delivery,
        target: { kind: 'view', name: Rebuilt.viewName, generation: 1 },
      };
      yield* view.receive('board', [current]);
      expect(storage.dump().snapshot).toEqual({
        state: { total: 2 },
        version: 1,
        seq: 1,
        checkpoints: { 'ProofSource/board': 5 },
        generation: 1,
      });
      expect(storage.dump()['entry:000000000004']).toBeUndefined();
      expect(storage.dump()['in:000000000004']).toBeUndefined();
      expect(storage.dump()['in-seq']).toBe(1);
      expect(storage.dump().routed).toEqual({});
      expect(storage.dump().unrelated).toEqual({ retained: true });
      const before = storage.dump();
      storage.clear();
      const newer = { ...current, seq: 6, target: { ...current.target, generation: 2 } };
      yield* view.receive('board', [newer]);
      // The native RPC surface reports defects as data. No partially applied rows may escape.
      expect(storage.dump()).toEqual(before);
      expect(storage.trace.some((row) => row.operation === 'rollback')).toBe(true);
    }).pipe(Effect.scoped),
  );
});

test.each(['delete', 'put'] as const)(
  '%s failure leaves the full pre-apply store intact',
  async (operation) => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const rebuild = operation === 'delete';
        const chosen = rebuild ? Rebuilt : View;
        const kit = yield* realKit(rebuild ? RebuiltModel.definitions : Model.definitions, chosen);
        const declaration = yield* declaredView(chosen, kit);
        const storage = readyStorage(kit, {
          snapshot: fixture.snapshot,
          'in-seq': 4,
          'entry:000000000004': { old: true },
          'in:000000000004': { old: true },
        });
        const view = yield* constructView(declaration, storage);
        const before = storage.dump();
        storage.fail(operation, 'snapshot');
        const result = yield* view.receive('board', [
          {
            ...delivery,
            target: rebuild
              ? { kind: 'view', name: chosen.viewName, generation: 1 }
              : { kind: 'view', name: chosen.viewName },
          },
        ]);
        expect(result).toHaveProperty('alchemy/Domain/Defect');
        expect(storage.dump()).toEqual(before);
        expect(storage.trace.filter((row) => row.operation === 'rollback')).toHaveLength(1);
      }).pipe(Effect.scoped),
    );
  },
);

test('two routes and multiple emissions preserve each historical state; zero emissions still advance the snapshot', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const kit = yield* realKit(Model.definitions, View);
      const declaration = yield* declaredView(View, kit);
      const storage = readyStorage(kit, { snapshot: fixture.snapshot });
      const view = yield* constructView(declaration, storage);
      yield* view.receive('board', [
        { ...delivery, routes: ['left', 'right'], event: { ...fixture.delivery.event, copies: 2 } },
      ]);
      expect(
        [5, 6, 7, 8].map((seq) => storage.dump()[`entry:${String(seq).padStart(12, '0')}`]),
      ).toEqual(
        [12, 12, 14, 14].map((total, index) => ({
          ...fixture.expectedEntry,
          seq: index + 5,
          event: { _tag: 'ProofTick', total, index: index % 2 },
          state: { total },
          envelope: { ...fixture.expectedEntry.envelope, seq: index + 5 },
        })),
      );
      yield* view.receive('board', [
        {
          ...delivery,
          seq: 6,
          envelope: { ...delivery.envelope, seq: 6 },
          event: { ...fixture.delivery.event, amount: 3, copies: 0 },
        },
      ]);
      expect(storage.dump().snapshot).toEqual({
        state: { total: 17 },
        version: 6,
        seq: 8,
        checkpoints: { 'ProofSource/board': 6 },
      });
      expect(storage.dump()['entry:000000000009']).toBeUndefined();
      // Constructor restart in the controlled store, not a native workerd crash.
      const restarted = yield* constructView(declaration, storage);
      expect(yield* restarted.read()).toEqual({
        state: { total: 17 },
        version: 6,
        seq: 8,
        checkpoints: { 'ProofSource/board': 6 },
      });
      expect(yield* restarted.after(6)).toEqual(
        [7, 8].map((seq) => storage.dump()[`entry:${String(seq).padStart(12, '0')}`]),
      );
      const detached = yield* restarted.read();
      // SAFETY: The preceding literal snapshot assertion and the real state codec establish this controlled mutable JSON shape.
      (detached.state as { total: number }).total = 999;
      expect((yield* restarted.read()).state).toEqual({ total: 17 });
    }).pipe(Effect.scoped),
  );
});
