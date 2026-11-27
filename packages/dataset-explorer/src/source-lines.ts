import { Effect, Option, Stream } from 'effect';
import { Dom, Subscription } from 'foldkit';
import type { Command } from 'foldkit';
import type { Return } from 'foldkit/update';

import { parseSourceLine, sourceLineId } from './source-line-core';
import type { SourceLine } from './source-line-core';

export * from './source-line-core';

export function sourceLineSubscriptions<Model, Message>(toMessage: (line: SourceLine) => Message) {
  // The browser event stream is acquired lazily by the subscription runtime.
  // oxlint-disable-next-line linteffect/no-effect-wrapper-alias
  const locations = Stream.suspend(() =>
    Stream.concat(
      Stream.fromEffect(Effect.sync(() => window.location.hash)),
      Dom.streamFromEvent({
        target: window,
        type: 'hashchange',
        mapEvent: () => window.location.hash,
      }),
    ),
  ).pipe(
    Stream.flatMap((hash) =>
      Option.match(parseSourceLine(hash), {
        onNone: () => Stream.empty,
        onSome: Stream.make,
      }),
    ),
    Stream.map(toMessage),
  );
  return Subscription.make<Model, Message>()(() => ({
    sourceLine: Subscription.persistentEntry(locations),
  }));
}

export function focusSourceLine({ name, line }: SourceLine) {
  const selector = `[id="${CSS.escape(sourceLineId(name, line))}"]`;
  return Dom.scrollIntoViewAfterPaint(selector, { block: 'start' }).pipe(
    Effect.andThen(Dom.focus(selector, { preventScroll: true })),
    // Focusing is best effort: the line may not be rendered yet.
    Effect.catchTag('ElementNotFound', () => Effect.void),
  );
}

export function navigateSourceLine<Model extends { readonly activeFile: string }, Message>(
  model: Model,
  location: SourceLine,
  names: ReadonlyArray<Model['activeFile']>,
  source: (model: Model) => string,
  focus: (line: SourceLine) => Command.Command<Message>,
  reveal: (next: Model) => Model = (next) => next,
): Return<Model, Message> {
  return Option.fromNullishOr(names.find((name) => name === location.name)).pipe(
    Option.map((name) => ({ ...model, activeFile: name })),
    Option.filter(
      (next) =>
        Number.isSafeInteger(location.line) &&
        location.line > 0 &&
        location.line <= source(next).split('\n').length,
    ),
    Option.match({
      onNone: () => ({ model }),
      onSome: (next) => ({ model: reveal(next), commands: [focus(location)] }),
    }),
  );
}
