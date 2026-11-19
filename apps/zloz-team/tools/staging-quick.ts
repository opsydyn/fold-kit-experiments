import { fileURLToPath } from 'node:url';

import * as Alchemist from 'alchemy/Alchemist';
import { Effect } from 'effect';

import stack from '../staging.alchemy';
import { STAGING_ORIGIN, STAGING_PROFILE } from './staging-config';
import {
  QuickStagingPlanRejected,
  changedWorkerSettings,
  rejectQuickStagingPlan,
} from './staging-quick-plan';

const mode = process.argv[2];

process.env.ALCHEMY_WORKERD_PATH = fileURLToPath(import.meta.resolve('workerd/bin/workerd'));

const deploy = Effect.gen(function* () {
  if ((mode !== 'plan' && mode !== 'apply') || process.argv.length !== 3)
    return yield* new QuickStagingPlanRejected({ message: 'Choose quick staging plan or apply.' });
  const plan = yield* Alchemist.plan({
    operation: 'deploy',
    stack,
    stage: 'staging',
    profile: process.env.CI === 'true' ? undefined : STAGING_PROFILE,
  });
  const rejection = rejectQuickStagingPlan(plan);
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
  if (!Alchemist.hasChanges(plan)) {
    yield* Effect.logInfo('Teams staging is already current.');
    return;
  }
  if (mode === 'apply') {
    yield* Alchemist.apply(plan);
    yield* Effect.logInfo(`Applied Teams staging plan for ${STAGING_ORIGIN}.`);
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
            : 'Alchemy could not complete the plan or apply.';
        yield* Effect.logError(`Teams staging stopped. ${message}`);
        return 1;
      }),
  }),
);
process.exitCode = await Effect.runPromise(program);
