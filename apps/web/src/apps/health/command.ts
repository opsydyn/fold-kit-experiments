import { Command } from '@effect/ui';
import { Effect } from 'effect';
import { FetchHttpClient, HttpClient, HttpClientResponse } from 'effect/http';

import { Message } from './message';
import { HealthData } from './model';

export const FetchHealth = Command.make('FetchHealth', { args: {} }, () =>
  Effect.gen(function* () {
    const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);
    const response = yield* client.get('/api/health');
    const data = yield* HttpClientResponse.schemaBodyJson(HealthData)(response);
    return Message.FetchedHealth(data);
  }).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.match({
      onSuccess: (message) => message,
      onFailure: (error) => Message.FetchFailed({ error: String(error) }),
    }),
  ),
);
