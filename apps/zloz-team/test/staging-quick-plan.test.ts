import { expect, test } from 'bun:test';

import type { WorkerProps } from '@alchemy.run/cloudflare/Workers';
import type { StackPlan } from 'alchemy/Alchemist';
import { Context, Effect, Schema } from 'effect';

import { changedWorkerSettings, rejectQuickStagingPlan } from '../tools/staging-quick-plan';

type Plan = Pick<StackPlan, 'stack' | 'resources' | 'actions'>;
const fixture = {
  stack: { name: 'zloz-team-staging', stage: 'staging' },
  resources: [
    {
      fqn: 'ZlozTeamStagingApp',
      logicalId: 'ZlozTeamStagingApp',
      resourceType: 'Cloudflare.Worker',
      action: 'update',
      bindings: [{ sid: 'ZLOZ_BACKEND', action: 'noop' }],
    },
    {
      fqn: 'ZlozTeamServer',
      logicalId: 'ZlozTeamServer',
      resourceType: 'Cloudflare.Worker',
      action: 'noop',
      bindings: [{ sid: 'ZlozTeamAuth', action: 'noop' }],
    },
    {
      fqn: 'ZlozTeamAuth',
      logicalId: 'ZlozTeamAuth',
      resourceType: 'Cloudflare.D1.Database',
      action: 'noop',
      bindings: [],
    },
  ],
  actions: [],
} as const satisfies Plan;

test('the quick deploy accepts existing Teams Worker updates and no-op rows', () => {
  expect(rejectQuickStagingPlan(fixture)).toBeUndefined();
});

test('the quick deploy stops at scope, resource, binding and backfill changes', () => {
  const [app, server, database] = fixture.resources;
  const rejected: Plan[] = [
    { ...fixture, stack: { ...fixture.stack, stage: 'prod' } },
    { ...fixture, resources: [app, database] },
    { ...fixture, resources: [app, server, { ...database, action: 'update' }] },
    { ...fixture, resources: [app, server, { ...database, action: 'orphaned' }] },
    { ...fixture, resources: [{ ...app, action: 'replace' }, server, database] },
    { ...fixture, resources: [{ ...app, action: 'adopted' }, server, database] },
    { ...fixture, resources: [{ ...app, bindings: [] }, server, database] },
    {
      ...fixture,
      resources: [{ ...app, bindings: [{ sid: 'NEW', action: 'create' }] }, server, database],
    },
    {
      ...fixture,
      actions: [{ fqn: 'Backfill', logicalId: 'Backfill', actionType: 'Task', action: 'run' }],
    },
  ];
  for (const plan of rejected) expect(rejectQuickStagingPlan(plan)).toBeDefined();
});

test('a fresh runner may relocate the checkout but cannot change Worker settings', () => {
  const props = {
    domain: 'teams-staging.opsydyn.xyz',
    workersDev: false,
    rootDir: '/private/checkout/apps/zloz-team/',
    source: {
      provider: 'astro',
      devMode: 'server' as const,
      rootDir: '/private/checkout/apps/zloz-team/',
      options: { rootDir: '/private/checkout/apps/zloz-team/', sessionKVBindingName: false },
    },
  };
  const moved = {
    ...props,
    rootDir: '/home/runner/work/repo/apps/zloz-team/',
    source: {
      ...props.source,
      rootDir: '/home/runner/work/repo/apps/zloz-team/',
      options: { ...props.source.options, rootDir: '/home/runner/work/repo/apps/zloz-team/' },
    },
  };
  expect(changedWorkerSettings(props, moved)).toEqual([]);
  expect(changedWorkerSettings(props, { ...moved, domain: 'other.example' })).toEqual(['domain']);
  expect(
    changedWorkerSettings(props, { ...moved, source: { ...moved.source, provider: 'different' } }),
  ).toEqual(['source']);
  expect(changedWorkerSettings(props, { ...moved, workersDev: true })).toEqual(['workersDev']);
});

test('the current service binding is compared by the plan while other environment settings are exact', () => {
  const previous = { env: { ZLOZ_BACKEND: { id: 'existing' }, SOMETHING: 'staging' } };
  const next = { env: { ZLOZ_BACKEND: () => 'live reference', SOMETHING: 'staging' } };
  expect(changedWorkerSettings(previous, next, true)).toEqual([]);
  expect(changedWorkerSettings(previous, next)).toEqual(['env']);
  expect(changedWorkerSettings(previous, { env: { ...next.env, EXTRA: true } }, true)).toEqual([
    'env',
  ]);
  expect(changedWorkerSettings(previous, { env: { SOMETHING: 'staging' } }, true)).toEqual(['env']);
});

test('the quick deploy accepts live implementations of the same persisted Worker exports', () => {
  const database: NonNullable<WorkerProps['exports']>[string] = {
    kind: 'sqlMigrations',
    snapshot: { _tag: 'Cloudflare.SqlMigrations', table: 'migrations', records: [] },
  };
  const diagram = {
    kind: 'durableObject',
    constructor: Effect.void,
    services: Context.empty(),
  } as const;
  const replay = { kind: 'workflow', make: () => Effect.void } as const;
  const persisted = {
    exports: {
      default: {},
      Diagram: { kind: 'durableObject' },
      Replay: { kind: 'workflow' },
      Database: database,
    },
  } satisfies Parameters<typeof changedWorkerSettings>[0];
  const live = {
    exports: {
      ...persisted.exports,
      default: { fetch: () => new Response() },
      Diagram: diagram,
      Replay: replay,
    },
  };

  expect(changedWorkerSettings(persisted, live)).toEqual([]);
  expect(
    changedWorkerSettings(persisted, { exports: { ...live.exports, Added: diagram } }),
  ).toEqual(['exports']);
  expect(
    changedWorkerSettings(persisted, { exports: { ...live.exports, Diagram: replay } }),
  ).toEqual(['exports']);
  expect(
    changedWorkerSettings(persisted, {
      exports: {
        ...live.exports,
        Database: {
          kind: 'sqlMigrations',
          snapshot: { ...database.snapshot, table: 'changed' },
        },
      },
    }),
  ).toEqual(['exports']);
});

test('the quick deploy accepts persisted references to both existing frontend Workers', () => {
  const previous = {
    env: {
      ZLOZ_BACKEND: { id: 'teams-server' },
      QUESTMANCER: { id: 'room-worker' },
      QUESTMANCER_TEAM: 'pilot-team',
      QUESTMANCER_PREVIEW_TEAM: 'pilot-team',
    },
  };
  const candidate = {
    env: {
      ...previous.env,
      ZLOZ_BACKEND: () => 'live backend',
      QUESTMANCER: () => 'live room worker',
    },
  };
  expect(changedWorkerSettings(previous, candidate, true)).toEqual([]);
  expect(
    changedWorkerSettings(
      previous,
      {
        env: { ...candidate.env, QUESTMANCER_PREVIEW_TEAM: '' },
      },
      true,
    ),
  ).toEqual(['env']);
  const { QUESTMANCER: _removed, ...withoutRoom } = candidate.env;
  expect(changedWorkerSettings(previous, { env: withoutRoom }, true)).toEqual(['env']);

  const [app, server, database] = fixture.resources;
  for (const plan of [
    {
      ...fixture,
      resources: [
        { ...app, bindings: [...app.bindings, { sid: 'QUESTMANCER', action: 'update' }] },
        server,
        database,
      ],
    },
    {
      ...fixture,
      resources: [
        app,
        {
          ...server,
          bindings: [...server.bindings, { sid: 'ZLOZ_SIGN_IN_EMAIL', action: 'delete' }],
        },
        database,
      ],
    },
  ] as const satisfies readonly Plan[]) {
    expect(rejectQuickStagingPlan(plan)).toBeDefined();
  }
});

test('the standalone workflow supplies the existing pilot settings from its protected environment', async () => {
  const path = new URL('../../../.github/workflows/deploy-teams-staging.yml', import.meta.url);
  const workflow = Bun.YAML.parse(await Bun.file(path).text());
  expect(workflow).toMatchObject({
    jobs: {
      deploy: {
        environment: { name: 'teams-staging' },
        steps: expect.arrayContaining([
          expect.objectContaining({
            name: 'Apply the guarded Teams staging plan',
            env: expect.objectContaining({
              ZLOZ_EMAIL_SIGN_IN_TEAM: '${{ vars.ZLOZ_EMAIL_SIGN_IN_TEAM }}',
              ZLOZ_EMAIL_SIGN_IN_FROM: '${{ vars.ZLOZ_EMAIL_SIGN_IN_FROM }}',
              ZLOZ_QUESTMANCER_TEAM: '${{ vars.ZLOZ_QUESTMANCER_TEAM }}',
              ZLOZ_QUESTMANCER_PREVIEW_TEAM: '${{ vars.ZLOZ_QUESTMANCER_PREVIEW_TEAM }}',
            }),
          }),
          expect.objectContaining({
            name: 'Verify hosted build, backend and sign-in',
            env: expect.objectContaining({
              ZLOZ_EMAIL_SIGN_IN_TEAM: '${{ vars.ZLOZ_EMAIL_SIGN_IN_TEAM }}',
            }),
          }),
        ]),
      },
    },
  });
});

test('the migration release admits only an update to the existing Teams D1 resource', () => {
  const [app, server, db] = fixture.resources;
  const database = { ...db, resourceType: 'Cloudflare.D1Database', action: 'update' as const };
  const plan = { ...fixture, resources: [app, server, database] };
  expect(rejectQuickStagingPlan(plan)).toBeDefined();
  expect(rejectQuickStagingPlan(plan, true)).toBeUndefined();
  for (const other of [
    { ...database, action: 'replace' as const },
    { ...database, fqn: 'AnotherDatabase' },
    { ...database, bindings: [{ sid: 'OTHER', action: 'create' as const }] },
  ])
    expect(
      rejectQuickStagingPlan({ ...plan, resources: [app, server, other] }, true),
    ).toBeDefined();
});

test('staging automatically selects the successful same-repository main push SHA and gates hosted smoke on apply', async () => {
  const path = new URL('../../../.github/workflows/deploy-teams-staging.yml', import.meta.url);
  const step = Schema.Struct({
    name: Schema.optional(Schema.String),
    id: Schema.optional(Schema.String),
    if: Schema.optional(Schema.String),
    run: Schema.optional(Schema.String),
    with: Schema.optional(Schema.Struct({ ref: Schema.optional(Schema.String) })),
  });
  const workflow = Schema.decodeUnknownSync(
    Schema.Struct({
      on: Schema.Struct({ workflow_run: Schema.Unknown }),
      jobs: Schema.Struct({
        candidate: Schema.Struct({ if: Schema.String, steps: Schema.Array(step) }),
        deploy: Schema.Struct({
          needs: Schema.String,
          concurrency: Schema.Unknown,
          env: Schema.Struct({ RELEASE_SHA: Schema.String }),
          steps: Schema.Array(step),
        }),
      }),
    }),
  )(Bun.YAML.parse(await Bun.file(path).text()));
  expect(workflow.on.workflow_run).toEqual({
    workflows: ['ci'],
    types: ['completed'],
    branches: ['main'],
  });
  const { candidate, deploy } = workflow.jobs;
  for (const condition of [
    "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.conclusion == 'success'",
    'github.event.workflow_run.head_repository.full_name == github.repository',
  ])
    expect(candidate.if).toContain(condition);
  expect(candidate.steps[0]?.run).toContain('git/ref/heads/main');
  expect(deploy.needs).toBe('candidate');
  expect(deploy.env.RELEASE_SHA).toBe('${{ needs.candidate.outputs.sha }}');
  expect(deploy.steps[0]?.with?.ref).toBe(deploy.env.RELEASE_SHA);
  expect(deploy.concurrency).toEqual({ group: 'deploy-teams-staging', queue: 'max' });
  const steps = deploy.steps;
  const check = steps.findIndex((step) => step.id === 'current');
  const apply = steps.findIndex((step) => step.run?.includes('bun tools/staging-quick.ts release'));
  const smoke = steps.findIndex((step) => step.name === 'Verify hosted build, backend and sign-in');
  expect(check).toBeGreaterThan(0);
  expect(apply).toBeGreaterThan(check);
  expect(smoke).toBeGreaterThan(apply);
  expect(steps[apply]?.if).toBe("steps.current.outputs.release == 'true'");
  expect(steps[smoke]?.if).toBe(steps[apply]?.if);
});
