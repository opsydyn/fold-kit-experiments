import { Data, Effect } from 'effect';

import { setupSql } from './engine';

/** A DuckDB-Wasm database in a Web Worker, queried through one connection. */
export type Engine = Readonly<{
  query: (sql: string) => Promise<import('@opsydyn/foldkit-viz/plot').ArrowTable>;
}>;

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
export const startDuckDB = Effect.gen(function* () {
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
  // The Worker and URL already have finalizers when instantiate begins.
  const makeUrl = Effect.try({
    try: () =>
      URL.createObjectURL(
        new Blob([`importScripts("${mainWorker}");`], { type: 'text/javascript' }),
      ),
    catch: (cause) => new DuckDBUnavailable({ reason: String(cause) }),
  });
  const url = yield* Effect.acquireRelease(makeUrl, (url) =>
    Effect.sync(() => URL.revokeObjectURL(url)),
  );
  const makeDatabase = Effect.try({
    try: () => new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(url)),
    catch: (cause) => new DuckDBUnavailable({ reason: String(cause) }),
  });
  const db = yield* Effect.acquireRelease(makeDatabase, (db) =>
    Effect.promise(() => db.terminate()),
  );
  yield* Effect.tryPromise({
    try: () => db.instantiate(bundle.mainModule, bundle.pthreadWorker),
    catch: (cause) => new DuckDBUnavailable({ reason: String(cause) }),
  });
  const connect = Effect.tryPromise({
    try: () => db.connect(),
    catch: (cause) => new DuckDBUnavailable({ reason: String(cause) }),
  });
  const connection = yield* Effect.acquireRelease(
    connect,
    // A hung or failed close must still allow the worker finalizer to run.
    (connection) =>
      Effect.tryPromise(() => connection.close()).pipe(
        Effect.interruptible,
        Effect.timeoutOption('2 seconds'),
        Effect.result,
      ),
    { interruptible: true },
  );
  yield* Effect.tryPromise({
    try: () => connection.query(setupSql()),
    catch: (cause) => new DuckDBUnavailable({ reason: String(cause) }),
  });
  const engine: Engine = { query: (sql) => connection.query(sql) };
  return engine;
});
