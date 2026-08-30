import { Effect } from 'effect';
import { HttpClient, HttpClientResponse } from 'effect/unstable/http';
import { Command, Http } from 'foldkit';

import { Message } from './message';
import { HealthData } from './model';

export const FetchHealth = Command.define('FetchHealth', {
  messages: [Message.FetchedHealth, Message.FetchFailed],
  execute: Effect.provide(
    Effect.gen(function* () {
      const response = yield* HttpClient.get('/api/health');
      const data = yield* HttpClientResponse.schemaBodyJson(HealthData)(response);
      return Message.FetchedHealth(data);
    }).pipe(
      Effect.catch((error) => Effect.succeed(Message.FetchFailed({ error: String(error) }))),
    ),
    Http.layer,
  ),
});
