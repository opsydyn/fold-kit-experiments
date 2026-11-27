import type {
  EdgeGuard,
  EdgeSummary,
  ReplayMachine,
  TransitionResult,
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
type MessageTag = Message['_tag'];
type State<Tag extends StateTag> = Extract<ExplorerState, { _tag: Tag }>;
type Event<Tag extends MessageTag> = Extract<Message, { _tag: Tag }>;

interface Rule extends EdgeSummary {
  readonly from: StateTag;
  readonly messageTag: MessageTag;
  readonly target: StateTag;
  readonly apply: (state: ExplorerState, message: Message) => StateChange | undefined;
}
interface StateChange {
  readonly state: ExplorerState;
  readonly commands?: ReadonlyArray<Intent>;
}

const when = (position = 0): EdgeGuard => ({ _tag: 'When', position });

function edge<From extends StateTag, Msg extends MessageTag, Target extends StateTag>(
  from: From,
  messageTag: Msg,
  target: Target,
  change: (
    state: State<From>,
    message: Event<Msg>,
  ) => { readonly state: State<Target>; readonly commands?: ReadonlyArray<Intent> } | undefined,
  guard: EdgeGuard = { _tag: 'Unguarded' },
): Rule {
  return {
    from,
    messageTag,
    target,
    guard,
    apply: (state, message) => {
      if (state._tag !== from || message._tag !== messageTag) return undefined;
      // SAFETY: The discriminants establish the variants expected by the transition.
      return change(state as State<From>, message as Event<Msg>);
    },
  };
}

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

const rules: ReadonlyArray<Rule> = [
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
const edges = rules.map(({ from, messageTag, target, guard }) => ({
  from,
  messageTag,
  target,
  guard,
}));

function step(state: ExplorerState, message: Message): Step {
  const candidates = rules.filter(
    (rule) => rule.from === state._tag && rule.messageTag === message._tag,
  );
  for (const rule of candidates) {
    const change = rule.apply(state, message);
    if (change !== undefined)
      return {
        _tag: 'Transitioned',
        from: rule.from,
        target: rule.target,
        messageTag: rule.messageTag,
        state: change.state,
        commands: change.commands ?? [],
      };
  }
  return {
    _tag: 'Ignored',
    stateTag: state._tag,
    messageTag: message._tag,
    state,
    reason:
      candidates.length > 0
        ? 'GuardsFellThrough'
        : rules.some((rule) => rule.messageTag === message._tag)
          ? 'NotApplicable'
          : 'OutOfAlphabet',
  };
}

function unreachableStates() {
  const reached = new Set<StateTag>([initial._tag]);
  for (const from of reached)
    for (const edge of edges) if (edge.from === from) reached.add(edge.target);
  return stateTags.filter((tag) => !reached.has(tag));
}

export const diagnosticsMachine = {
  initial,
  stateTags,
  edges,
  step,
  unreachableStates,
  deadTransitions: () => {
    const unreachable = unreachableStates();
    return edges
      .filter((edge) => unreachable.includes(edge.from))
      .map((edge) => ({
        edge,
        reason: 'UnreachableSource',
      }));
  },
} satisfies ReplayMachine<ExplorerState, Message, Intent>;
