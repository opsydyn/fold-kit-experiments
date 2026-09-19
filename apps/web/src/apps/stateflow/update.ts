import { Match, Option, Struct } from 'effect';

import { diagnosticsMachine } from '../request-diagnostics/machine';
import { ReportTransition } from './command';
import { fixture } from './fixture';
import { Message } from './message';
import type { ReceivedReplayEvent } from './message';
import { initModel } from './model';
import type { Model, TransitionFact } from './model';
import type { ReplayEvent } from './ports';

type Return = import('foldkit/update').Return<Model, Message>;

const recordFor = (
  model: Model,
  event: ReplayEvent,
  result: ReturnType<typeof diagnosticsMachine.step>,
): TransitionFact =>
  Match.value(result).pipe(
    Match.tag(
      'Transitioned',
      (next) =>
        ({
          sequence: model.trace.length + 1,
          messageTag: event._tag,
          outcome: 'transitioned',
          from: next.from,
          target: next.target,
          commandNames: next.commands.map((command) => command.name),
        }) satisfies TransitionFact,
    ),
    Match.tag(
      'Ignored',
      (next) =>
        ({
          sequence: model.trace.length + 1,
          messageTag: event._tag,
          outcome: 'ignored',
          from: next.stateTag,
          reason: next.reason,
          commandNames: [],
        }) satisfies TransitionFact,
    ),
    Match.exhaustive,
  );

const runReplayEvent = (model: Model, event: ReplayEvent): Return => {
  const result = diagnosticsMachine.step(model.explorer, event);
  const record = recordFor(model, event, result);
  const playback = Match.value(model.replayIndex + 1 >= fixture.length).pipe(
    Match.when(true, () => 'paused' as const),
    Match.orElse(() => model.playback),
  );
  return {
    model: {
      ...model,
      explorer: result.state,
      replayIndex: model.replayIndex + 1,
      playback,
      trace: [...model.trace, record],
      selectedSequence: record.sequence,
      selectedEdge: null,
    },
    commands: [ReportTransition({ record })],
  };
};

const advanceFixture = (model: Model): Return =>
  Option.match(Option.fromNullishOr(fixture[model.replayIndex]), {
    onSome: (event) => runReplayEvent(model, event),
    onNone: () => ({ model: { ...model, playback: 'paused' } }),
  });

const stepReplay = (model: Model): Return =>
  Match.value(model.playback).pipe(
    Match.when('paused', () => advanceFixture(Struct.evolve(model, { replayElapsedMs: () => 0 }))),
    Match.orElse(() => ({ model })),
  );

const REPLAY_INTERVAL_MS = 200;

function advancePlayback(model: Model, deltaTimeMs: number): Return {
  const elapsed = model.replayElapsedMs + deltaTimeMs;
  const playing = Match.value(model.playback).pipe(
    Match.when('playing', () => true),
    Match.orElse(() => false),
  );
  const valid = [Number.isFinite(deltaTimeMs), deltaTimeMs >= 0].every(Boolean);
  return Match.value({ playing, valid, ready: elapsed >= REPLAY_INTERVAL_MS }).pipe(
    Match.when({ playing: true, valid: true, ready: true }, () =>
      // Consume at most one event and discard delayed-frame backlog.
      advanceFixture(Struct.evolve(model, { replayElapsedMs: () => 0 })),
    ),
    Match.when({ playing: true, valid: true }, () => ({
      model: Struct.evolve(model, { replayElapsedMs: () => elapsed }),
    })),
    Match.orElse(() => ({ model })),
  );
}

export function update(model: Model, message: Message): Return {
  const availablePlayback = Match.value(model.replayIndex < fixture.length).pipe(
    Match.when(true, () => 'playing' as const),
    Match.orElse(() => 'paused' as const),
  );
  return Message.match(message, {
    ClickedPlay: () => ({
      model: { ...model, playback: availablePlayback },
    }),
    ClickedPause: () => ({ model: { ...model, playback: 'paused' } }),
    ClickedStep: () => stepReplay(model),
    ClickedReset: () => ({ model: initModel }),
    AdvancedReplay: ({ deltaTimeMs }) => advancePlayback(model, deltaTimeMs),
    SelectedTrace: ({ sequence }) => ({
      model: { ...model, selectedSequence: sequence, selectedEdge: null },
    }),
    SelectedNode: ({ node }) => ({ model: { ...model, selectedNode: node, selectedEdge: null } }),
    SelectedEdge: ({ edge }) => ({
      model: { ...model, selectedEdge: edge, selectedSequence: null },
    }),
    ReceivedReplayEvent: ({ event: rawEvent }) => {
      // SAFETY: ReplayEventPort decodes this value before it reaches the app subscription.
      const event = rawEvent as ReceivedReplayEvent['event'];
      return runReplayEvent(model, event);
    },
    CompletedReportTransition: ({ sequence }) => ({
      model: { ...model, lastTelemetrySequence: sequence },
    }),
  });
}
