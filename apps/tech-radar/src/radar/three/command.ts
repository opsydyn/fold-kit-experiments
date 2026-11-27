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
import { Typeface, typefaceFrom, typefaceStorage } from './typefaces';

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

/** The typeface the reader picked last, here or on a full page; the default if none. */
export const LoadTypeface = Command.make('LoadTypeface', { args: {} }, () =>
  Effect.try(() => globalThis.localStorage.getItem(typefaceStorage.key)).pipe(
    Effect.orElseSucceed(() => null),
    Effect.map((stored) => Message.SucceededLoadTypeface({ typeface: typefaceFrom(stored) })),
  ),
);

/**
 * Keeps a picked typeface for every page, and marks the document with it: what the radar
 * portals to <body> (tooltips, the search list) takes its type from there.
 */
export const SaveTypeface = Command.make(
  'SaveTypeface',
  { args: { typeface: Typeface } },
  ({ typeface }) =>
    Effect.try(() => {
      globalThis.document.documentElement.dataset['typeface'] = typeface;
      globalThis.localStorage.setItem(typefaceStorage.key, typeface);
    }).pipe(
      Effect.orElseSucceed(() => undefined),
      Effect.map(() => Message.CompletedSaveTypeface()),
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
/** Where the current edition the reader last saw is kept, by its date. */
export const visitStorage = { key: 'radar-last-visit' } as const;

/** The edition the reader last saw, or null on a first visit or without storage. */
export const LoadLastVisit = Command.make('LoadLastVisit', { args: {} }, () =>
  Effect.try(() => globalThis.localStorage.getItem(visitStorage.key)).pipe(
    Effect.orElseSucceed(() => null),
    Effect.map((edition) => Message.SucceededLoadLastVisit({ edition })),
  ),
);

/** Remembers the current edition as seen; a refusal is quietly forgotten. */
export const SaveLastVisit = Command.make(
  'SaveLastVisit',
  { args: { edition: Schema.String } },
  ({ edition }) =>
    Effect.try(() => globalThis.localStorage.setItem(visitStorage.key, edition)).pipe(
      Effect.match({
        onFailure: () => Message.CompletedSaveLastVisit(),
        onSuccess: () => Message.CompletedSaveLastVisit(),
      }),
    ),
);

/**
 * Asks the browser to fill the screen with the page, for the immersive radar. Phones that
 * cannot (Safari on iPhone fills the screen only for video) keep the page filling the
 * window instead, so a refusal changes nothing.
 */
export const EnterFullscreen = Command.make('EnterFullscreen', { args: {} }, () =>
  Effect.tryPromise(() => globalThis.document.documentElement.requestFullscreen()).pipe(
    Effect.match({
      onFailure: () => Message.CompletedFullscreen(),
      onSuccess: () => Message.CompletedFullscreen(),
    }),
  ),
);

/** Gives the screen back, if the page has it. */
export const ExitFullscreen = Command.make('ExitFullscreen', { args: {} }, () =>
  Effect.tryPromise(() =>
    globalThis.document.fullscreenElement === null
      ? Promise.resolve()
      : globalThis.document.exitFullscreen(),
  ).pipe(
    Effect.match({
      onFailure: () => Message.CompletedFullscreen(),
      onSuccess: () => Message.CompletedFullscreen(),
    }),
  ),
);

/** Puts the cursor in the search box: the `/` shortcut. */
export const FocusSearch = Command.make('FocusSearch', { args: {} }, () =>
  Effect.sync(() => {
    globalThis.document.querySelector<HTMLInputElement>('.e3-search-input')?.focus();
    return Message.CompletedFocusSearch();
  }),
);

/** Brings a keyboard-highlighted search result into view without moving focus. */
export const ScrollSearch = Command.make(
  'ScrollSearch',
  { args: { id: Schema.String } },
  ({ id }) =>
    Effect.sync(() => {
      document
        .getElementById(`radar-option-${id}`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return Message.CompletedScrollSearch();
    }),
);

/** Goes to an entry's full page: the `O` shortcut. */
export const OpenPage = Command.make('OpenPage', { args: { href: Schema.String } }, ({ href }) =>
  Effect.sync(() => {
    globalThis.location.assign(href);
    return Message.CompletedOpenPage();
  }),
);

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
