import { SourceHighlighter, highlightedTree } from '@opsydyn/dataset-explorer/highlighting';
import { Effect, Schema } from 'effect';
import { Command, Port } from 'foldkit';

import { Message } from './message';
import { TransitionRecorded, TransitionTelemetryPort } from './ports';

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
