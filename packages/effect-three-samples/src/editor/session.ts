/**
 * Editing together: the core's `Lockstep` over a `BroadcastChannel` between tabs of one
 * browser, or over a relay between machines (`?relay=ws://host:port/room`, served by
 * `bun run relay`). Every tab with the editor open joins one session; each tab's Edits
 * go out in its turn packets, and every tab applies every Edit in the same order.
 *
 * - A new tab says `Hello` and listens. The session's leader admits it in a turn and,
 *   when that admission takes effect, sends a `Welcome` with the document and the
 *   history as they are then. Heard nothing in a second and a half: it starts a session
 *   of its own.
 * - A tab closing says `Bye`, with the turn it sent last, so the others stop waiting
 *   for it there. A tab that goes quiet without one (a crash, a frozen tab, a lost
 *   connection) holds every turn up until the leader `Drop`s it, three seconds on.
 * - Through a relay, the keyed subscription owns the socket: the Model asks for it while it
 *   names a relay it has not lost, and a tab that loses it carries on alone until the
 *   person reconnects, as a newcomer with a new name.
 */
import { Command, Subscription } from '@effect/ui';
import {
  Cause,
  Clock,
  Context,
  Duration,
  Effect,
  Layer,
  Match,
  Option,
  Queue,
  Ref,
  Schema,
  Stream,
} from 'effect';

import { waitForRelayOpen } from '../relay-connection';
import { Message } from './message';
import type { Model } from './model';
import { channelName, joinMilliseconds, turnMilliseconds, Wire } from './wire';

// THE RELAY

/** An open relay socket, and what it has heard since it opened (ended once it closes). */
export type RelayLink = {
  readonly socket: WebSocket;
  readonly heard: Queue.Queue<Wire, Cause.Done>;
};

class EditorRelay extends Context.Service<EditorRelay, Ref.Ref<Option.Option<RelayLink>>>()(
  'EditorRelay',
) {}

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

/** A socket to `url`, connecting, that passes on what it hears until it closes. */
const connect = (url: string, heard: RelayLink['heard']): WebSocket => {
  const socket = new WebSocket(url);
  socket.onmessage = hear(heard);
  socket.onclose = () => Queue.endUnsafe(heard);
  return socket;
};

/** How long a relay has to answer. */
export const relayConnectMilliseconds = 5000;

/** This tab's name in the session, once it has one. */
export const selfOf = (session: Model['session']): Option.Option<string> =>
  Match.valueTags(session, {
    Offline: () => Option.none(),
    Joining: ({ self }) => Option.some(self),
    Live: ({ lockstep }) => Option.some(lockstep.self),
  });

/** The keyed stream owns the socket, its queue and the service's current link. */
function relayMessages(url: string) {
  const connection = Effect.gen(function* () {
    const active = yield* EditorRelay;
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

/**
 * Says something to every other editor tab: over the channel, or through the relay. Through
 * the relay it is best effort: a socket already gone says nothing, and the others drop
 * this tab when it goes quiet.
 */
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

export function editorSessionLayer() {
  const relay = Layer.effect(EditorRelay, Ref.make(Option.none<RelayLink>()));
  const say = Say.toLayer(Effect.map(EditorRelay, send));
  return say.pipe(Layer.provideMerge(relay));
}

/** A name for this tab in the session, the time it was made, and the relay the page names. */
export const NameTab = Command.make('NameTab', { args: {} }, () =>
  Clock.currentTimeMillis.pipe(
    Effect.map((at) =>
      Message.NamedTab({
        peer: crypto.randomUUID().slice(0, 8),
        at,
        relay: relayIn(window.location.search),
      }),
    ),
  ),
);

const welcomeWaited = () => Message.WaitedForWelcome();

/** After a new tab has waited long enough to be welcomed. */
export const WaitForWelcome = Command.make('WaitForWelcome', { args: {} }, () =>
  Effect.sleep(Duration.millis(joinMilliseconds)).pipe(Effect.map(welcomeWaited)),
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

/** What other tabs say, decoded; anything else on the channel is ignored. */
const heardOnChannel = Stream.callback<Wire>(listen);

const heardWire = (wire: Wire) => Message.HeardWire({ wire, at: Date.now() });

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

/** The tab going away, so it can say goodbye: best effort, as the page may be gone. */
const leaving = Stream.callback<null>(watchLeaving);

/** The address and name that own a relay connection while the Model needs one. */
export const relayRequirements = (model: Model) =>
  Option.flatMap(
    Option.filter(model.relay, ({ link }) => link !== 'Lost'),
    ({ url }) => Option.map(selfOf(model.session), (peer) => ({ url, peer })),
  );

export const subscriptions = ({ model }: { readonly model: Model }) => {
  const relay = relayRequirements(model);
  return [
    Subscription.make('leaving', leaving.pipe(Stream.map(() => Message.LeftPage()))),
    Option.isSome(selfOf(model.session)) &&
      Option.isNone(model.relay) &&
      Subscription.make('tabs', heardOnChannel.pipe(Stream.map(heardWire))),
    Option.isSome(relay) &&
      Subscription.make('relay', [relay.value.url, relay.value.peer], ([url]) =>
        relayMessages(url),
      ),
    Subscription.make(
      'turns',
      Stream.tick(Duration.millis(turnMilliseconds)).pipe(
        Stream.map(() => Message.TickedTurn({ at: Date.now() })),
      ),
    ),
  ];
};
