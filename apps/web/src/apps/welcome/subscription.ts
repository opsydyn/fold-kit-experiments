import { Subscription } from '@effect/ui';
import { Effect, Queue, Stream } from 'effect';

import { usernameAtom } from '../../stores/username';
import { Message } from './message';

type UsernameSubscription = Parameters<typeof Stream.callback<Message>>[0];

const usernameSubscription: UsernameSubscription = function usernameSubscription(queue) {
  // SAFETY: Atom subscription registration is the resource acquisition boundary.
  // oxlint-disable-next-line linteffect/warn-effect-sync-wrapper
  const setup = Effect.sync(() =>
    usernameAtom.subscribe((username) =>
      Queue.offerUnsafe(queue, Message.ReceivedUsername({ username })),
    ),
  );
  return Effect.acquireRelease(setup, (unsub) => Effect.sync(unsub)).pipe(
    // acquireRelease above handles teardown; Effect.never holds the scope
    // open for the subscription's lifetime (this is the canonical Stream.callback pattern).
    // oxlint-disable-next-line linteffect/no-effect-never
    Effect.flatMap(() => Effect.never),
  );
};

const usernameStream: Stream.Stream<Message> = Stream.callback(usernameSubscription);

export const subscriptions = () => [Subscription.make('WelcomeUsername', usernameStream)];
