import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { arrowQuery, run } from './engine';
import { Message } from './message';
import { Kind } from './model';
import { DuckDB } from './resource';

/** Both charts for the chosen bins and kind, binned in DuckDB in the page. */
export const RunQueries = Command.define('RunQueries', {
  args: { bins: Schema.Number, kind: Kind },
  messages: [Message.RanQueries, Message.FailedQueries],
  execute: ({ bins, kind }) =>
    DuckDB.get.pipe(
      Effect.flatMap((engine) =>
        Effect.tryPromise(() => run(arrowQuery(engine.query), bins, kind)),
      ),
      Effect.match({
        onSuccess: (ran) =>
          Message.RanQueries({ ran: { ...ran, bins, kind, statements: [...ran.statements] } }),
        onFailure: (error) => Message.FailedQueries({ reason: String(error) }),
      }),
    ),
});
