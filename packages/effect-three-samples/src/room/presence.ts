/**
 * Seeing the other players (ADR-020): while presenting, the room reports where the
 * player's head and hands are (`xr({ poses })`) and says it to every other room page,
 * over a `BroadcastChannel` between tabs of one browser or through the relay between
 * machines (`?relay=ws://host:port/room`, `bun run relay`), the transport the editor and
 * the tabletop use. Poses are latest-wins, so they go straight out rather than through a
 * lockstep session's turns: no one waits for them, and a lost one is replaced by the next.
 */
import { Cause, Duration, Effect, Option, Queue, Schema, Stream } from 'effect';
import { Command, ManagedResource, Subscription } from 'foldkit';

import { Message } from './message';
import type { Model } from './model';
import { channelName, Wire } from './wire';

// THE RELAY

/** An open relay socket, and what it has heard since it opened (ended once it closes). */
export type RelayLink = {
  readonly socket: WebSocket;
  readonly heard: Queue.Queue<Wire, Cause.Done>;
};

export const RelaySocket = ManagedResource.tag<RelayLink>()('RoomRelaySocket');
export type RelayService = ManagedResource.ServiceOf<typeof RelaySocket>;

const WireText = Schema.fromJsonString(Wire);
const encodeWireText = Schema.encodeSync(WireText);
const decodeWireText = Schema.decodeUnknownOption(WireText);

/** The relay a page names, when it names a WebSocket address. */
export const relayIn = (search: string): Option.Option<string> =>
  Option.fromNullishOr(new URLSearchParams(search).get('relay')).pipe(
    Option.filter((url) => URL.canParse(url) && /^wss?:$/.test(new URL(url).protocol)),
  );

/** Far more than the room falls behind by: a pose a twentieth of a second from each player. */
const relayBacklog = 4096;

/** How long a relay has to answer before the room gives up on it. */
const relayConnectMilliseconds = 5000;

const hear = (heard: RelayLink['heard']) => (event: MessageEvent<unknown>) =>
  Option.match(decodeWireText(event.data), {
    onNone: () => undefined,
    onSome: (wire) => Queue.offerUnsafe(heard, wire),
  });

const connect = (url: string, heard: RelayLink['heard']): WebSocket => {
  const socket = new WebSocket(url);
  socket.onmessage = hear(heard);
  socket.onclose = () => Queue.endUnsafe(heard);
  return socket;
};

const whenOpen = (socket: WebSocket, opened: () => void, refused: () => void): void => {
  const giveUp = setTimeout(refused, relayConnectMilliseconds);
  const settle = (outcome: () => void) => () => {
    clearTimeout(giveUp);
    outcome();
  };
  socket.addEventListener('open', settle(opened), { once: true });
  socket.addEventListener('error', settle(refused), { once: true });
};

/** The relay socket, for as long as the Model names a relay it has not lost. */
export const managedResources = ManagedResource.make<Model, Message>()((entry) => ({
  relay: entry(Schema.Option(Schema.String), {
    resource: RelaySocket,
    modelToMaybeRequirements: (model) =>
      Option.filter(model.relay, (relay) => relay.link !== 'Lost').pipe(
        Option.map((relay) => relay.url),
      ),
    acquire: (url) =>
      Effect.gen(function* () {
        const heard = yield* Queue.bounded<Wire, Cause.Done>(relayBacklog);
        const connecting = Effect.sync(() => connect(url, heard));
        const socket = yield* Effect.acquireRelease(connecting, (socket) =>
          Effect.sync(() => socket.close()),
        );
        yield* Effect.callback<void, string>((resume) =>
          whenOpen(
            socket,
            () => resume(Effect.void),
            () => resume(Effect.fail(`No relay at ${url}`)),
          ),
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

/** Says something to every other room page: over the channel, or through the relay. */
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

/** A name for this player, and the relay the page names. */
export const NamePlayer = Command.define('NamePlayer', {
  messages: [Message.NamedPlayer],
  execute: Effect.sync(() =>
    Message.NamedPlayer({
      peer: crypto.randomUUID().slice(0, 8),
      relay: relayIn(window.location.search),
    }),
  ),
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

const heardWire = (wire: Wire) => Message.HeardPresence({ wire, at: Date.now() });

/** What other room pages say, decoded; anything else on the channel is ignored. */
const heardOnChannel = Stream.callback<Wire>(listen).pipe(Stream.map(heardWire));

const relayHeard = ({ heard }: RelayLink) =>
  Stream.fromQueue(heard).pipe(
    Stream.map(heardWire),
    Stream.concat(Stream.succeed(Message.LostRelay())),
  );

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

/** Where this page hears others: the channel once named without a relay, or the relay. */
const hearing = (model: Model) => ({
  tabs: Option.isSome(model.self) && Option.isNone(model.relay),
  relay: Option.exists(model.relay, (relay) => relay.link === 'Open'),
});

/** How often players unheard for too long are let go. */
const sweepMilliseconds = 500;

export const subscriptions = Subscription.make<Model, Message, RelayService>()((entry) => ({
  leaving: Subscription.persistentEntry(
    Stream.callback<null>(watchLeaving).pipe(Stream.map(() => Message.LeftPage())),
  ),
  heardOnChannel: entry(
    { tabs: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ tabs: hearing(model).tabs }),
      dependenciesToStream: ({ tabs }) => (tabs ? heardOnChannel : Stream.empty),
    },
  ),
  heardOnRelay: entry(
    { relay: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ relay: hearing(model).relay }),
      dependenciesToStream: ({ relay }) => (relay ? heardOnRelay : Stream.empty),
    },
  ),
  sweep: Subscription.persistentEntry(
    Stream.tick(Duration.millis(sweepMilliseconds)).pipe(
      Stream.map(() => Message.TickedPresence({ at: Date.now() })),
    ),
  ),
}));
