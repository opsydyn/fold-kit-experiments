/**
 * Seeing the other players (ADR-020): while presenting, the room reports where the
 * player's head and hands are (`xr({ poses })`) and says it to every other room page,
 * over a `BroadcastChannel` between tabs of one browser or through the relay between
 * machines (`?relay=ws://host:port/room`, `bun run relay`), the transport the editor and
 * the tabletop use. Poses are latest-wins, so they go straight out rather than through a
 * lockstep session's turns: no one waits for them, and a lost one is replaced by the next.
 */
import { Command, Subscription } from '@effect/ui';
import {
  Cause,
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Queue,
  Ref,
  Schema,
  Stream,
} from 'effect';

import { waitForRelayOpen } from '../relay-connection';
import { Message } from './message';
import type { Model } from './model';
import { channelName, Wire } from './wire';

// THE RELAY

/** An open relay socket, and what it has heard since it opened (ended once it closes). */
export type RelayLink = {
  readonly socket: WebSocket;
  readonly heard: Queue.Queue<Wire, Cause.Done>;
};

class RoomRelay extends Context.Service<RoomRelay, Ref.Ref<Option.Option<RelayLink>>>()(
  'RoomRelay',
) {}

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

/** The keyed stream owns the socket, its queue and the service's current link. */
function relayMessages(url: string) {
  const connection = Effect.gen(function* () {
    const active = yield* RoomRelay;
    const heard = yield* Effect.acquireRelease(
      Queue.bounded<Wire, Cause.Done>(relayBacklog),
      Queue.shutdown,
    );
    const open = Effect.try({
      try: () => connect(url, heard),
      catch: () => `No relay at ${url}`,
    });
    const socket = yield* Effect.acquireRelease(open, (socket) =>
      Effect.sync(() => socket.close()),
    );
    yield* waitForRelayOpen(socket, url, relayConnectMilliseconds);
    yield* Effect.acquireRelease(Ref.set(active, Option.some({ socket, heard })), () =>
      Ref.set(active, Option.none()),
    );
    return Stream.make(Message.ConnectedRelay()).pipe(Stream.concat(relayHeard({ socket, heard })));
  });
  const messages = Stream.unwrap(connection);
  return messages.pipe(Stream.catch((reason) => Stream.succeed(Message.FailedRelay({ reason }))));
}

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
export class Say extends Command.Service<Say>()('Say', {
  args: { wire: Wire, via: Schema.Literals(['tabs', 'relay']) },
  success: Message,
}) {}

const send =
  (active: Ref.Ref<Option.Option<RelayLink>>) =>
  ({ wire, via }: { readonly wire: Wire; readonly via: 'tabs' | 'relay' }) =>
    via === 'tabs'
      ? Effect.sync(sayToTabs(wire))
      : Ref.get(active).pipe(
          Effect.map(
            Option.match({
              onNone: () => Message.CompletedSay(),
              onSome: sayOn(wire),
            }),
          ),
        );

export function roomPresenceLayer() {
  const relay = Layer.effect(RoomRelay, Ref.make(Option.none<RelayLink>()));
  const say = Say.toLayer(Effect.map(RoomRelay, send));
  return say.pipe(Layer.provideMerge(relay));
}

/** A name for this player, and the relay the page names. */
export const NamePlayer = Command.make('NamePlayer', { args: {} }, () =>
  Effect.sync(() =>
    Message.NamedPlayer({
      peer: crypto.randomUUID().slice(0, 8),
      relay: relayIn(window.location.search),
    }),
  ),
);

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

/** How often players unheard for too long are let go. */
const sweepMilliseconds = 500;

export const subscriptions = ({ model }: { readonly model: Model }) => [
  Subscription.make(
    'leaving',
    Stream.callback<null>(watchLeaving).pipe(Stream.map(() => Message.LeftPage())),
  ),
  Option.isSome(model.self) &&
    Option.isNone(model.relay) &&
    Subscription.make('tabs', heardOnChannel),
  Option.isSome(model.relay) &&
    model.relay.value.link !== 'Lost' &&
    Subscription.make('relay', model.relay.value.url, relayMessages),
  Subscription.make(
    'sweep',
    Stream.tick(Duration.millis(sweepMilliseconds)).pipe(
      Stream.map(() => Message.TickedPresence({ at: Date.now() })),
    ),
  ),
];
