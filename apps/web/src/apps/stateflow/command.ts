import { Command } from '@effect/ui';
import { highlightSource } from '@opsydyn/dataset-explorer/source-ui';
import { Effect, Schema } from 'effect';

import { Message } from './message';
import { TransitionRecorded, transitionTelemetryName } from './ports';
import { linkFor, SharedSession } from './share';

export const ReportTransition = Command.make(
  'ReportTransition',
  { args: { record: TransitionRecorded } },
  ({ record }) =>
    Effect.sync(() => {
      globalThis.window?.dispatchEvent(
        new CustomEvent(transitionTelemetryName, { detail: record }),
      );
      return Message.CompletedReportTransition({ sequence: record.sequence });
    }),
);

export const HighlightSource = Command.make(
  'HighlightSource',
  { args: { source: Schema.String, language: Schema.String } },
  ({ source, language }) =>
    highlightSource(source, language).pipe(
      Effect.map((highlightedSource) => Message.SettledHighlightedSource({ highlightedSource })),
    ),
);

/** The session in a link: the address bar shows it, and the clipboard has it if allowed. */
export const CopySessionLink = Command.make(
  'CopySessionLink',
  { args: { session: SharedSession } },
  ({ session }) =>
    Effect.suspend(() => {
      const link = linkFor(globalThis.location.href, session);
      globalThis.history.replaceState(globalThis.history.state, '', link);
      return Effect.tryPromise(() => globalThis.navigator.clipboard.writeText(link));
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedCopy({ what: 'link', copied: true }),
        onFailure: () => Message.CompletedCopy({ what: 'link', copied: false }),
      }),
    ),
);

/** A generated test case to the clipboard. */
export const CopyTest = Command.make('CopyTest', { args: { text: Schema.String } }, ({ text }) =>
  Effect.tryPromise(() => globalThis.navigator.clipboard.writeText(text)).pipe(
    Effect.match({
      onSuccess: () => Message.CompletedCopy({ what: 'test', copied: true }),
      onFailure: () => Message.CompletedCopy({ what: 'test', copied: false }),
    }),
  ),
);
