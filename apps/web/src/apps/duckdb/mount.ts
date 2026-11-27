import { Mount } from '@effect/ui';
import { Effect, Schema, Stream } from 'effect';

import { arrowQuery, run } from './engine';
import { Message } from './message';
import { Kind } from './model';
import { startDuckDB, type Engine } from './resource';

const Request = Schema.Struct({ revision: Schema.Int, bins: Schema.Number, kind: Kind });

function query(engine: Engine, { revision, bins, kind }: typeof Request.Type) {
  const execute = Effect.tryPromise(() => run(arrowQuery(engine.query), bins, kind));
  return execute.pipe(
    Effect.match({
      onSuccess: (ran) => Message.RanQueries({ revision, ran: { ...ran, bins, kind } }),
      onFailure: (error) => Message.FailedQueries({ revision, reason: String(error) }),
    }),
  );
}
/** One Worker per mounted island. Each query follows the latest requested revision. */
export const RunDuckDB = Mount.makeStream(
  'RunDuckDB',
  { args: Request },
  (_node: HTMLElement, _initial, changes) =>
    Stream.unwrap(
      startDuckDB.pipe(
        Effect.map((engine) =>
          Stream.concat(
            Stream.make(Message.AcquiredDuckDB()),
            Stream.switchMap(changes, (request) => Stream.fromEffect(query(engine, request))),
          ),
        ),
      ),
    ).pipe(Stream.catch((error) => Stream.make(Message.FailedDuckDB({ reason: error.reason })))),
);
