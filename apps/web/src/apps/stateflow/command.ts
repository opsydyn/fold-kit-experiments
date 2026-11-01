import { SourceHighlighter, highlightedTree } from '@opsydyn/dataset-explorer/highlighting';
import { Effect, Schema } from 'effect';
import { Command, Port } from 'foldkit';

import { Message } from './message';
import { TransitionRecorded, TransitionTelemetryPort } from './ports';
import { linkFor, SharedSession } from './share';

export const ReportTransition = Command.define('ReportTransition', {
  args: { record: TransitionRecorded },
  messages: [Message.CompletedReportTransition],
  execute: ({ record }) =>
    Port.emit(TransitionTelemetryPort, record).pipe(
      Effect.map(() => Message.CompletedReportTransition({ sequence: record.sequence })),
    ),
});

export const HighlightSource = Command.define('HighlightSource', {
  args: { source: Schema.String, language: Schema.String },
  messages: [Message.SettledHighlightedSource],
  execute: ({ source, language }) =>
    SourceHighlighter.get.pipe(
      Effect.match({
        onSuccess: (engine) =>
          Message.SettledHighlightedSource({
            highlightedSource: {
              source,
              language,
              tree: highlightedTree(source, language, engine),
            },
          }),
        onFailure: () =>
          Message.SettledHighlightedSource({
            highlightedSource: { source, language, tree: highlightedTree(source, language) },
          }),
      }),
    ),
});

/** The session in a link: the address bar shows it, and the clipboard has it if allowed. */
export const CopySessionLink = Command.define('CopySessionLink', {
  args: { session: SharedSession },
  messages: [Message.CompletedCopy],
  execute: ({ session }) =>
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
});

/** A generated test case to the clipboard. */
export const CopyTest = Command.define('CopyTest', {
  args: { text: Schema.String },
  messages: [Message.CompletedCopy],
  execute: ({ text }) =>
    Effect.tryPromise(() => globalThis.navigator.clipboard.writeText(text)).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedCopy({ what: 'test', copied: true }),
        onFailure: () => Message.CompletedCopy({ what: 'test', copied: false }),
      }),
    ),
});
