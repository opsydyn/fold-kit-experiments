import { Effect } from 'effect';
import { Command } from 'foldkit';
import { focus } from 'foldkit/dom';

import { Message } from './message';

export const FocusEventBrowser = Command.define('FocusEventBrowser', {
  messages: [Message.CompletedEventBrowserFocus],
  execute: focus('.signal-event-browser > summary').pipe(
    Effect.match({
      // A dataset replacement may remove the feed before the queued focus runs.
      onFailure: () => Message.CompletedEventBrowserFocus(),
      onSuccess: () => Message.CompletedEventBrowserFocus(),
    }),
  ),
});
