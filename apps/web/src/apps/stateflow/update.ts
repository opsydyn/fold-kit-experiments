import type { Command } from '@effect/ui';
import { settleHighlighting, sourceMatches } from '@opsydyn/dataset-explorer/highlighting-core';
import { Match, Option, Schema, Struct } from 'effect';

import { CopySessionLink, CopyTest, HighlightSource, ReportTransition } from './command';
import { Message } from './message';
import type { Model } from './model';
import { ReplayEvent } from './ports';
import { framesOf, specimenFor } from './replay';
import type { SharedSession } from './share';
import { selectedEventSource } from './source';
import { testFor } from './specimen';
import { specimenOf, specimens } from './specimens';
import { diagnosticsSpecimen } from './specimens/diagnostics';

interface Return {
  readonly model: Model;
  readonly commands?: ReadonlyArray<Command.Command<Message>>;
}

const encodeReplayEvent = Schema.encodeSync(Schema.fromJsonString(ReplayEvent));

const paused = (model: Model): Model => ({ ...model, playback: 'paused' });

/** The scrubber at `cursor`, the event there selected for the inspector. */
const moveTo = (model: Model, cursor: number): Model => {
  const at = Math.max(0, Math.min(model.events.length, Math.round(cursor)));
  return {
    ...model,
    cursor: at,
    selectedSequence: at > 0 ? at : null,
    selectedEdge: null,
  };
};

/** One event on: the machine's step reported on the outbound telemetry Port. */
const stepForward = (model: Model): Return => {
  const moved = moveTo(model, model.cursor + 1);
  const atEnd = moved.cursor >= moved.events.length;
  const next: Model = { ...moved, playback: atEnd ? 'paused' : moved.playback };
  return Option.match(Option.fromNullishOr(framesOf(next)[next.cursor - 1]), {
    onNone: () => ({ model: paused(next) }),
    onSome: ({ record }) =>
      moved.cursor === model.cursor
        ? { model: next }
        : { model: next, commands: [ReportTransition.make({ record })] },
  });
};

const REPLAY_INTERVAL_MS = 400;

function advancePlayback(model: Model, deltaTimeMs: number): Return {
  const elapsed = model.replayElapsedMs + deltaTimeMs;
  const valid = [Number.isFinite(deltaTimeMs), deltaTimeMs >= 0].every(Boolean);
  return Match.value({
    playing: model.playback === 'playing',
    valid,
    ready: elapsed >= REPLAY_INTERVAL_MS,
  }).pipe(
    Match.when({ playing: true, valid: true, ready: true }, () =>
      // Consume at most one event and discard delayed-frame backlog.
      stepForward(Struct.evolve(model, { replayElapsedMs: () => 0 })),
    ),
    Match.when({ playing: true, valid: true }, () => ({
      model: Struct.evolve(model, { replayElapsedMs: () => elapsed }),
    })),
    Match.orElse(() => ({ model })),
  );
}

/** Another specimen, opened on its sample. */
const openSpecimen = (model: Model, specimen: string): Model => ({
  ...model,
  specimen: specimenOf(specimen).id,
  events: specimenOf(specimen).sample,
  source: 'sample',
  cursor: 0,
  playback: 'paused',
  replayElapsedMs: 0,
  selectedSequence: null,
  selectedNode: null,
  selectedEdge: null,
});

/**
 * A received event: it starts a fresh recording over a sample or a link, or for another
 * specimen, and extends one already running. A scrubber at the end follows it, replaying
 * the event and reporting the step; one held earlier stays where it is.
 */
const receive = (model: Model, specimen: string, event: string): Return => {
  const fresh = model.source !== 'recording' || model.specimen !== specimen;
  const recording: Model = fresh
    ? {
        ...model,
        specimen,
        events: [event],
        source: 'recording',
        cursor: 0,
        playback: 'paused',
        selectedNode: model.specimen === specimen ? model.selectedNode : null,
      }
    : { ...model, events: [...model.events, event] };
  const following = fresh || model.cursor >= model.events.length;
  return following ? stepForward(recording) : { model: recording };
};

/** The page opened on a shared session, when its link carried one. */
export const withSession = (model: Model, session: SharedSession | null): Model =>
  Option.match(Option.fromNullishOr(session), {
    onNone: () => model,
    onSome: ({ specimen, events, at }) =>
      moveTo({ ...openSpecimen(model, specimen), events, source: 'link' }, at),
  });

/** A live event, taken while listening when its machine can decode it. */
const receiveLive = (model: Model, specimen: string, event: string): Return =>
  Option.match(
    Option.fromNullishOr(specimens.find((candidate) => candidate.id === specimen)).pipe(
      Option.filter((candidate) => model.live && candidate.accepts(event)),
    ),
    {
      onNone: () => ({ model }),
      onSome: (candidate) => receive(model, candidate.id, event),
    },
  );

/** An edge's generated test, to the clipboard, when the coverage search found a path. */
const copyTest = (model: Model, edgeId: string): Return => {
  const specimen = specimenFor(model);
  const test = Option.all({
    edge: Option.fromNullishOr(specimen.edges.find((edge) => edge.id === edgeId)),
    path: Option.fromNullishOr(specimen.coverage.find((path) => path.edgeId === edgeId)),
  }).pipe(Option.map(({ edge, path }) => testFor(specimen, edge, path)));
  return Option.match(test, {
    onNone: () => ({ model }),
    onSome: (text) => ({ model: { ...model, notice: null }, commands: [CopyTest.make({ text })] }),
  });
};

const copyNotices = {
  link: { true: 'Link copied: it replays this session.', false: 'The address bar has the link.' },
  test: {
    true: 'Test copied: paste it into the machine’s test file.',
    false: 'Couldn’t copy the test.',
  },
} as const;

export function update(model: Model, message: Message): Return {
  const result: Return = Message.match(message, {
    SettledHighlightedSource: ({ highlightedSource }) => ({
      model: settleHighlighting(model, highlightedSource, selectedEventSource(model), 'json'),
    }),
    // Play from the start once the session has played through.
    ClickedPlay: () => {
      const start = model.cursor >= model.events.length ? moveTo(model, 0) : model;
      const playback: Model['playback'] = start.events.length > 0 ? 'playing' : 'paused';
      return { model: { ...start, playback, replayElapsedMs: 0 } };
    },
    ClickedPause: () => ({ model: paused(model) }),
    ClickedStep: () => stepForward(paused(model)),
    ClickedStepBack: () => ({
      model: paused(moveTo(model, model.cursor - 1)),
    }),
    ClickedReset: () => ({ model: paused(moveTo(model, 0)) }),
    ClickedEnd: () => ({ model: paused(moveTo(model, model.events.length)) }),
    ScrubbedTo: ({ cursor }) => ({ model: paused(moveTo(model, cursor)) }),
    ChoseSpecimen: ({ specimen }) => ({ model: openSpecimen(model, specimen) }),
    ChoseLayout: ({ layout }) => ({ model: { ...model, layout } }),
    ClickedLive: () => ({ model: { ...model, live: !model.live } }),
    ClickedClearRecording: () => ({
      model: paused(moveTo({ ...model, events: [], source: 'recording' }, 0)),
    }),
    ReceivedLiveEvent: ({ specimen, event }) => receiveLive(model, specimen, event),
    ClickedCopyLink: () => ({
      model: { ...model, notice: null },
      commands: [
        CopySessionLink.make({
          session: { specimen: model.specimen, events: model.events, at: model.cursor },
        }),
      ],
    }),
    ClickedCopyTest: ({ edge }) => copyTest(model, edge),
    CompletedCopy: ({ what, copied }) => ({
      model: { ...model, notice: copyNotices[what][copied ? 'true' : 'false'] },
    }),
    ChangedReducedMotion: ({ isReducedMotion }) => ({
      model: { ...model, reducedMotion: isReducedMotion },
    }),
    ChangedNarrow: ({ isNarrow }) => ({ model: { ...model, narrow: isNarrow } }),
    AdvancedReplay: ({ deltaTimeMs }) => advancePlayback(model, deltaTimeMs),
    SelectedTrace: ({ sequence }) => ({
      model: { ...model, selectedSequence: sequence, selectedEdge: null },
    }),
    SelectedNode: ({ node }) => ({ model: { ...model, selectedNode: node, selectedEdge: null } }),
    SelectedEdge: ({ edge }) => ({
      model: { ...model, selectedEdge: edge, selectedSequence: null },
    }),
    ReceivedReplayEvent: ({ event }) =>
      receive(model, diagnosticsSpecimen.id, encodeReplayEvent(event)),
    CompletedReportTransition: ({ sequence }) => ({
      model: { ...model, lastTelemetrySequence: sequence },
    }),
  });
  const current = result.model;
  const source = selectedEventSource(current);
  const language = 'json';
  if (
    source.length === 0 ||
    sourceMatches(current.requestedSource, source, language) ||
    sourceMatches(current.highlightedSource, source, language)
  )
    return result;
  const requestedSource = { source, language };
  return {
    model: { ...current, requestedSource },
    commands: [...(result.commands ?? []), HighlightSource.make(requestedSource)],
  };
}
