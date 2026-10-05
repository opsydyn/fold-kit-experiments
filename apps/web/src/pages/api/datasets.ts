import type { APIRoute } from 'astro';
import { Effect, Match, pipe, Schema } from 'effect';

import { datasets, delays, Request } from '../../apps/dataset-explorer/data';

const datasetResponse = Effect.fn('datasetResponse')(function* (url: URL) {
  const fail = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Boolean))(
    url.searchParams.get('fail') ?? 'false',
  );
  const args = yield* Schema.decodeUnknownEffect(Request)({
    dataset: url.searchParams.get('dataset'),
    revision: Number(url.searchParams.get('revision')),
    profile: url.searchParams.get('profile') ?? 'normal',
    fail,
  });
  yield* Effect.sleep(delays[args.profile]);
  return Match.value(args.fail).pipe(
    Match.when(true, () => new Response('Demonstration request failed', { status: 503 })),
    Match.orElse(() =>
      Response.json(
        {
          dataset: args.dataset,
          revision: args.revision,
          points: datasets[args.dataset].values.map((value, index) => ({ hour: index * 2, value })),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      ),
    ),
  );
});

export function serveDataset(url: URL): Promise<Response> {
  const response = datasetResponse(url).pipe(
    Effect.catch(() => Effect.succeed(new Response('Invalid dataset request', { status: 400 }))),
  );
  return pipe(response, Effect.runPromise);
}

export const GET: APIRoute = ({ url }) => serveDataset(url);
