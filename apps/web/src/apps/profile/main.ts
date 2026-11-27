import { Subscription } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Stream } from 'effect';

import { usernameAtom } from '../../stores/username';
import { Message } from './message';
import { init, Model, Props } from './model';
import { update } from './update';
import { view } from './view';

export const Profile = Html.component({
  name: 'Profile',
  model: Model,
  message: Message,
  props: Props,
}).make({
  init: ({ props }) => init(props),
  update: ($, message) => {
    const result = update($.model, message);
    return $.set(result.model).run(...(result.commands ?? []));
  },
  subscriptions: () => [
    Subscription.make(
      'RestoreUsername',
      Stream.fromEffect(
        Effect.sync(() => Message.RestoredUsername({ username: usernameAtom.get() })),
      ),
    ),
  ],
  view,
});
