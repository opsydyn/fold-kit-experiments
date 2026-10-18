/** Asking the browser about VR and AR, and entering and leaving them. */
import { Effect } from 'effect';
import { Command } from 'foldkit';

import { environment } from '../environment';
import { Message, Mode } from './message';

export const CheckSupport = Command.define('CheckSupport', {
  args: { mode: Mode },
  messages: [Message.CheckedSupport],
  execute: ({ mode }) =>
    Effect.suspend(() => environment.xr.supported(mode)).pipe(
      Effect.map((supported) => Message.CheckedSupport({ mode, supported })),
    ),
});

/** Run from the click on "Enter": browsers start sessions only from a user gesture. */
export const Enter = Command.define('Enter', {
  args: { mode: Mode },
  messages: [Message.ChangedSession, Message.FailedEnter],
  execute: ({ mode }) =>
    Effect.suspend(() => environment.xr.enter(mode)).pipe(
      Effect.match({
        onSuccess: () => Message.ChangedSession({ mode }),
        onFailure: () => Message.FailedEnter(),
      }),
    ),
});

export const Exit = Command.define('Exit', {
  messages: [Message.ChangedSession],
  execute: Effect.suspend(() => environment.xr.exit).pipe(
    Effect.map(() => Message.ChangedSession({ mode: null })),
  ),
});
