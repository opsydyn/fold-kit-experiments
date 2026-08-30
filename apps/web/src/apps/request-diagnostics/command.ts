import { Effect, Schema } from 'effect';
import { HttpClient, HttpClientResponse } from 'effect/unstable/http';
import { Command, Http } from 'foldkit';

import { Message } from './message';
import { Point } from './model';

export const FetchMetrics = Command.define('FetchMetrics', {
  messages: [Message.LoadedMetrics, Message.FailedLoad],
  interrupt: true,
  execute: Effect.provide(
    Effect.gen(function* () {
      const response = yield* HttpClient.get('/api/request-diagnostics');
      const points = yield* HttpClientResponse.schemaBodyJson(Schema.Array(Point))(response);
      return Message.LoadedMetrics({ points });
    }).pipe(Effect.catch((error) => Effect.succeed(Message.FailedLoad({ error: String(error) })))),
    Http.layer,
  ),
});
