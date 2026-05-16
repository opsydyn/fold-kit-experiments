import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { usernameAtom } from '../../stores/username';
import { CompletedSaveUsername } from './message';

export const SaveUsername = Command.define(
  'SaveUsername',
  { username: Schema.String },
  CompletedSaveUsername,
)(({ username }) =>
  Effect.sync(() => {
    usernameAtom.set(username);
    return CompletedSaveUsername({});
  }),
);
