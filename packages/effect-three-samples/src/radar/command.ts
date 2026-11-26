/**
 * The radar's Commands: remembering the reader's theme in this browser. Storage can be
 * missing or refuse (a private window, blocked site data), so a load that fails, or finds
 * nothing it recognises, is Auto, and a save that fails is quietly forgotten.
 */
import { Command } from '@effect/ui';
import { HtmlFiles } from '@effect/ui/html';
import { Effect, Option, Schema } from 'effect';

import { Message } from './message';
import { Theme, ThemeChoice } from './themes';
import { isRecordable } from './tour';
import { Recording } from './tour-schema';

/** Where the choice is kept: Auto is kept as nothing at all. */
export const themeStorage = { key: 'radar-theme' } as const;

/** A stored value as a choice, or Auto if it is missing or not one. */
export const choiceFrom = (stored: string | null): ThemeChoice =>
  Option.getOrElse(Schema.decodeUnknownOption(ThemeChoice)(stored), (): ThemeChoice => 'auto');

export const LoadThemeChoice = Command.make('LoadThemeChoice', { args: {} }, () =>
  Effect.try(() => globalThis.localStorage.getItem(themeStorage.key)).pipe(
    Effect.orElseSucceed(() => null),
    Effect.map((stored) => Message.SucceededLoadThemeChoice({ choice: choiceFrom(stored) })),
  ),
);

/** Keeps a picked theme; forgets the choice when Auto is picked. */
const store = (choice: ThemeChoice): void =>
  Option.match(Schema.decodeUnknownOption(Theme)(choice), {
    onNone: () => globalThis.localStorage.removeItem(themeStorage.key),
    onSome: (picked) => globalThis.localStorage.setItem(themeStorage.key, picked),
  });

export const SaveThemeChoice = Command.make(
  'SaveThemeChoice',
  { args: { choice: ThemeChoice } },
  ({ choice }) =>
    Effect.try(() => store(choice)).pipe(
      Effect.orElseSucceed(() => undefined),
      Effect.map(() => Message.CompletedSaveThemeChoice()),
    ),
);

/** The address bar, rewritten to the view's link, without adding a history entry. */
export const ReplaceLink = Command.make(
  'ReplaceLink',
  { args: { query: Schema.String } },
  ({ query }) =>
    Effect.sync(() => {
      globalThis.history.replaceState(globalThis.history.state, '', addressFor(query));
      return Message.CompletedReplaceLink();
    }),
);

/** This page's address with `query` as its query string; none when the link is empty. */
const addressFor = (query: string): string =>
  `${globalThis.location.pathname}${Option.match(
    Option.liftPredicate(query, (shown) => shown.length > 0),
    { onNone: () => '', onSome: (shown) => `?${shown}` },
  )}${globalThis.location.hash}`;

/** The address on the clipboard; a refusal (no permission, no clipboard) is reported. */
export const CopyLink = Command.make('CopyLink', { args: {} }, () =>
  Effect.tryPromise(() => globalThis.navigator.clipboard.writeText(globalThis.location.href)).pipe(
    Effect.match({
      onSuccess: () => Message.CompletedCopyLink({ outcome: 'copied' }),
      onFailure: () => Message.CompletedCopyLink({ outcome: 'refused' }),
    }),
  ),
);

/** A tour as a file: a version, where it starts (a deep link) and its moves. */
const TourFile = Schema.Struct({
  version: Schema.Literal(1),
  start: Schema.String,
  steps: Schema.Array(Message),
});

/** A tour, saved as a JSON file named for the day it was saved. */
export const SaveTour = Command.make(
  'SaveTour',
  { args: { recording: Recording } },
  ({ recording }) =>
    Effect.try(() => download(recording)).pipe(
      Effect.orElseSucceed(() => undefined),
      Effect.map(() => Message.CompletedSaveTour()),
    ),
);

const download = (recording: Recording): void => {
  const file = new Blob(
    [JSON.stringify({ version: 1, start: recording.start, steps: recording.steps }, null, 2)],
    {
      type: 'application/json',
    },
  );
  const anchor = globalThis.document.createElement('a');
  anchor.href = URL.createObjectURL(file);
  anchor.download = `radar-tour-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};

/**
 * A tour from a file the reader picks. It must be a tour this radar wrote: anything else
 * is refused in words, and moves a tour may not hold are dropped.
 */
export const LoadTour = Command.make('LoadTour', { args: {} }, () =>
  HtmlFiles.Files.use((files) => files.pick({ accept: ['.json', 'application/json'] })).pipe(
    Effect.flatMap(({ files }) => tourFromPick(Option.fromNullishOr(files[0]))),
  ),
);

/** What loading a tour comes to: a tour, a refusal, or nothing picked. */
type LoadedTour = ReturnType<
  | typeof Message.SucceededLoadTour
  | typeof Message.FailedLoadTour
  | typeof Message.CancelledLoadTour
>;

/** A picked file read as a tour; a file that cannot be read is refused. */
const readTour = (file: File) =>
  HtmlFiles.readAsText(file).pipe(
    Effect.map(tourFrom),
    Effect.orElseSucceed(
      (): LoadedTour => Message.FailedLoadTour({ reason: 'That file could not be read' }),
    ),
  );

/** The picked file's tour; nothing picked is a cancel. */
const tourFromPick = (picked: Option.Option<File>) =>
  Option.match(picked, {
    onNone: () => Effect.succeed<LoadedTour>(Message.CancelledLoadTour()),
    onSome: readTour,
  });

/** A tour from a file's text, or why it is not one. */
export const tourFrom = (text: string): LoadedTour =>
  Option.match(
    Option.flatMap(Option.liftThrowable(JSON.parse)(text), Schema.decodeUnknownOption(TourFile)),
    {
      onNone: () => Message.FailedLoadTour({ reason: 'That file is not a radar tour' }),
      onSome: ({ start, steps }) =>
        Message.SucceededLoadTour({ recording: { start, steps: steps.filter(isRecordable) } }),
    },
  );
