import { Command } from '@effect/ui';
import { Effect, Schema } from 'effect';

import { usernameAtom } from '../../stores/username';
import { Message } from './message';

export const SaveUsername = Command.make(
  'SaveUsername',
  { args: { username: Schema.String } },
  ({ username }) =>
    Effect.sync(() => {
      usernameAtom.set(username);
      return Message.CompletedSaveUsername({ username });
    }),
);
