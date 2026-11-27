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
