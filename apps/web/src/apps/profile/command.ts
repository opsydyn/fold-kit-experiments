import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { usernameAtom } from '../../stores/username';
import { Message } from './message';

const saveUsername = (username: string) => {
  usernameAtom.set(username);
  return Message.CompletedSaveUsername();
};

export const SaveUsername = Command.define('SaveUsername', {
  args: { username: Schema.String },
  messages: [Message.CompletedSaveUsername],
  // SAFETY: usernameAtom.set is the synchronous command boundary for this local store.
  // oxlint-disable-next-line linteffect/warn-effect-sync-wrapper
  execute: ({ username }) => Effect.sync(() => saveUsername(username)),
});
