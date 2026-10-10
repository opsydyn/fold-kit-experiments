import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { SourceHighlighter, highlightedTree } from './highlighting';
import { Message } from './message';

export const HighlightSource = Command.define('HighlightSource', {
  args: { source: Schema.String, language: Schema.String },
  messages: [Message.SettledHighlightedSource],
  execute: ({ source, language }) =>
    SourceHighlighter.get.pipe(
      Effect.map((engine) =>
        Message.SettledHighlightedSource({
          highlightedSource: { source, language, tree: highlightedTree(source, language, engine) },
        }),
      ),
      Effect.catch(() =>
        Effect.succeed(
          Message.SettledHighlightedSource({
            highlightedSource: { source, language, tree: highlightedTree(source, language) },
          }),
        ),
      ),
    ),
});
