import { Data, Effect, Match, Schema } from 'effect';
import { FetchHttpClient, HttpClient, HttpClientResponse } from 'effect/http';

import { delays, Fixture, Request, Snapshot } from './data';

const fetchApi = (args: Request) => {
  const program = Effect.gen(function* () {
    const parameters = new URLSearchParams({
      dataset: args.dataset,
      revision: String(args.revision),
      profile: args.profile,
      fail: String(args.fail),
    });
    const response = yield* HttpClient.get('/api/datasets?' + parameters);
    return yield* HttpClientResponse.schemaBodyJson(Snapshot)(response).pipe(
      Effect.filterOrFail(
        (data) => data.dataset === args.dataset && data.revision === args.revision,
        () => new FixtureError({ reason: 'unexpected-dataset' }),
      ),
    );
  });
  return program.pipe(Effect.withSpan('fetchDatasetApi'));
};

class FixtureError extends Data.TaggedError('FixtureError')<{
  readonly reason: 'simulated-failure' | 'unexpected-dataset';
}> {}

const fetchFixtureData = (args: Request) => {
  const program = Effect.gen(function* () {
    const response = yield* HttpClient.get(
      `${args.fixturesUrl ?? '/datasets/'}${args.dataset}.json`,
    );
    const fixture = yield* HttpClientResponse.schemaBodyJson(Fixture)(response).pipe(
      Effect.filterOrFail(
        (data) => data.dataset === args.dataset,
        () => new FixtureError({ reason: 'unexpected-dataset' }),
      ),
    );
    return { ...fixture, revision: args.revision };
  });
  return program.pipe(Effect.withSpan('fetchDatasetFixtureData'));
};

const fetchFixture = (args: Request) => {
  const program = Effect.gen(function* () {
    // Latency and deliberate failures live in this Command, without a server process.
    yield* Effect.sleep(delays[args.profile]);
    return yield* Match.value(args.fail).pipe(
      Match.when(true, () => Effect.fail(new FixtureError({ reason: 'simulated-failure' }))),
      Match.orElse(() => fetchFixtureData(args)),
    );
  });
  return program.pipe(Effect.withSpan('fetchDatasetFixture'));
};

const datasetKey = (args: Pick<Request, 'source' | 'dataset'>): string =>
  `${args.source ?? 'api'}:${args.dataset}`;

export const execute = (args: Request) =>
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
      Effect.provide(FetchHttpClient.layer),
    );

const Entry = Schema.Struct({
  snapshot: Schema.optional(Snapshot),
  pending: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
});
export type Entry = typeof Entry.Type;
export const Cache = Schema.Record(Schema.String, Entry);
export type Cache = typeof Cache.Type;

export const Completion = Schema.TaggedStruct('CompletedFetch', {
  args: Request,
  generation: Schema.Number,
  result: Schema.Result(Snapshot, Schema.String),
});
export type Completion = typeof Completion.Type;

export const DatasetQuery = {
  Model: Cache,
  init: (): Cache => ({}),
  read: (cache: Cache, args: Pick<Request, 'source' | 'dataset'>): Entry =>
    cache[datasetKey(args)] ?? {},
  write: (cache: Cache, args: Pick<Request, 'source' | 'dataset'>, entry: Entry): Cache => ({
    ...cache,
    [datasetKey(args)]: entry,
  }),
  Message: { CompletedFetch: Completion.make },
};

export const status = ({ snapshot, pending, error }: Entry) => {
  if (pending !== undefined) return snapshot ? 'Refreshing' : 'Loading';
  if (error !== undefined) return snapshot ? 'Stale' : 'Failure';
  return snapshot ? 'Success' : 'Idle';
};
