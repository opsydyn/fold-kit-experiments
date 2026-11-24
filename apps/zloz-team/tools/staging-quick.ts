import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import * as Alchemist from 'alchemy/Alchemist';
import { State } from 'alchemy/State';
import { Cause, Context, Effect } from 'effect';

import stack from '../staging.alchemy';
import {
  stagingDatabase,
  inspectBoardDatabase,
  verifyBoardMigration,
  migrationManifest,
  boardMigration,
} from './staging-board-migration';
import { STAGING_ORIGIN, STAGING_PROFILE } from './staging-config';
import {
  QuickStagingPlanRejected,
  changedWorkerSettings,
  rejectQuickStagingPlan,
} from './staging-quick-plan';

const mode = process.argv[2];

process.env.ALCHEMY_WORKERD_PATH = fileURLToPath(import.meta.resolve('workerd/bin/workerd'));

const deploy = Effect.gen(function* () {
  const release = mode === 'release';
  if ((!release && mode !== 'plan' && mode !== 'apply') || process.argv.length !== 3)
    return yield* new QuickStagingPlanRejected({
      message: 'Choose staging plan, apply or release.',
    });
  const plan = yield* Alchemist.plan({
    operation: 'deploy',
    stack,
    stage: 'staging',
    profile: process.env.CI === 'true' ? undefined : STAGING_PROFILE,
  });
  const rejection = rejectQuickStagingPlan(plan, release);
  if (rejection) return yield* rejection;
  for (const row of Object.values(plan.native.resources)) {
    if (row.renamedFrom?.length)
      return yield* new QuickStagingPlanRejected({
        message: `${row.resource.FQN} has a state rename.`,
      });
    if (row.action !== 'update') continue;
    if (row.state.status !== 'created' && row.state.status !== 'updated')
      return yield* new QuickStagingPlanRejected({
        message: `${row.resource.FQN} has an incomplete previous deployment.`,
      });
    if (release && row.resource.FQN === 'ZlozTeamAuth') continue; // Checked below against its stored identity and exact props.
    const settings = changedWorkerSettings(
      row.state.props,
      row.props,
      row.resource.FQN === 'ZlozTeamStagingApp',
    );
    if (settings.length)
      return yield* new QuickStagingPlanRejected({
        message: `${row.resource.FQN} changes Worker settings (${settings.join(', ')}).`,
      });
    yield* Effect.logInfo(`Update ${row.resource.FQN}`);
  }
  const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
  const preflight = release
    ? yield* Effect.tryPromise(async () => {
        const manifest = await migrationManifest();
        const database = stagingDatabase(plan, account, manifest);
        const before = await inspectBoardDatabase(account, database.databaseId);
        if (!verifyBoardMigration(manifest, before) && !database.pending)
          throw new QuickStagingPlanRejected({
            message: 'Migration is pending but Alchemy plans no database update.',
          });
        return { database, manifest, before };
      })
    : undefined;
  if (Alchemist.hasChanges(plan) && (release || mode === 'apply')) {
    yield* Alchemist.apply(plan);
    yield* Effect.logInfo(`Applied Teams staging plan for ${STAGING_ORIGIN}.`);
  }
  if (preflight) {
    const store = yield* Context.get(plan.context, State);
    const db = yield* store.get({
      stack: plan.stack.name,
      stage: plan.stack.stage,
      fqn: 'ZlozTeamAuth',
    });
    if (
      !db ||
      !('attr' in db) ||
      db.attr?.accountId !== account ||
      db.attr?.databaseId !== preflight.database.databaseId
    )
      return yield* new QuickStagingPlanRejected({ message: 'Staging database identity changed.' });
    const verified = yield* Effect.tryPromise(async () => {
      const after = await inspectBoardDatabase(account, preflight.database.databaseId);
      verifyBoardMigration(preflight.manifest, after, preflight.before);
      const receipt = `Verified ${boardMigration} on the existing staging database. History rows: ${preflight.before.history.length} → ${after.history.length}. Column definition and previous history verified.`;
      if (process.env.GITHUB_STEP_SUMMARY)
        await appendFile(process.env.GITHUB_STEP_SUMMARY, receipt + '\n');
      return receipt;
    });
    yield* Effect.logInfo(verified);
  }
});

const program = deploy.pipe(
  Effect.provide(Alchemist.layer()),
  Effect.scoped,
  Effect.matchEffect({
    onSuccess: () => Effect.succeed(0),
    onFailure: (error) =>
      Effect.gen(function* () {
        const message =
          error instanceof QuickStagingPlanRejected
            ? error.message
            : error instanceof Cause.UnknownError && error.cause instanceof QuickStagingPlanRejected
              ? error.cause.message
              : 'Alchemy could not complete the staging plan, apply or verification.';
        yield* Effect.logError(`Teams staging stopped. ${message}`);
        return 1;
      }),
  }),
);
process.exitCode = await Effect.runPromise(program);
