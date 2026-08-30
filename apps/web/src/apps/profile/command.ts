import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { usernameAtom } from '../../stores/username';
import { Message } from './message';

export const SaveUsername = Command.define('SaveUsername', {
  args: { username: Schema.String },
  messages: [Message.CompletedSaveUsername],
  execute: ({ username }) =>
    Effect.sync(() => {
      usernameAtom.set(username);
      return Message.CompletedSaveUsername();
    }),
});
