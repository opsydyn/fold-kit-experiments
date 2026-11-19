import { expect, test } from 'bun:test';

import type { StackPlan } from 'alchemy/Alchemist';
import { Context, Effect } from 'effect';

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
  const database: NonNullable<Parameters<typeof changedWorkerSettings>[0]['exports']>[string] = {
    kind: 'sqlMigrations',
    snapshot: { _tag: 'Cloudflare.SqlMigrations', table: 'migrations', records: [] },
  };
  const diagram = {
    kind: 'durableObject',
    constructor: Effect.void,
    services: Context.empty(),
  } as const;
  const replay = { kind: 'workflow', make: () => Effect.void } as const;
  // SAFETY: The persisted state uses this descriptor shape without runtime fields.
  const persisted = {
    exports: {
      default: {},
      Diagram: { kind: 'durableObject' },
      Replay: { kind: 'workflow' },
      Database: database,
    },
  } as Parameters<typeof changedWorkerSettings>[0];
  // SAFETY: The live plan also carries a default export, omitted from WorkerProps' type.
  const live = {
    exports: {
      ...persisted.exports,
      default: { fetch: () => new Response() },
      Diagram: diagram,
      Replay: replay,
    },
  } as Parameters<typeof changedWorkerSettings>[0];

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
