import { Effect, Schema } from 'effect';
import { HttpClient, HttpClientResponse } from 'effect/unstable/http';
import { Command, Http } from 'foldkit';

import { FailedLoad, LoadedMetrics } from './message';
import { Point } from './model';

export const FetchMetrics = Command.define(
  'FetchMetrics',
  LoadedMetrics,
  FailedLoad,
)(
  Effect.provide(
    Effect.gen(function* () {
      const response = yield* HttpClient.get('/api/request-diagnostics');
      const points = yield* HttpClientResponse.schemaBodyJson(Schema.Array(Point))(response);
      return LoadedMetrics({ points });
    }).pipe(Effect.catch((error) => Effect.succeed(FailedLoad({ error: String(error) })))),
    Http.layer,
  ),
);
