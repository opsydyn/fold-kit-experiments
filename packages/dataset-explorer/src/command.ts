import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { SourceHighlighter, highlightedTree } from './highlighting';
import { Message } from './message';
import { SourceLine, focusSourceLine } from './source-lines';

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

export const FocusSourceLine = Command.define('FocusSourceLine', {
  args: SourceLine.fields,
  messages: [Message.CompletedSourceLineFocus],
  execute: (location) =>
    focusSourceLine(location).pipe(Effect.map(() => Message.CompletedSourceLineFocus())),
});
