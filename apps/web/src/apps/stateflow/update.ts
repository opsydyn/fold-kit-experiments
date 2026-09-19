import { diagnosticsMachine } from '../request-diagnostics/machine';
import { ReportTransition } from './command';
import { fixture } from './fixture';
import { Message } from './message';
import type { ReceivedReplayEvent } from './message';
import { initModel } from './model';
import type { Model, TransitionFact } from './model';
import type { ReplayEvent } from './ports';

type Return = import('foldkit/update').Return<Model, Message>;

const commandNamesFor = (
  result: ReturnType<typeof diagnosticsMachine.step>,
): ReadonlyArray<string> =>
  result._tag === 'Transitioned' ? result.commands.map((command) => command.name) : [];

const recordFor = (
  model: Model,
  event: ReplayEvent,
  result: ReturnType<typeof diagnosticsMachine.step>,
): TransitionFact => {
  const sequence = model.trace.length + 1;
  if (result._tag === 'Transitioned') {
    return {
      sequence,
      messageTag: event._tag,
      outcome: 'transitioned',
      from: result.from,
      target: result.target,
      commandNames: commandNamesFor(result),
    };
  }
  return {
    sequence,
    messageTag: event._tag,
    outcome: 'ignored',
    from: result.stateTag,
    reason: result.reason,
    commandNames: [],
  };
};

const runReplayEvent = (model: Model, event: ReplayEvent): Return => {
  const result = diagnosticsMachine.step(model.explorer, event);
  const record = recordFor(model, event, result);
  return {
    model: {
      ...model,
      explorer: result.state,
      replayIndex: model.replayIndex + 1,
      trace: [...model.trace, record],
      selectedSequence: record.sequence,
    },
    commands: [ReportTransition({ record })],
  };
};

const advanceFixture = (model: Model): Return => {
  const event = fixture[model.replayIndex];
  return event ? runReplayEvent(model, event) : { model: { ...model, playback: 'paused' } };
};

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    ClickedPlay: () => ({ model: { ...model, playback: 'playing' } }),
    ClickedPause: () => ({ model: { ...model, playback: 'paused' } }),
    ClickedStep: () => (model.playback === 'paused' ? advanceFixture(model) : { model }),
    ClickedReset: () => ({ model: initModel }),
    AdvancedReplay: () => (model.playback === 'playing' ? advanceFixture(model) : { model }),
    SelectedTrace: ({ sequence }) => ({ model: { ...model, selectedSequence: sequence } }),
    SelectedNode: ({ node }) => ({ model: { ...model, selectedNode: node } }),
    ReceivedReplayEvent: ({ event: rawEvent }) => {
      // SAFETY: ReplayEventPort decodes this value before it reaches the app subscription.
      const event = rawEvent as ReceivedReplayEvent['event'];
      return runReplayEvent(model, event);
    },
    CompletedReportTransition: ({ sequence }) => ({
      model: { ...model, lastTelemetrySequence: sequence },
    }),
  });
