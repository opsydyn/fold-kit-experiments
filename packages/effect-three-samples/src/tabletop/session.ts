/**
 * Playing together: the core's `Lockstep` over a `BroadcastChannel` between tabs of one
 * browser, or over a relay between machines (`?relay=ws://host:port/room`, served by
 * `bun run relay`), as the editor does (ADR-013). Each turn's throws land in the
 * timeline at that turn's step, so every peer's world gets them at the same step.
 *
 * - A new peer says `Hello` and listens. The session's leader admits it in a turn and,
 *   when that admission takes effect, sends a `Welcome` with every throw so far; the
 *   newcomer replays them from step 0. Heard nothing in a second and a half: it starts
 *   a session of its own.
 * - A peer leaving says `Bye`; one that goes quiet holds every turn up until the leader
 *   `Drop`s it, three seconds on. A hidden page's timers slow to a second or more, which
 *   would slow every world: a hidden peer with others steps out, and back in (replaying)
 *   when shown again.
 */
import { Cause, Clock, Duration, Effect, Match, Option, Queue, Schema, Stream } from 'effect';
import { Command, ManagedResource, Subscription } from 'foldkit';

import { Message } from './message';
import type { Model } from './model';
import { channelName, joinMilliseconds, turnMilliseconds, Wire } from './wire';

// THE RELAY

/** An open relay socket, and what it has heard since it opened (ended once it closes). */
export type RelayLink = {
  readonly socket: WebSocket;
  readonly heard: Queue.Queue<Wire, Cause.Done>;
};

export const RelaySocket = ManagedResource.tag<RelayLink>()('TabletopRelaySocket');
export type RelayService = ManagedResource.ServiceOf<typeof RelaySocket>;

/** A relay message is a `Wire` as JSON text. */
const WireText = Schema.fromJsonString(Wire);
export const encodeWireText = Schema.encodeSync(WireText);
export const decodeWireText = Schema.decodeUnknownOption(WireText);

/** The relay a page names, when it names a WebSocket address. */
export const relayIn = (search: string): Option.Option<string> =>
  Option.fromNullishOr(new URLSearchParams(search).get('relay')).pipe(
    Option.filter((url) => URL.canParse(url) && /^wss?:$/.test(new URL(url).protocol)),
  );

/**
 * How much a relay socket keeps for this peer to hear: far more than it falls behind by,
 * as it hears each message as it comes (a packet a turn from each peer).
 */
const relayBacklog = 4096;

const hear = (heard: RelayLink['heard']) => (event: MessageEvent<unknown>) =>
  Option.match(decodeWireText(event.data), {
    onNone: () => undefined,
    onSome: (wire) => Queue.offerUnsafe(heard, wire),
  });

/** A socket to `url` that resolves once open and rejects if it never opens. */
const opening = (url: string, heard: RelayLink['heard']) => () =>
  new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.onmessage = hear(heard);
    socket.onopen = () => resolve(socket);
    socket.onerror = reject;
    socket.onclose = () => Queue.endUnsafe(heard);
  });

/** This tab's name in the session, once it has one. */
export const selfOf = (session: Model['session']): Option.Option<string> =>
  Match.valueTags(session, {
    Offline: () => Option.none(),
    Joining: ({ self }) => Option.some(self),
    Live: ({ lockstep }) => Option.some(lockstep.self),
  });

/** The relay socket, for as long as the Model names a relay it has not lost. */
export const managedResources = ManagedResource.make<Model, Message>()((entry) => ({
  relay: entry(Schema.Option(Schema.Struct({ url: Schema.String, peer: Schema.String })), {
    resource: RelaySocket,
    // A new name is a new socket: a tab that reconnects joins as a newcomer.
    modelToMaybeRequirements: (model) =>
      Option.filter(model.relay, (relay) => relay.link !== 'Lost').pipe(
        Option.flatMap((relay) =>
          Option.map(selfOf(model.session), (peer) => ({ url: relay.url, peer })),
        ),
      ),
    // The socket closes with the resource's scope.
    acquire: ({ url }) =>
      Effect.gen(function* () {
        const heard = yield* Queue.bounded<Wire, Cause.Done>(relayBacklog);
        const open = Effect.tryPromise({
          try: opening(url, heard),
          catch: () => `No relay at ${url}`,
        });
        const socket = yield* Effect.acquireRelease(open, (socket) =>
          Effect.sync(() => socket.close()),
        );
        return { socket, heard };
      }),
    release: () => Effect.void,
    onAcquired: () => Message.ConnectedRelay(),
    onAcquireError: (reason) => Message.FailedRelay({ reason: String(reason) }),
    onReleased: () => Message.ReleasedRelay(),
  }),
}));

// COMMANDS

const sayOn =
  (wire: Wire) =>
  ({ socket }: RelayLink) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(encodeWireText(wire));
    return Message.CompletedSay();
  };

const sayToTabs = (wire: Wire) => () => {
  const channel = new BroadcastChannel(channelName);
  channel.postMessage(Schema.encodeSync(Wire)(wire));
  channel.close();
  return Message.CompletedSay();
};

/**
 * Says something to every other tab: over the channel, or through the relay. Through
 * the relay it is best effort: a socket already gone says nothing, and the others drop
 * this tab when it goes quiet.
 */
export const Say = Command.define('Say', {
  args: { wire: Wire, via: Schema.Literals(['tabs', 'relay']) },
  messages: [Message.CompletedSay],
  execute: ({ wire, via }) =>
    via === 'tabs'
      ? Effect.sync(sayToTabs(wire))
      : RelaySocket.get.pipe(
          Effect.map(sayOn(wire)),
          Effect.orElseSucceed(() => Message.CompletedSay()),
        ),
});

/** A name for this tab in the session, the time it was made, and the relay the page names. */
export const NameTab = Command.define('NameTab', {
  messages: [Message.NamedTab],
  execute: Clock.currentTimeMillis.pipe(
    Effect.map((at) =>
      Message.NamedTab({
        peer: crypto.randomUUID().slice(0, 8),
        at,
        relay: relayIn(window.location.search),
      }),
    ),
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
const heardOnChannel = Stream.callback<Wire>(listen);

const heardWire = (wire: Wire) => Message.HeardWire({ wire, at: Date.now() });

const relayHeard = ({ heard }: RelayLink) =>
  Stream.fromQueue(heard).pipe(
    Stream.map(heardWire),
    Stream.concat(Stream.succeed(Message.LostRelay())),
  );

/** What the relay hands on, decoded, then `LostRelay` once its socket closes. */
const heardOnRelay = Stream.unwrap(
  RelaySocket.get.pipe(
    Effect.map(relayHeard),
    Effect.orElseSucceed(() => Stream.empty),
  ),
);

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

const onVisibility = (queue: Queue.Queue<boolean, Cause.Done>) => () => {
  const listener = () => Queue.offerUnsafe(queue, document.hidden);
  document.addEventListener('visibilitychange', listener);
  return listener;
};

const offVisibility = (listener: () => void) => () =>
  document.removeEventListener('visibilitychange', listener);

const watchVisibility = (queue: Queue.Queue<boolean, Cause.Done>) => {
  const watch = Effect.sync(onVisibility(queue));
  return Effect.acquireRelease(watch, (listener) => Effect.sync(offVisibility(listener)));
};

/** The page hidden or shown again. */
const visibility = Stream.callback<boolean>(watchVisibility);

/** Where this tab hears others: the channel once named without a relay, or the relay. */
const hearing = (model: Model) => ({
  tabs: model.session._tag !== 'Offline' && Option.isNone(model.relay),
  relay: Option.exists(model.relay, (relay) => relay.link === 'Open'),
});

export const subscriptions = Subscription.make<Model, Message, RelayService>()((entry) => ({
  leaving: Subscription.persistentEntry(leaving.pipe(Stream.map(() => Message.LeftPage()))),
  visibility: Subscription.persistentEntry(
    visibility.pipe(Stream.map((hidden) => Message.ChangedVisibility({ hidden }))),
  ),
  heardOnChannel: entry(
    { tabs: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ tabs: hearing(model).tabs }),
      dependenciesToStream: ({ tabs }) =>
        tabs ? heardOnChannel.pipe(Stream.map(heardWire)) : Stream.empty,
    },
  ),
  heardOnRelay: entry(
    { relay: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ relay: hearing(model).relay }),
      dependenciesToStream: ({ relay }) => (relay ? heardOnRelay : Stream.empty),
    },
  ),
  turns: Subscription.persistentEntry(
    Stream.tick(Duration.millis(turnMilliseconds)).pipe(
      Stream.map(() => Message.TickedTurn({ at: Date.now() })),
    ),
  ),
}));
