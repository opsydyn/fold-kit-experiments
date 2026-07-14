import { Effect } from 'effect';
import { HttpClient, HttpClientResponse } from 'effect/unstable/http';
import { Command, Http } from 'foldkit';

import { FetchedHealth, FetchFailed } from './message';
import { HealthData } from './model';

export const FetchHealth = Command.define(
  'FetchHealth',
  FetchedHealth,
  FetchFailed,
)(
  Effect.provide(
    Effect.gen(function* () {
      const response = yield* HttpClient.get('/api/health');
      const data = yield* HttpClientResponse.schemaBodyJson(HealthData)(response);
      return FetchedHealth(data);
    }).pipe(Effect.catch((error) => Effect.succeed(FetchFailed({ error: String(error) })))),
    Http.layer,
  ),
);
