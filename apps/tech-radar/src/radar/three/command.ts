/**
 * The radar's Commands: remembering the reader's theme in this browser. Storage can be
 * missing or refuse (a private window, blocked site data), so a load that fails, or finds
 * nothing it recognises, is Auto, and a save that fails is quietly forgotten.
 */
import { Effect, Option, Schema } from 'effect';
import { Command, Dom, File, Navigation } from 'foldkit';

import { Message } from './message';
import { Theme, ThemeChoice } from './themes';
import { isRecordable, type Recording } from './tour';
import { Typeface, typefaceFrom, typefaceStorage } from './typefaces';

/** Where the choice is kept: Auto is kept as nothing at all. */
export const themeStorage = { key: 'radar-theme' } as const;

/** A stored value as a choice, or Auto if it is missing or not one. */
export const choiceFrom = (stored: string | null): ThemeChoice =>
  Option.getOrElse(Schema.decodeUnknownOption(ThemeChoice)(stored), (): ThemeChoice => 'auto');

export const LoadThemeChoice = Command.define('LoadThemeChoice', {
  messages: [Message.SucceededLoadThemeChoice],
  execute: Effect.try(() => globalThis.localStorage.getItem(themeStorage.key)).pipe(
    Effect.orElseSucceed(() => null),
    Effect.map((stored) => Message.SucceededLoadThemeChoice({ choice: choiceFrom(stored) })),
  ),
});

/** Keeps a picked theme; forgets the choice when Auto is picked. */
const store = (choice: ThemeChoice): void =>
  Option.match(Schema.decodeUnknownOption(Theme)(choice), {
    onNone: () => globalThis.localStorage.removeItem(themeStorage.key),
    onSome: (picked) => globalThis.localStorage.setItem(themeStorage.key, picked),
  });

export const SaveThemeChoice = Command.define('SaveThemeChoice', {
  args: { choice: ThemeChoice },
  messages: [Message.CompletedSaveThemeChoice],
  execute: ({ choice }) =>
    Effect.try(() => store(choice)).pipe(
      Effect.orElseSucceed(() => undefined),
      Effect.map(() => Message.CompletedSaveThemeChoice()),
    ),
});

/** The typeface the reader picked last, here or on a full page; the default if none. */
export const LoadTypeface = Command.define('LoadTypeface', {
  messages: [Message.SucceededLoadTypeface],
  execute: Effect.try(() => globalThis.localStorage.getItem(typefaceStorage.key)).pipe(
    Effect.orElseSucceed(() => null),
    Effect.map((stored) => Message.SucceededLoadTypeface({ typeface: typefaceFrom(stored) })),
  ),
});

/**
 * Keeps a picked typeface for every page, and marks the document with it: what the radar
 * portals to <body> (tooltips, the search list) takes its type from there.
 */
export const SaveTypeface = Command.define('SaveTypeface', {
  args: { typeface: Typeface },
  messages: [Message.CompletedSaveTypeface],
  execute: ({ typeface }) =>
    Effect.try(() => {
      globalThis.document.documentElement.dataset['typeface'] = typeface;
      globalThis.localStorage.setItem(typefaceStorage.key, typeface);
    }).pipe(
      Effect.orElseSucceed(() => undefined),
      Effect.map(() => Message.CompletedSaveTypeface()),
    ),
});

/** The address bar, rewritten to the view's link, without adding a history entry. */
export const ReplaceLink = Command.define('ReplaceLink', {
  args: { query: Schema.String },
  messages: [Message.CompletedReplaceLink],
  execute: ({ query }) =>
    Navigation.replaceUrl(addressFor(query)).pipe(Effect.map(() => Message.CompletedReplaceLink())),
});

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
export const LoadLastVisit = Command.define('LoadLastVisit', {
  messages: [Message.SucceededLoadLastVisit],
  execute: Effect.try(() => globalThis.localStorage.getItem(visitStorage.key)).pipe(
    Effect.orElseSucceed(() => null),
    Effect.map((edition) => Message.SucceededLoadLastVisit({ edition })),
  ),
});

/** Remembers the current edition as seen; a refusal is quietly forgotten. */
export const SaveLastVisit = Command.define('SaveLastVisit', {
  args: { edition: Schema.String },
  messages: [Message.CompletedSaveLastVisit],
  execute: ({ edition }) =>
    Effect.try(() => globalThis.localStorage.setItem(visitStorage.key, edition)).pipe(
      Effect.match({
        onFailure: () => Message.CompletedSaveLastVisit(),
        onSuccess: () => Message.CompletedSaveLastVisit(),
      }),
    ),
});

/**
 * Asks the browser to fill the screen with the page, for the immersive radar. Phones that
 * cannot (Safari on iPhone fills the screen only for video) keep the page filling the
 * window instead, so a refusal changes nothing.
 */
export const EnterFullscreen = Command.define('EnterFullscreen', {
  messages: [Message.CompletedFullscreen],
  execute: Effect.tryPromise(() => globalThis.document.documentElement.requestFullscreen()).pipe(
    Effect.match({
      onFailure: () => Message.CompletedFullscreen(),
      onSuccess: () => Message.CompletedFullscreen(),
    }),
  ),
});

/** Gives the screen back, if the page has it. */
export const ExitFullscreen = Command.define('ExitFullscreen', {
  messages: [Message.CompletedFullscreen],
  execute: Effect.tryPromise(() =>
    globalThis.document.fullscreenElement === null
      ? Promise.resolve()
      : globalThis.document.exitFullscreen(),
  ).pipe(
    Effect.match({
      onFailure: () => Message.CompletedFullscreen(),
      onSuccess: () => Message.CompletedFullscreen(),
    }),
  ),
});

/** Puts the cursor in the search box: the `/` shortcut. */
export const FocusSearch = Command.define('FocusSearch', {
  messages: [Message.CompletedFocusSearch],
  // A missing box (the radar still loading) leaves the focus where it is.
  execute: Dom.focus('.e3-search-input').pipe(
    Effect.match({
      onFailure: () => Message.CompletedFocusSearch(),
      onSuccess: () => Message.CompletedFocusSearch(),
    }),
  ),
});

/** Goes to an entry's full page: the `O` shortcut. */
export const OpenPage = Command.define('OpenPage', {
  args: { href: Schema.String },
  messages: [Message.CompletedOpenPage],
  execute: ({ href }) => Navigation.load(href).pipe(Effect.map(() => Message.CompletedOpenPage())),
});

export const CopyLink = Command.define('CopyLink', {
  messages: [Message.CompletedCopyLink],
  execute: Effect.tryPromise(() =>
    globalThis.navigator.clipboard.writeText(globalThis.location.href),
  ).pipe(
    Effect.match({
      onSuccess: () => Message.CompletedCopyLink({ outcome: 'copied' }),
      onFailure: () => Message.CompletedCopyLink({ outcome: 'refused' }),
    }),
  ),
});

/** A tour as a file: a version, where it starts (a deep link) and its moves. */
const TourFile = Schema.Struct({
  version: Schema.Literal(1),
  start: Schema.String,
  steps: Schema.Array(Message),
});

/** A tour, saved as a JSON file named for the day it was saved. */
export const SaveTour = Command.define('SaveTour', {
  args: { recording: Schema.Unknown },
  messages: [Message.CompletedSaveTour],
  execute: ({ recording }) =>
    // SAFETY: `recording` is the Model's own Recording, passed through the Command's
    // Schema.Unknown argument because a Recording holds Messages the Model cannot name.
    Effect.try(() => download(recording as Recording)).pipe(
      Effect.orElseSucceed(() => undefined),
      Effect.map(() => Message.CompletedSaveTour()),
    ),
});

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
export const LoadTour = Command.define('LoadTour', {
  messages: [Message.SucceededLoadTour, Message.FailedLoadTour, Message.CancelledLoadTour],
  execute: File.select(['.json', 'application/json']).pipe(
    Effect.flatMap((picked) => tourFromPick(picked)),
  ),
});

/** What loading a tour comes to: a tour, a refusal, or nothing picked. */
type LoadedTour = ReturnType<
  | typeof Message.SucceededLoadTour
  | typeof Message.FailedLoadTour
  | typeof Message.CancelledLoadTour
>;

/** A picked file read as a tour; a file that cannot be read is refused. */
const readTour = (file: File.File) =>
  File.readAsText(file).pipe(
    Effect.map(tourFrom),
    Effect.orElseSucceed(
      (): LoadedTour => Message.FailedLoadTour({ reason: 'That file could not be read' }),
    ),
  );

/** The picked file's tour; nothing picked is a cancel. */
const tourFromPick = (picked: Option.Option<File.File>) =>
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
