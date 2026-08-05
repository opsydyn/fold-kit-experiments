import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { usernameAtom } from '../../stores/username';
import { CompletedSaveUsername } from './message';

export const SaveUsername = Command.define('SaveUsername', {
  args: { username: Schema.String },
  messages: [CompletedSaveUsername],
  execute: ({ username }) =>
    Effect.sync(() => {
      usernameAtom.set(username);
      return CompletedSaveUsername();
    }),
});
