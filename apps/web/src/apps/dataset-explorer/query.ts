import { Effect, Schema } from 'effect';
import { HttpClient, HttpClientResponse } from 'effect/http';
import { Http } from 'foldkit';
import { define } from 'foldkit/experimental/query';

import { Request, Snapshot } from './data';

export const DatasetQuery = define({
  name: 'DatasetSnapshot',
  args: Request.fields,
  data: Snapshot,
  error: Schema.String,
  // Profile, revision and failure are request controls, not dataset cache identity.
  toKey: (args) => args.dataset,
  execute: (args) =>
    Effect.gen(function* () {
      const parameters = new URLSearchParams({
        dataset: args.dataset,
        revision: String(args.revision),
        profile: args.profile,
        fail: String(args.fail),
      });
      const response = yield* HttpClient.get('/api/datasets?' + parameters);
      return yield* HttpClientResponse.schemaBodyJson(Snapshot)(response);
    }).pipe(
      Effect.mapError(() => 'The dataset could not be loaded. Retry when ready.'),
      // This Query owns the HTTP Command boundary and supplies its live client.
      // oxlint-disable-next-line linteffect/no-inline-runtime-provide
      Effect.provide(Http.layer),
    ),
});
