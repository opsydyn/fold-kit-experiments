import { layerDurableObjects } from '@alchemy.run/cloudflare/Domain';
import type { DurableObjectExport } from '@alchemy.run/cloudflare/Workers/DurableObject';
import { isDurableObjectExport } from '@alchemy.run/cloudflare/Workers/DurableObject';
import {
  DurableObjectState,
  fromDurableObjectState,
} from '@alchemy.run/cloudflare/Workers/DurableObjectState';
import { Worker } from '@alchemy.run/cloudflare/Workers/Worker';
import { WorkerEnvironment } from '@alchemy.run/cloudflare/Workers/WorkerRuntime';
import * as Domain from '@alchemy.run/domain';
import * as Kernel from '@alchemy.run/domain/Kernel';
import { Platform } from '@alchemy.run/domain/Platform';
import type { Delivery, ViewKit, ViewSnapshot } from '@alchemy.run/domain/Platform';
import type * as Native from '@cloudflare/workers-types';
import * as Output from 'alchemy/Output';
import { RuntimeContext } from 'alchemy/RuntimeContext';
import { Self } from 'alchemy/Self';
import { Stack } from 'alchemy/Stack';
import { ConfigProvider, Context, Data, Effect, Layer } from 'effect';

/* oxlint-disable anti-slop/no-chained-type-assertions -- Controlled native/Worker interfaces and SDK-erased RPC methods are bridged only in this fixture; each cast has a specific SAFETY justification. */
class FixtureBoundaryError extends Data.TaggedError('FixtureBoundaryError')<{
  readonly message: string;
}> {}

/** Test boundary only: no SDK source extraction, module mocking or provider execution. */
export interface StoreTrace {
  readonly operation: string;
  readonly keys: readonly string[];
  readonly transaction: number;
  readonly gate: number;
  readonly bytes: number;
}

/** Controlled JSON storage, not a SQLite emulator or native crash-recovery proof. */
export function controlledStorage(seed: Readonly<Record<string, unknown>> = {}) {
  let values = new Map(Object.entries(structuredClone(seed)));
  let transaction = 0;
  let serial = 0;
  let gate = 0;
  let gateSerial = 0;
  const trace: StoreTrace[] = [];
  let failure: { operation: string; key: string } | undefined;
  const record = (operation: string, keys: readonly string[], payload?: unknown) => {
    trace.push({
      operation,
      keys,
      transaction,
      gate,
      // Diagnostic work is outside the SDK; these are JSON payload sizes, not I/O bytes.
      bytes: payload === undefined ? 0 : new TextEncoder().encode(JSON.stringify(payload)).length,
    });
    if (failure?.operation === operation && keys.includes(failure.key))
      throw new FixtureBoundaryError({ message: `injected ${operation}:${failure.key}` });
  };
  const rawStorage = {
    get: async (key: string | string[]) => {
      const result = Array.isArray(key)
        ? new Map(key.filter((k) => values.has(k)).map((k) => [k, values.get(k)]))
        : values.get(key);
      record('get', typeof key === 'string' ? [key] : key, result);
      return structuredClone(result);
    },
    put: async (key: string | Record<string, unknown>, value?: unknown) => {
      const entries = typeof key === 'string' ? [[key, value] as const] : Object.entries(key);
      record(
        'put',
        entries.map(([name]) => name),
        Object.fromEntries(entries),
      );
      for (const [name, data] of entries) values.set(name, structuredClone(data));
    },
    delete: async (key: string | string[]) => {
      const keys = typeof key === 'string' ? [key] : key;
      record('delete', keys);
      const deleted = keys.filter((name) => values.delete(name)).length;
      return typeof key === 'string' ? deleted === 1 : deleted;
    },
    list: async (options: Native.DurableObjectListOptions = {}) => {
      record('list', [options.prefix ?? '']);
      return new Map(
        [...values.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .filter(
            ([key]) =>
              key.startsWith(options.prefix ?? '') &&
              (options.start === undefined || key >= options.start) &&
              (options.startAfter === undefined || key > options.startAfter),
          )
          .slice(0, options.limit)
          .map(([key, data]) => [key, structuredClone(data)]),
      );
    },
    transaction: async <A>(body: (txn: Native.DurableObjectTransaction) => Promise<A>) => {
      const before = structuredClone(values);
      transaction = ++serial;
      record('begin', []);
      try {
        // SAFETY: The exercised SDK transaction uses this fixture's get/put/delete/list methods; unsupported native operations are not silently supplied.
        const result = await body(rawStorage as unknown as Native.DurableObjectTransaction);
        record('commit', []);
        return result;
      } catch (error) {
        values = before;
        record('rollback', []);
        throw error;
      } finally {
        transaction = 0;
      }
    },
    getAlarm: async () => null,
    sql: {
      exec: () => {
        throw new FixtureBoundaryError({ message: 'Unexpected SQL in controlled storage' });
      },
    },
    kv: {},
  };
  // SAFETY: This is a controlled storage/id/socket boundary; the real SDK wrapper runs, and unsupported native APIs fail rather than emulate Cloudflare.
  const state = fromDurableObjectState({
    storage: rawStorage,
    id: { toString: () => 'controlled-object' },
    getWebSockets: () => [],
  } as unknown as Native.DurableObjectState);
  const service: DurableObjectState['Service'] = {
    ...state,
    blockConcurrencyWhile: (callback) =>
      Effect.suspend(() => {
        if (gate !== 0)
          return Effect.die(
            new FixtureBoundaryError({ message: 'Unexpected nested exclusive section' }),
          );
        gate = ++gateSerial;
        return callback().pipe(
          Effect.ensuring(
            Effect.sync(() => {
              gate = 0;
            }),
          ),
        );
      }),
  };
  return {
    trace,
    service,
    dump: () => structuredClone(Object.fromEntries(values)),
    seed: (entries: Readonly<Record<string, unknown>>) => {
      for (const [key, data] of Object.entries(entries)) values.set(key, structuredClone(data));
    },
    fail: (operation: string, key: string) => {
      failure = { operation, key };
    },
    clear: () => {
      trace.length = 0;
    },
  };
}

export type ControlledStorage = ReturnType<typeof controlledStorage>;

/** Capture the constructor that the real platform declares through Worker.export. */
export const declaredView = (view: Domain.View.Any, kit: ViewKit) =>
  Effect.gen(function* () {
    const declarations = new Map<string, unknown>();
    const stack = {
      name: 'snapshot-proof',
      stage: 'test',
      resources: {},
      bindings: {},
      actions: {},
    };
    // SAFETY: Only bind/export/output infrastructure discovery is exercised; all constructor/receive/storage logic remains the real SDK implementation.
    const worker = {
      bind: () => () => Effect.void,
      durableObjectNamespaces: Output.literal({}),
      workerName: Output.literal('snapshot-proof'),
      export: (name: string, value: unknown) =>
        Effect.sync(() => {
          declarations.set(name, value);
        }),
    } as unknown as Worker;
    // SAFETY: SDK Resource effects declare Worker as their requirement but resolve this exact public Self tag; this aliases the environment type, not a runtime value.
    const workerContext = Context.make(
      Self<Worker>('Cloudflare.Worker'),
      worker,
    ) as unknown as Context.Context<Worker>;
    const platformContext = yield* Layer.build(layerDurableObjects()).pipe(
      Effect.provideService(Stack, stack),
      Effect.provide(workerContext),
      Effect.provideService(WorkerEnvironment, {}),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ ALCHEMY_PHASE: 'plan' }),
      ),
    );
    yield* Effect.gen(function* () {
      const platform = yield* Platform;
      const host = yield* platform.model({
        modelName: 'SnapshotReadProof',
        id: {},
        legacyData: false,
        sagas: [],
      });
      yield* host.view(view, kit);
    }).pipe(
      Effect.provide(platformContext),
      Effect.provide(workerContext),
      Effect.provideService(Stack, stack),
      Effect.provideService(WorkerEnvironment, {}),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ ALCHEMY_PHASE: 'plan' }),
      ),
    );
    const declaration = declarations.get(
      `SnapshotReadProof.${kit.name}View${kit.classGeneration > 0 ? `V${kit.classGeneration}` : ''}`,
    );
    if (!isDurableObjectExport(declaration))
      return yield* Effect.die(
        new FixtureBoundaryError({ message: 'SDK did not export the requested view constructor' }),
      );
    return declaration;
  });

export const constructView = (declaration: DurableObjectExport, storage: ControlledStorage) => {
  const callbacks: string[] = [];
  const runtime: RuntimeContext['Service'] = {
    Type: 'ControlledSnapshotProof',
    id: 'controlled',
    env: {},
    get: () => Effect.die(new FixtureBoundaryError({ message: 'Unexpected runtime get' })),
    set: () => Effect.die(new FixtureBoundaryError({ message: 'Unexpected runtime set' })),
    makeCallback: (name) =>
      Effect.sync(() => {
        callbacks.push(name);
        return {
          schedule: () =>
            Effect.die(new FixtureBoundaryError({ message: 'Unexpected callback schedule' })),
          cancel: () =>
            Effect.die(new FixtureBoundaryError({ message: 'Unexpected callback cancellation' })),
          getStatus: () => Effect.succeed(undefined),
        };
      }),
  };
  const services = Context.merge(
    declaration.services,
    Context.make(DurableObjectState, storage.service).pipe(Context.add(RuntimeContext, runtime)),
  );
  const run = <A, E>(effect: Effect.Effect<A, E, DurableObjectState | RuntimeContext>) =>
    Effect.provide(effect, services);
  return Effect.gen(function* () {
    const instance = yield* run(Effect.flatten(declaration.constructor));
    // SAFETY: These methods come from the pinned SDK's declared view object; literal/real-Zloz tests exercise all three through the original storage wrapper.
    const methods = instance as unknown as {
      receive: (key: string, deliveries: readonly Delivery[]) => Effect.Effect<unknown>;
      read: () => Effect.Effect<ViewSnapshot>;
      after: (cursor: number) => Effect.Effect<unknown>;
    };
    return {
      callbacks,
      receive: (key: string, deliveries: readonly Delivery[]) =>
        run(methods.receive(key, deliveries)),
      read: () => run(methods.read()),
      after: (cursor: number) => run(methods.after(cursor)),
    };
  });
};

export function readyStorage(kit: ViewKit, seed: Readonly<Record<string, unknown>> = {}) {
  return controlledStorage({
    registered: true,
    [`bf:done:${encodeURIComponent(kit.target)}`]: true,
    ...seed,
  });
}

export const realKit = (definitions: Kernel.Definitions, view: Domain.View.Any) =>
  Kernel.make(definitions).pipe(
    Effect.map(
      (kernel): ViewKit => ({
        ...kernel.viewKit(view, () => Effect.void),
        // No WebSocket readers in this storage fixture; push is never called.
        push: () =>
          Effect.die(
            new FixtureBoundaryError({ message: 'Unexpected subscriber in storage fixture' }),
          ),
      }),
    ),
  );
