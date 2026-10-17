import { Effect } from 'effect';
/** Asking the browser about virtual reality, and entering and leaving it. */
import { Command } from 'foldkit';

import { environment } from './environment';
import { Message } from './message';

export const CheckVr = Command.define('CheckVr', {
  messages: [Message.CheckedVr],
  execute: Effect.suspend(() => environment.xr.supported('immersive-vr')).pipe(
    Effect.map((supported) => Message.CheckedVr({ supported })),
  ),
});

/** Run from the click on "Enter VR": browsers start sessions only from a user gesture. */
export const EnterVr = Command.define('EnterVr', {
  messages: [Message.ChangedVrSession, Message.FailedVr],
  execute: Effect.suspend(() => environment.xr.enter('immersive-vr')).pipe(
    Effect.match({
      onSuccess: () => Message.ChangedVrSession({ presenting: true }),
      onFailure: () => Message.FailedVr(),
    }),
  ),
});

export const ExitVr = Command.define('ExitVr', {
  messages: [Message.ChangedVrSession],
  execute: Effect.suspend(() => environment.xr.exit).pipe(
    Effect.map(() => Message.ChangedVrSession({ presenting: false })),
  ),
});
