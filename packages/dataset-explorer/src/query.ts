import { Data, Effect, Match, Schema } from 'effect';
import { HttpClient, HttpClientResponse } from 'effect/http';
import { Http } from 'foldkit';
import { define } from 'foldkit/experimental/query';

import { delays, Fixture, Request, Snapshot } from './data';

const fetchApi = Effect.fn('fetchDatasetApi')(function* (args: Request) {
  const parameters = new URLSearchParams({
    dataset: args.dataset,
    revision: String(args.revision),
    profile: args.profile,
    fail: String(args.fail),
  });
  const response = yield* HttpClient.get('/api/datasets?' + parameters);
  return yield* HttpClientResponse.schemaBodyJson(Snapshot)(response);
});

class FixtureError extends Data.TaggedError('FixtureError')<{
  readonly reason: 'simulated-failure' | 'unexpected-dataset';
}> {}

const fetchFixtureData = Effect.fn('fetchDatasetFixtureData')(function* (args: Request) {
  const response = yield* HttpClient.get(`/datasets/${args.dataset}.json`);
  const fixture = yield* HttpClientResponse.schemaBodyJson(Fixture)(response).pipe(
    Effect.filterOrFail(
      (data) => data.dataset === args.dataset,
      () => new FixtureError({ reason: 'unexpected-dataset' }),
    ),
  );
  return { ...fixture, revision: args.revision };
});

const fetchFixture = Effect.fn('fetchDatasetFixture')(function* (args: Request) {
  // Latency and deliberate failures live in this Command, without a server process.
  yield* Effect.sleep(delays[args.profile]);
  return yield* Match.value(args.fail).pipe(
    Match.when(true, () => Effect.fail(new FixtureError({ reason: 'simulated-failure' }))),
    Match.orElse(() => fetchFixtureData(args)),
  );
});

const datasetKey = (args: Request): string => `${args.source ?? 'api'}:${args.dataset}`;

const execute = (args: Request) =>
  Match.value(args.source ?? 'api')
    .pipe(
      Match.when('fixtures', () => fetchFixture(args)),
      Match.when('api', () => fetchApi(args)),
      Match.exhaustive,
    )
    .pipe(
      Effect.mapError(() => 'The dataset could not be loaded. Retry when ready.'),
      // This Query owns the HTTP Command boundary and supplies its live client.
      // oxlint-disable-next-line linteffect/no-inline-runtime-provide
      Effect.provide(Http.layer),
    );

export const DatasetQuery = define({
  name: 'DatasetSnapshot',
  args: Request.fields,
  data: Snapshot,
  error: Schema.String,
  // Transport and station identify data; other arguments control the request.
  toKey: datasetKey,
  execute,
});
