import * as Cloudflare from '@alchemy.run/cloudflare';
import FixtureWorker from '@opsydyn/zloz-server/test/fixture-worker';
import OperationsWorker from '@opsydyn/zloz-server/test/operations-worker';
import * as Alchemy from 'alchemy';
import * as Secrets from 'alchemy/Secrets';
import { Effect } from 'effect';

import { localApp } from '../tools/local-app';
import { requireLocalDevelopment } from '../tools/local-only';

requireLocalDevelopment();

export default Alchemy.Stack(
  'zloz-team-runtime-test',
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
    // Preserve intentional empty provider fields; never fall back to staging .env.
    secrets: Secrets.ProcessEnv(),
  },
  Effect.gen(function* () {
    const app = yield* localApp;
    const fixture = yield* FixtureWorker;
    const operations = yield* OperationsWorker;
    return { ...app, fixture: fixture.url, operations: operations.url };
  }),
);
