import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import * as Alchemist from 'alchemy/Alchemist';
import { Effect } from 'effect';

import stack from '../staging.alchemy';
import { infrastructureSnapshot } from './infrastructure-snapshot';
import { STAGING_PROFILE } from './staging-config';

const [revision, output, unexpected] = process.argv.slice(2);
if (!revision || !output || unexpected || !/^[0-9a-f]{7,64}$/.test(revision)) {
  console.error(
    'Usage: bun tools/staging-infrastructure-snapshot.ts <git-revision> <new-json-file>',
  );
  process.exit(2);
}
process.env.ALCHEMY_WORKERD_PATH = fileURLToPath(import.meta.resolve('workerd/bin/workerd'));
const run = Effect.gen(function* () {
  const plan = yield* Alchemist.plan({
    operation: 'deploy',
    stack,
    stage: 'staging',
    profile: process.env.CI === 'true' ? undefined : STAGING_PROFILE,
  });
  const snapshot = infrastructureSnapshot(plan, revision);
  if (snapshot.status === 'blocked') {
    yield* Effect.logError(snapshot.message);
    return 1;
  }
  const save = Effect.tryPromise(() =>
    writeFile(output, snapshot.json + '\n', { flag: 'wx', mode: 0o600 }),
  );
  const saved = yield* Effect.result(save);
  if (saved._tag === 'Success') return 0;
  yield* Effect.logError('Could not create the snapshot file. Choose a new destination.');
  return 1;
});
const qualified = run.pipe(
  Effect.provide(Alchemist.layer()),
  Effect.scoped,
  Effect.matchEffect({
    onSuccess: Effect.succeed,
    onFailure: () =>
      Effect.gen(function* () {
        yield* Effect.logError(
          'Could not plan Teams staging. Check the approved staging configuration and profile.',
        );
        return 1;
      }),
  }),
);
process.exitCode = await Effect.runPromise(qualified);
