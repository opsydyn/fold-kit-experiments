/**
 * Editing together, between tabs of one browser: the core's `Lockstep` over a
 * `BroadcastChannel`. Every tab with the editor open joins one session; each tab's
 * Edits go out in its turn packets, and every tab applies every Edit in the same order.
 *
 * - A new tab says `Hello` and listens. The session's leader admits it in a turn and,
 *   when that admission takes effect, sends a `Welcome` with the document and the
 *   history as they are then. Heard nothing in a second and a half: it starts a session
 *   of its own.
 * - A tab closing says `Bye`, with the turn it sent last, so the others stop waiting
 *   for it there. A tab that goes quiet without one (a crash, a frozen tab) holds every
 *   turn up until the leader `Drop`s it, three seconds on.
 */
import { type Cause, Clock, Duration, Effect, Option, Queue, Schema, Stream } from 'effect';
import { Command, Subscription } from 'foldkit';

import { Message } from './message';
import type { Model } from './model';
import { channelName, joinMilliseconds, turnMilliseconds, Wire } from './wire';

// COMMANDS

/** Says something to every other tab. */
export const Say = Command.define('Say', {
  args: { wire: Wire },
  messages: [Message.CompletedSay],
  execute: ({ wire }) =>
    Effect.sync(() => {
      const channel = new BroadcastChannel(channelName);
      channel.postMessage(Schema.encodeSync(Wire)(wire));
      channel.close();
      return Message.CompletedSay();
    }),
});

/** A name for this tab in the session, and the time it was made. */
export const NameTab = Command.define('NameTab', {
  messages: [Message.NamedTab],
  execute: Clock.currentTimeMillis.pipe(
    Effect.map((at) => Message.NamedTab({ peer: crypto.randomUUID().slice(0, 8), at })),
  ),
});

const welcomeWaited = () => Message.WaitedForWelcome();

/** After a new tab has waited long enough to be welcomed. */
export const WaitForWelcome = Command.define('WaitForWelcome', {
  messages: [Message.WaitedForWelcome],
  execute: Effect.sleep(Duration.millis(joinMilliseconds)).pipe(Effect.map(welcomeWaited)),
});

// SUBSCRIPTIONS

const decodeWire = Schema.decodeUnknownOption(Wire);

const openChannel = (queue: Queue.Queue<Wire, Cause.Done>) => (): BroadcastChannel => {
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = (event: MessageEvent<unknown>) =>
    Option.match(decodeWire(event.data), {
      onNone: () => undefined,
      onSome: (wire) => Queue.offerUnsafe(queue, wire),
    });
  return channel;
};

const closeChannel = (channel: BroadcastChannel) => () => channel.close();

const listen = (queue: Queue.Queue<Wire, Cause.Done>) => {
  const open = Effect.sync(openChannel(queue));
  return Effect.acquireRelease(open, (channel) => Effect.sync(closeChannel(channel)));
};

/** What other tabs say, decoded; anything else on the channel is ignored. */
const heard = Stream.callback<Wire>(listen);

const onPageHide = (queue: Queue.Queue<null, Cause.Done>) => () => {
  const listener = () => Queue.offerUnsafe(queue, null);
  window.addEventListener('pagehide', listener);
  return listener;
};

const offPageHide = (listener: () => void) => () =>
  window.removeEventListener('pagehide', listener);

const watchLeaving = (queue: Queue.Queue<null, Cause.Done>) => {
  const watch = Effect.sync(onPageHide(queue));
  return Effect.acquireRelease(watch, (listener) => Effect.sync(offPageHide(listener)));
};

/** The tab going away, so it can say goodbye: best effort, as the page may be gone. */
const leaving = Stream.callback<null>(watchLeaving);

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  leaving: Subscription.persistentEntry(leaving.pipe(Stream.map(() => Message.LeftPage()))),
  heard: Subscription.persistentEntry(
    heard.pipe(Stream.map((wire) => Message.HeardWire({ wire, at: Date.now() }))),
  ),
  turns: Subscription.persistentEntry(
    Stream.tick(Duration.millis(turnMilliseconds)).pipe(
      Stream.map(() => Message.TickedTurn({ at: Date.now() })),
    ),
  ),
}));
