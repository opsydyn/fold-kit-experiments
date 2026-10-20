/**
 * A relay for editing together between machines (ADR-013): a WebSocket server that hands
 * every message a peer sends to every other peer in the same room, and does nothing else.
 * It does not read what it relays; the editor's tabs decode each message on arrival, as
 * they do over a `BroadcastChannel`, so the lockstep protocol stays the app's.
 *
 * A room is the URL's path: peers that connect to `ws://host:port/studio` hear one
 * another, and no one in `/kitchen`. Run one with `bun run relay` and open the editor with
 * `?relay=ws://host:port/studio`.
 */
import { Effect } from 'effect';

/** A room's name: the path a peer connects to, such as `/studio`. */
const roomPath = /^\/[\w-]{1,64}$/;

/** The largest message relayed: a welcome carries the whole document and its history. */
const largestMessage = 8 * 1024 * 1024;

export type RelayOptions = {
  /** The port to listen on; 0 picks a free one. */
  readonly port: number;
  readonly hostname: string;
};

type Peer = { readonly room: string };

const startRelay = (options: RelayOptions) => () =>
  Bun.serve({
    port: options.port,
    hostname: options.hostname,
    fetch: (request, server) => {
      const room = new URL(request.url).pathname;
      if (!roomPath.test(room)) return new Response('Not a room', { status: 404 });
      if (server.upgrade(request, { data: { room } })) return undefined;
      return new Response('Connect to a room with a WebSocket', { status: 426 });
    },
    websocket: {
      // SAFETY: only `upgrade` above makes peers, and it gives each one its room.
      data: {} as Peer,
      maxPayloadLength: largestMessage,
      open: (socket) => {
        socket.subscribe(socket.data.room);
      },
      // `publish` reaches every subscriber but the sender, as a `BroadcastChannel` does.
      message: (socket, message) => {
        socket.publish(socket.data.room, message);
      },
      close: (socket) => {
        socket.unsubscribe(socket.data.room);
      },
    },
  });

export type Relay = ReturnType<ReturnType<typeof startRelay>>;

const stopRelay = (server: Relay) => () => server.stop(true);

/** A relay listening for as long as the scope is open; closing it closes every socket. */
export const serveRelay = (options: RelayOptions) => {
  const start = Effect.sync(startRelay(options));
  return Effect.acquireRelease(start, (server) => Effect.promise(stopRelay(server)));
};
