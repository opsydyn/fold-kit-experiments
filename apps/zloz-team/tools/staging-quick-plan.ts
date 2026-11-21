import { isDeepStrictEqual } from 'node:util';

import type { WorkerProps } from '@alchemy.run/cloudflare/Workers';
import type { StackPlan } from 'alchemy/Alchemist';
import { Context, Data, Effect, Predicate } from 'effect';

import { STAGING_STACK } from './staging-config';

export class QuickStagingPlanRejected extends Data.TaggedError('QuickStagingPlanRejected')<{
  readonly message: string;
}> {}

const workerIds = ['ZlozTeamServer', 'ZlozTeamStagingApp'];
const isTeamsWorker = (row: StackPlan['resources'][number]) =>
  workerIds.includes(row.fqn) && row.resourceType === 'Cloudflare.Worker';

export function rejectQuickStagingPlan(plan: Pick<StackPlan, 'stack' | 'resources' | 'actions'>) {
  if (plan.stack.name !== STAGING_STACK || plan.stack.stage !== 'staging')
    return new QuickStagingPlanRejected({ message: 'The plan must target Teams staging.' });
  for (const worker of workerIds) {
    if (!plan.resources.some((row) => row.fqn === worker && isTeamsWorker(row)))
      return new QuickStagingPlanRejected({
        message: `Missing expected staging Worker ${worker}.`,
      });
  }
  if (
    !plan.resources.some(
      (row) =>
        row.fqn === 'ZlozTeamStagingApp' &&
        row.bindings.some((binding) => binding.sid === 'ZLOZ_BACKEND' && binding.action === 'noop'),
    )
  )
    return new QuickStagingPlanRejected({ message: 'The existing backend binding is required.' });
  for (const row of plan.resources) {
    if (row.action !== 'noop' && (row.action !== 'update' || !isTeamsWorker(row)))
      return new QuickStagingPlanRejected({ message: `${row.fqn} requires ${row.action}.` });
    if (row.bindings.some((binding) => binding.action !== 'noop'))
      return new QuickStagingPlanRejected({ message: `${row.fqn} has binding changes.` });
  }
  if (plan.actions.some((action) => action.action !== 'noop'))
    return new QuickStagingPlanRejected({ message: 'The plan changes a stack action.' });
}

const checkoutPath = (value: string | undefined) =>
  value?.replace(/^.*\/(apps\/zloz-team\/?|apps\/zloz-server\/src\/worker\.ts)$/, '$1');

const normalizeSource = (source: WorkerProps['source']) => {
  if (!source) return source;
  const options = source.options;
  // Alchemy persists a JSON source descriptor, with optional undefined fields omitted.
  return JSON.parse(
    JSON.stringify({
      ...source,
      rootDir: checkoutPath(source.rootDir),
      options:
        Predicate.isObject(options) && Predicate.isString(options.rootDir)
          ? { ...options, rootDir: checkoutPath(options.rootDir) }
          : options,
    }),
  );
};

const frontendServiceBindings = new Set(['ZLOZ_BACKEND', 'QUESTMANCER']);
const normalizeEnvironment = (value: WorkerProps['env']) =>
  Predicate.isObject(value)
    ? Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          frontendServiceBindings.has(key) ? 'existing service binding' : entry,
        ]),
      )
    : value;

const defaultRuntimeHandlers = [
  'fetch',
  'tail',
  'trace',
  'tailStream',
  'scheduled',
  'test',
  'email',
  'queue',
] as const;

type LiveExport = NonNullable<WorkerProps['exports']>[string];
type DefaultHandlers = Partial<
  Record<(typeof defaultRuntimeHandlers)[number], (...args: never[]) => object>
>;
type ExportDescriptor = LiveExport | Pick<LiveExport, 'kind'> | DefaultHandlers;
type WorkerSettings = Omit<WorkerProps, 'exports'> & {
  readonly rootDir?: string;
  readonly exports?: Readonly<Record<string, ExportDescriptor>>;
};

// Alchemy's persisted descriptors omit runtime constructors and handlers.
// Compare export names and stored metadata, including captured SQL migrations.
const normalizeWorkerExports = (value: WorkerSettings['exports']) =>
  value &&
  Object.fromEntries(
    Object.entries(value).map(([name, descriptor]) => [
      name,
      Predicate.isObject(descriptor)
        ? Object.fromEntries(
            Object.entries(descriptor).filter(([field, entry]) => {
              const kind = 'kind' in descriptor ? descriptor.kind : undefined;
              if (name === 'default' && kind === undefined)
                return !(
                  defaultRuntimeHandlers.some((handler) => handler === field) &&
                  Predicate.isFunction(entry)
                );
              if (kind === 'durableObject')
                return !(
                  (field === 'constructor' && Effect.isEffect(entry)) ||
                  (field === 'services' && Context.isContext(entry))
                );
              return !(kind === 'workflow' && field === 'make' && Predicate.isFunction(entry));
            }),
          )
        : descriptor,
    ]),
  );

export function changedWorkerSettings(
  previous: WorkerSettings,
  next: WorkerSettings,
  frontendWorker = false,
): readonly string[] {
  const previousEntries = new Map(Object.entries(previous));
  const nextEntries = new Map(Object.entries(next));
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter((key) => {
    if (key === 'rootDir' || key === 'main')
      return !isDeepStrictEqual(checkoutPath(previous[key]), checkoutPath(next[key]));
    if (key === 'source')
      return !isDeepStrictEqual(normalizeSource(previous[key]), normalizeSource(next[key]));
    if (key === 'exports')
      return !isDeepStrictEqual(
        normalizeWorkerExports(previous[key]),
        normalizeWorkerExports(next[key]),
      );
    // Persisted values and live frontend service references have different
    // representations. The guard independently requires every binding to be a no-op.
    if (key === 'env' && frontendWorker)
      return !isDeepStrictEqual(
        normalizeEnvironment(previous[key]),
        normalizeEnvironment(next[key]),
      );
    return !isDeepStrictEqual(previousEntries.get(key), nextEntries.get(key));
  });
}
