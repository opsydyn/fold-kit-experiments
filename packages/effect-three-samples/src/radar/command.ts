/**
 * The radar's Commands: remembering the reader's theme in this browser. Storage can be
 * missing or refuse (a private window, blocked site data), so a load that fails, or finds
 * nothing it recognises, is Auto, and a save that fails is quietly forgotten.
 */
import { Effect, Option, Schema } from 'effect';
import { Command } from 'foldkit';

import { Message } from './message';
import { Theme, ThemeChoice } from './themes';

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
