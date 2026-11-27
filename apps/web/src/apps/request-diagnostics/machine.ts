import {
  defineReplayMachine,
  edgeFor,
  type EdgeGuard,
  type TransitionResult,
} from '../stateflow/machine-contract';
import type { Message } from './message';
import { ExplorerState, type Point } from './model';
import { isDiagnosticsPath } from './navigation';

export const fetchMetrics = { name: 'FetchMetrics', key: 'FetchMetrics' } as const;
export const interruptMetrics = {
  name: 'FetchMetrics.Interrupt',
  interruptsKey: 'FetchMetrics',
} as const;
type Intent = typeof fetchMetrics | typeof interruptMetrics;

export type Step = TransitionResult<ExplorerState, Intent>;

type StateTag = ExplorerState['_tag'];
type Event<Tag extends Message['_tag']> = Extract<Message, { _tag: Tag }>;

const edge = edgeFor<ExplorerState, Message, Intent>();
const when = (position = 0): EdgeGuard => ({ _tag: 'When', position });

const load = () => ({ state: ExplorerState.Loading(), commands: [fetchMetrics] });
const reload = () => ({
  state: ExplorerState.Cancelling({ reason: 'Reload' }),
  commands: [interruptMetrics],
});
const loadOnReturn = (_state: ExplorerState, message: Event<'Navigated'>) =>
  message.phase !== 'exited' && isDiagnosticsPath(message.path) ? load() : undefined;

function filter(points: ReadonlyArray<Point>, domain: readonly [number, number]) {
  if (domain[1] - domain[0] <= 2) return undefined;
  return {
    state: ExplorerState.Filtered({
      points: points.filter(({ x }) => x >= domain[0] && x <= domain[1]),
      allPoints: points,
      domain,
    }),
  };
}

const rules = [
  edge('Loading', 'ClickedReload', 'Cancelling', reload),
  edge(
    'Loading',
    'Navigated',
    'Cancelling',
    (_state, message) =>
      message.phase === 'exited'
        ? {
            state: ExplorerState.Cancelling({ reason: 'RouteExit' }),
            commands: [interruptMetrics],
          }
        : undefined,
    when(),
  ),
  edge('Loading', 'LoadedMetrics', 'Ready', (_state, message) => ({
    state: ExplorerState.Ready({ points: message.points }),
  })),
  edge('Loading', 'FailedLoad', 'Failed', (_state, message) => ({
    state: ExplorerState.Failed({ error: message.error }),
  })),
  edge('Ready', 'ClickedReload', 'Cancelling', reload),
  edge('Ready', 'StartedSelection', 'Selecting', ({ points }) => ({
    state: ExplorerState.Selecting({ points, allPoints: points }),
  })),
  edge(
    'Ready',
    'ChangedSelection',
    'Filtered',
    ({ points }, { domain }) => filter(points, domain),
    when(),
  ),
  edge(
    'Selecting',
    'ChangedSelection',
    'Filtered',
    ({ points }, { domain }) => filter(points, domain),
    when(),
  ),
  edge('Selecting', 'ClearedSelection', 'Ready', ({ allPoints }) => ({
    state: ExplorerState.Ready({ points: allPoints }),
  })),
  edge('Filtered', 'ClearedSelection', 'Ready', ({ allPoints }) => ({
    state: ExplorerState.Ready({ points: allPoints }),
  })),
  edge('Filtered', 'ClickedReload', 'Cancelling', reload),
  edge('Failed', 'ClickedReload', 'Cancelling', reload),
  edge('Failed', 'Navigated', 'Loading', loadOnReturn, when()),
  edge(
    'Cancelling',
    'CompletedCancelFetchMetrics',
    'Loading',
    ({ reason }) => (reason === 'Reload' ? load() : undefined),
    when(),
  ),
  edge(
    'Cancelling',
    'CompletedCancelFetchMetrics',
    'Idle',
    () => ({ state: ExplorerState.Idle() }),
    { _tag: 'Otherwise', position: 1 },
  ),
  edge('Idle', 'Navigated', 'Loading', loadOnReturn, when()),
];

const initial = ExplorerState.Loading();
const stateTags = [
  'Idle',
  'Loading',
  'Cancelling',
  'Ready',
  'Selecting',
  'Filtered',
  'Failed',
] satisfies ReadonlyArray<StateTag>;
export const diagnosticsMachine = defineReplayMachine<ExplorerState, Message, Intent>(
  initial,
  stateTags,
  rules,
);
