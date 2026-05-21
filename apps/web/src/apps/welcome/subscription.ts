import { Effect, Queue, Stream } from 'effect';
import { Subscription } from 'foldkit';

import { usernameAtom } from '../../stores/username';
import type { Message } from './message';
import { ReceivedUsername } from './message';
import type { Model } from './model';

const usernameStream: Stream.Stream<Message> = Stream.callback((queue) =>
  Effect.acquireRelease(
    Effect.sync(() =>
      usernameAtom.subscribe((username) =>
        Queue.offerUnsafe(queue, ReceivedUsername({ username })),
      ),
    ),
    (unsub) => Effect.sync(unsub),
  ).pipe(Effect.flatMap(() => Effect.never)),
);

export const subscriptions = Subscription.make<Model, Message>()(_entry => ({
  username: Subscription.persistent(usernameStream),
}));
