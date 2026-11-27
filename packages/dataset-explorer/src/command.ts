import { Command } from '@effect/ui';
import { Effect, Result, Schema } from 'effect';

import { Request } from './data';
import { highlightedTree, loadHighlighter } from './highlighting-core';
import { Message } from './message';
import { execute, DatasetQuery } from './query';
import { SourceLine, sourceLineId } from './source-line-core';

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

const load = Effect.tryPromise({ try: loadHighlighter, catch: () => 'Highlighting unavailable' });
const cached = Effect.cached(load);
// Initialise the cache cell. I/O only starts when a browser command reads it.
// oxlint-disable-next-line linteffect/no-run-effect-outside-boundary
const highlighter = Effect.runSync(cached);

export const HighlightSource = Command.make(
  'HighlightSource',
  { args: { source: Schema.String, language: Schema.String } },
  ({ source, language }) =>
    highlighter.pipe(
      Effect.result,
      Effect.map((loaded) =>
        Message.SettledHighlightedSource({
          highlightedSource: {
            source,
            language,
            tree: highlightedTree(
              source,
              language,
              Result.isSuccess(loaded) ? loaded.success : undefined,
            ),
          },
        }),
      ),
    ),
);

export const FocusSourceLine = Command.make(
  'FocusSourceLine',
  { args: SourceLine.fields },
  ({ name, line }) =>
    Effect.callback<Message>((resume) => {
      const frame = requestAnimationFrame(() => {
        const element = document.getElementById(sourceLineId(name, line));
        element?.scrollIntoView({ block: 'start' });
        element?.focus({ preventScroll: true });
        resume(Effect.succeed(Message.CompletedSourceLineFocus()));
      });
      return Effect.sync(() => cancelAnimationFrame(frame));
    }),
);
