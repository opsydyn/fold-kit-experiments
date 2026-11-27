import { Command } from '@effect/ui';
import { Effect } from 'effect';

import { Message } from './message';

export const FocusEventBrowser = Command.make('FocusEventBrowser', { args: {} }, () =>
  Effect.sync(() => {
    // A dataset replacement may remove the target before the queued focus runs.
    globalThis.document.querySelector<HTMLElement>('.signal-event-browser > summary')?.focus();
    return Message.CompletedEventBrowserFocus();
  }),
);
