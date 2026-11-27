type Tagged = Readonly<{ _tag: string }>;

export type EdgeGuard =
  | Readonly<{ _tag: 'Unguarded' }>
  | Readonly<{ _tag: 'When' | 'Otherwise'; position: number }>;

export interface EdgeSummary {
  readonly from: string;
  readonly messageTag: string;
  readonly target: string;
  readonly guard: EdgeGuard;
}

export type TransitionResult<State, Command> =
  | Readonly<{
      _tag: 'Transitioned';
      from: string;
      messageTag: string;
      target: string;
      state: State;
      commands: ReadonlyArray<Command>;
    }>
  | Readonly<{
      _tag: 'Ignored';
      stateTag: string;
      messageTag: string;
      state: State;
      reason: string;
    }>;

export interface ReplayMachine<State extends Tagged, Message extends Tagged, Command> {
  readonly initial: State;
  readonly stateTags: ReadonlyArray<string>;
  readonly edges: ReadonlyArray<EdgeSummary>;
  readonly step: (state: State, message: Message) => TransitionResult<State, Command>;
  readonly unreachableStates: () => ReadonlyArray<string>;
  readonly deadTransitions: () => ReadonlyArray<{
    readonly edge: EdgeSummary;
    readonly reason: string;
  }>;
}

interface StateChange<State, Command> {
  readonly state: State;
  readonly commands?: ReadonlyArray<Command>;
}

interface Rule<State, Message, Command> extends EdgeSummary {
  readonly apply: (state: State, message: Message) => StateChange<State, Command> | undefined;
}

export function edgeFor<State extends Tagged, Message extends Tagged, Command>() {
  return <From extends State['_tag'], Msg extends Message['_tag'], Target extends State['_tag']>(
    from: From,
    messageTag: Msg,
    target: Target,
    change: (
      state: Extract<State, { _tag: From }>,
      message: Extract<Message, { _tag: Msg }>,
    ) => StateChange<Extract<State, { _tag: Target }>, Command> | undefined,
    guard: EdgeGuard = { _tag: 'Unguarded' },
  ): Rule<State, Message, Command> => ({
    from,
    messageTag,
    target,
    guard,
    apply: (state, message) => {
      if (state._tag !== from || message._tag !== messageTag) return undefined;
      // SAFETY: The checked discriminants identify the exact variants passed to the rule.
      return change(
        state as Extract<State, { _tag: From }>,
        message as Extract<Message, { _tag: Msg }>,
      );
    },
  });
}

export function defineReplayMachine<State extends Tagged, Message extends Tagged, Command>(
  initial: State,
  stateTags: ReadonlyArray<State['_tag']>,
  rules: ReadonlyArray<Rule<State, Message, Command>>,
): ReplayMachine<State, Message, Command> {
  const edges = rules.map(({ from, messageTag, target, guard }) => ({
    from,
    messageTag,
    target,
    guard,
  }));
  const alphabet = new Set(rules.map(({ messageTag }) => messageTag));
  const reachable = new Set([initial._tag]);
  for (const from of reachable)
    for (const edge of edges) if (edge.from === from) reachable.add(edge.target);
  const unreachable = stateTags.filter((tag) => !reachable.has(tag));

  const shadowed = new Set<string>();
  const dead = edges.flatMap((edge) => {
    const key = JSON.stringify([edge.from, edge.messageTag]);
    const reason = !reachable.has(edge.from)
      ? 'UnreachableSource'
      : shadowed.has(key)
        ? 'ShadowedByOtherwise'
        : undefined;
    if (edge.guard._tag === 'Otherwise') shadowed.add(key);
    return reason === undefined ? [] : [{ edge, reason }];
  });

  function step(state: State, message: Message): TransitionResult<State, Command> {
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
      if (rule.guard._tag === 'Otherwise') break;
    }
    return {
      _tag: 'Ignored',
      stateTag: state._tag,
      messageTag: message._tag,
      state,
      reason:
        candidates.length > 0
          ? 'GuardsFellThrough'
          : alphabet.has(message._tag)
            ? 'NotApplicable'
            : 'OutOfAlphabet',
    };
  }

  return {
    initial,
    stateTags,
    edges,
    step,
    unreachableStates: () => unreachable,
    deadTransitions: () => dead,
  };
}
