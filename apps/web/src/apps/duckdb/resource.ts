import { Data, Effect, Option, Schema } from 'effect';
import { ManagedResource } from 'foldkit';

import { setupSql } from './engine';
import { Message } from './message';
import type { Model } from './model';

/** A DuckDB-Wasm database in a Web Worker, queried through one connection. */
export type Engine = Readonly<{
  query: (sql: string) => Promise<import('@opsydyn/foldkit-viz/plot').ArrowTable>;
}>;

export const DuckDB = ManagedResource.tag<Engine>()('DuckDB');

/** Why DuckDB could not start in this browser. */
class DuckDBUnavailable extends Data.TaggedError('DuckDBUnavailable')<{
  readonly reason: string;
}> {}

/**
 * Loads DuckDB-Wasm only once the visitor asks. Its WASM builds are larger
 * than the site's static files may be, so they come from jsDelivr, pinned to
 * the installed version. The database and connection are released with the
 * resource's scope: the worker is terminated when the page lets go.
 */
const start = Effect.gen(function* () {
  const duckdb = yield* Effect.tryPromise({
    try: () => import('@duckdb/duckdb-wasm'),
    catch: (cause) => new DuckDBUnavailable({ reason: String(cause) }),
  });
  const bundle = yield* Effect.tryPromise({
    try: () => duckdb.selectBundle(duckdb.getJsDelivrBundles()),
    catch: (cause) => new DuckDBUnavailable({ reason: String(cause) }),
  });
  const mainWorker = bundle.mainWorker;
  if (mainWorker === null)
    return yield* Effect.fail(
      new DuckDBUnavailable({ reason: 'DuckDB-Wasm offers no worker for this browser' }),
    );
  const db = yield* Effect.tryPromise({
    try: async () => {
      // A same-origin script that loads the pinned worker, as DuckDB documents for CDN bundles.
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${mainWorker}");`], { type: 'text/javascript' }),
      );
      const database = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(workerUrl));
      await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);
      return database;
    },
    catch: (cause) => new DuckDBUnavailable({ reason: String(cause) }),
  });
  yield* Effect.addFinalizer(() => Effect.promise(() => db.terminate()));
  const connection = yield* Effect.tryPromise({
    try: () => db.connect(),
    catch: (cause) => new DuckDBUnavailable({ reason: String(cause) }),
  });
  // Finalizers run last-in first-out: the connection closes before the worker ends.
  yield* Effect.addFinalizer(() => Effect.promise(() => connection.close()));
  yield* Effect.tryPromise({
    try: () => connection.query(setupSql()),
    catch: (cause) => new DuckDBUnavailable({ reason: String(cause) }),
  });
  const engine: Engine = { query: (sql) => connection.query(sql) };
  return engine;
});

export const managedResources = ManagedResource.make<Model, Message>()((entry) => ({
  duckdb: entry(Schema.Option(Schema.Null), {
    resource: DuckDB,
    modelToMaybeRequirements: (model) =>
      model.engine === 'starting' || model.engine === 'ready' ? Option.some(null) : Option.none(),
    acquire: () => start,
    // The scope that acquired DuckDB closes it: the connection, then the worker.
    release: () => Effect.void,
    onAcquired: () => Message.AcquiredDuckDB(),
    onAcquireError: (error) => Message.FailedDuckDB({ reason: String(error) }),
    onReleased: () => Message.ReleasedDuckDB(),
  }),
}));
