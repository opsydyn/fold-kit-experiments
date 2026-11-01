/**
 * A specimen: one FoldKit Machine the observatory can watch, erased to plain records so the
 * page holds any of them the same way. Its events are kept encoded, as JSON, so a recording
 * is a list of strings: it fits the Model, a link and a BroadcastChannel alike, and the
 * machine's own Message schema decodes it again when the trace is replayed.
 *
 * Replay is pure: the state at any point is the machine folded over the events up to it,
 * so scrubbing back and forth recomputes rather than remembers.
 */
import type { StateFlowGuard } from '@opsydyn/foldkit-viz/stateflow';
import { Option, Schema } from 'effect';
import type { Machine } from 'foldkit/experimental';

import type { TransitionFact } from './model';

type Tagged = Readonly<{ _tag: string }>;

/** One of the machine's edges, as the graph draws it. */
export type SpecimenEdge = Readonly<{
  id: string;
  from: string;
  messageTag: string;
  target: string;
  guard: StateFlowGuard;
  guardPosition?: number;
}>;

/** One replayed event: the fact recorded, and the state the machine is in after it. */
export type Frame = Readonly<{ record: TransitionFact; stateTag: string }>;

/** The shortest run of named example messages that fires an edge, from the initial state. */
export type CoveragePath = Readonly<{ edgeId: string; steps: ReadonlyArray<string> }>;

/** An edge the machine can never take, with FoldKit's reason. */
export type DeadEdge = Readonly<{ edgeId: string; reason: string }>;

export type Specimen = Readonly<{
  id: string;
  label: string;
  summary: string;
  /** The page whose app reports this machine's messages live, when one does. */
  livePath: Option.Option<string>;
  /** How the generated tests name the machine and its examples. */
  machineName: string;
  examplesName: string;
  initialTag: string;
  stateTags: ReadonlyArray<string>;
  errorStates: ReadonlyArray<string>;
  transientStates: ReadonlyArray<string>;
  edges: ReadonlyArray<SpecimenEdge>;
  unreachable: ReadonlyArray<string>;
  dead: ReadonlyArray<DeadEdge>;
  sample: ReadonlyArray<string>;
  replay: (events: ReadonlyArray<string>) => ReadonlyArray<Frame>;
  coverage: ReadonlyArray<CoveragePath>;
  /** Whether a received event is one of this machine's messages. */
  accepts: (event: string) => boolean;
}>;

const guardOf = (guard: Machine.EdgeGuard): StateFlowGuard =>
  (({ Unguarded: 'unguarded', When: 'when', Otherwise: 'otherwise' }) as const)[guard._tag];

const edgeId = (edge: Machine.EdgeSummary<Tagged, Tagged>): string =>
  [
    edge.from,
    edge.messageTag,
    edge.target,
    edge.guard._tag,
    edge.guard._tag === 'Unguarded' ? '' : edge.guard.position,
  ].join(':');

/** The edge a transition took, as the trace and the coverage know it: from, message, target. */
export const tripleOf = (
  edge: Readonly<{ from: string; messageTag: string; target?: string }>,
): string => [edge.from, edge.messageTag, edge.target ?? ''].join('→');

/** The last step of a run of messages from the machine's initial state: what a test asserts. */
export const lastStep = <State extends Tagged, Message extends Tagged, R>(
  machine: Machine.Machine<State, Message, R>,
  messages: ReadonlyArray<Message>,
): Machine.TransitionResult<State, Message, R> => {
  const before = messages
    .slice(0, -1)
    .reduce((state, message) => machine.step(state, message).state, machine.initial);
  const last = Option.getOrThrow(Option.fromNullishOr(messages.at(-1)));
  return machine.step(before, last);
};

/** How deep, and over how many distinct states, the coverage search looks. */
const searchLimits = { depth: 8, states: 400 } as const;

type Visit<State> = Readonly<{ state: State; steps: ReadonlyArray<string> }>;

/**
 * Breadth first from the initial state, trying every named example in every state reached:
 * the first run to fire each edge is its shortest. States are told apart by their whole
 * value, not just their tag, so a guard that reads the state (a cancel for a reload, or for
 * leaving the page) finds both of its branches.
 */
const explore = <State extends Tagged, Message extends Tagged, R>(
  machine: Machine.Machine<State, Message, R>,
  examples: Readonly<Record<string, Message>>,
): ReadonlyMap<string, ReadonlyArray<string>> => {
  const found = new Map<string, ReadonlyArray<string>>();
  const seen = new Set([JSON.stringify(machine.initial)]);
  const names = Object.keys(examples);
  const level = (frontier: ReadonlyArray<Visit<State>>): ReadonlyArray<Visit<State>> =>
    frontier.flatMap(({ state, steps }) =>
      names.flatMap((name): ReadonlyArray<Visit<State>> => {
        // SAFETY: `name` is one of the keys of `examples`.
        const result = machine.step(state, examples[name] as Message);
        if (result._tag !== 'Transitioned') return [];
        const path = [...steps, name];
        const triple = tripleOf(result);
        if (!found.has(triple)) found.set(triple, path);
        const key = JSON.stringify(result.state);
        if (seen.has(key) || seen.size >= searchLimits.states) return [];
        seen.add(key);
        return [{ state: result.state, steps: path }];
      }),
    );
  Array.from({ length: searchLimits.depth }).reduce<ReadonlyArray<Visit<State>>>(
    (frontier) => level(frontier),
    [{ state: machine.initial, steps: [] }],
  );
  return found;
};

export type SpecimenConfig<State extends Tagged, Message extends Tagged, R> = Readonly<{
  id: string;
  label: string;
  summary: string;
  livePath?: string;
  machineName: string;
  examplesName: string;
  machine: Machine.Machine<State, Message, R>;
  message: Schema.Codec<Message, unknown>;
  errorStates?: ReadonlyArray<string>;
  transientStates?: ReadonlyArray<string>;
  /** Named messages the coverage search combines; name them as a test would. */
  examples: Readonly<Record<string, Message>>;
  /** The recording the page opens with. */
  sample: ReadonlyArray<Message>;
}>;

/** A machine, its message schema and its examples, erased to a specimen. */
export const defineSpecimen = <State extends Tagged, Message extends Tagged, R>(
  config: SpecimenConfig<State, Message, R>,
): Specimen => {
  const { machine } = config;
  const json = Schema.fromJsonString(config.message);
  const encode = Schema.encodeSync(json);
  const decode = Schema.decodeUnknownOption(json);
  const edges = machine.edges.map(
    (edge): SpecimenEdge => ({
      id: edgeId(edge),
      from: edge.from,
      messageTag: edge.messageTag,
      target: edge.target,
      guard: guardOf(edge.guard),
      guardPosition: edge.guard._tag === 'Unguarded' ? undefined : edge.guard.position,
    }),
  );
  const found = explore(machine, config.examples);
  const livePath = Option.fromNullishOr(config.livePath);
  const coverage = edges.flatMap(
    (edge): ReadonlyArray<CoveragePath> =>
      Option.match(Option.fromNullishOr(found.get(tripleOf(edge))), {
        onNone: () => [],
        onSome: (steps) => [{ edgeId: edge.id, steps }],
      }),
  );
  const replay = (events: ReadonlyArray<string>): ReadonlyArray<Frame> =>
    events.reduce<Readonly<{ state: State; frames: ReadonlyArray<Frame> }>>(
      ({ state, frames }, event) => {
        const sequence = frames.length + 1;
        return Option.match(decode(event), {
          onNone: () => ({
            state,
            frames: [
              ...frames,
              {
                stateTag: state._tag,
                record: {
                  sequence,
                  messageTag: 'Undecodable',
                  outcome: 'ignored' as const,
                  from: state._tag,
                  reason: 'Undecodable',
                  commandNames: [],
                },
              },
            ],
          }),
          onSome: (message) => {
            const result = machine.step(state, message);
            const record: TransitionFact =
              result._tag === 'Transitioned'
                ? {
                    sequence,
                    messageTag: message._tag,
                    outcome: 'transitioned',
                    from: result.from,
                    target: result.target,
                    commandNames: result.commands.map((command) => command.name),
                  }
                : {
                    sequence,
                    messageTag: message._tag,
                    outcome: 'ignored',
                    from: result.stateTag,
                    reason: result.reason,
                    commandNames: [],
                  };
            return {
              state: result.state,
              frames: [...frames, { record, stateTag: result.state._tag }],
            };
          },
        });
      },
      { state: machine.initial, frames: [] },
    ).frames;
  return {
    id: config.id,
    label: config.label,
    summary: config.summary,
    livePath,
    machineName: config.machineName,
    examplesName: config.examplesName,
    initialTag: machine.initial._tag,
    stateTags: machine.stateTags,
    errorStates: config.errorStates ?? [],
    transientStates: config.transientStates ?? [],
    edges,
    unreachable: machine.unreachableStates(),
    dead: machine.deadTransitions().map(({ edge, reason }) => ({
      edgeId: edgeId(edge),
      reason,
    })),
    sample: config.sample.map((message) => encode(message)),
    replay,
    coverage,
    accepts: (event) => Option.isSome(decode(event)),
  };
};

/** A Vitest case that walks an edge's coverage path and checks the edge fires. */
export const testFor = (specimen: Specimen, edge: SpecimenEdge, path: CoveragePath): string =>
  [
    `it('${edge.from} → ${edge.target} on ${edge.messageTag}', () => {`,
    `  const result = lastStep(${specimen.machineName}, [`,
    ...path.steps.map((step) => `    ${specimen.examplesName}.${step},`),
    '  ]);',
    `  expect(result).toMatchObject({ _tag: 'Transitioned', from: '${edge.from}', target: '${edge.target}' });`,
    '});',
  ].join('\n');
