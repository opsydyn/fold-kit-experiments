import { Command } from '@effect/ui';
import { Effect, Schema } from 'effect';

import { Request } from './data';
import { Message } from './message';
import { execute, DatasetQuery } from './query';
import { SourceLine } from './source-line-core';
import { focusSourceLine, highlightSource } from './source-ui';

export const FetchDatasetSnapshot = Command.make(
  'FetchDatasetSnapshot',
  { args: { args: Request, generation: Schema.Number } },
  ({ args, generation }) =>
    execute(args).pipe(
      Effect.result,
      Effect.map((result) =>
        Message.GotDatasetMessage({
          message: DatasetQuery.Message.CompletedFetch({ args, generation, result }),
        }),
      ),
    ),
);

export const HighlightSource = Command.make(
  'HighlightSource',
  { args: { source: Schema.String, language: Schema.String } },
  ({ source, language }) =>
    highlightSource(source, language).pipe(
      Effect.map((highlightedSource) => Message.SettledHighlightedSource({ highlightedSource })),
    ),
);

export const FocusSourceLine = Command.make(
  'FocusSourceLine',
  { args: SourceLine.fields },
  (location) =>
    focusSourceLine(location).pipe(Effect.map(() => Message.CompletedSourceLineFocus())),
);
