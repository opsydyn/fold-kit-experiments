/**
 * The relay, over real sockets: what one peer sends reaches every other peer in its
 * room, in the order it was sent, and no one else.
 */
import { expect, test } from 'bun:test';

import { Effect } from 'effect';

import { serveRelay } from '../src/relay/relay';

/** Runs `body` with a relay on a free port, closed again once `body` is done. */
const withRelay = async (body: (port: number) => Promise<void>) => {
  const relayed = Effect.gen(function* () {
    const relay = yield* serveRelay({ port: 0, hostname: '127.0.0.1' });
    yield* Effect.promise(() => body(relay.port ?? 0));
  });
  await Effect.runPromise(relayed.pipe(Effect.scoped));
};

type Peer = { readonly socket: WebSocket; readonly heard: Array<string> };

const connect = (port: number, room: string) =>
  new Promise<Peer>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${room}`);
    const heard: Array<string> = [];
    socket.onmessage = (event: MessageEvent<string>) => heard.push(event.data);
    socket.onopen = () => resolve({ socket, heard });
    socket.onerror = () => reject(new Error(`no relay at ${room}`));
  });

/** Waits until `ready` holds, a few milliseconds at a time. */
const until = async (ready: () => boolean) => {
  for (let i = 0; i < 200 && !ready(); i++) await Bun.sleep(5);
};

test('each message reaches every other peer in the room, in order, and not its sender', () =>
  withRelay(async (port) => {
    const [a, b, c, elsewhere] = await Promise.all([
      connect(port, '/studio'),
      connect(port, '/studio'),
      connect(port, '/studio'),
      connect(port, '/kitchen'),
    ]);
    for (const n of [1, 2, 3]) a.socket.send(`a${n}`);
    b.socket.send('b1');
    await until(() => b.heard.length === 3 && c.heard.length === 4 && a.heard.length === 1);
    expect(a.heard).toEqual(['b1']);
    expect(b.heard).toEqual(['a1', 'a2', 'a3']);
    expect(c.heard.filter((each) => each.startsWith('a'))).toEqual(['a1', 'a2', 'a3']);
    expect(c.heard).toContain('b1');
    expect(elsewhere.heard).toEqual([]);
    for (const peer of [a, b, c, elsewhere]) peer.socket.close();
  }));

test('a peer that left hears nothing more, and the others carry on', () =>
  withRelay(async (port) => {
    const [a, b, c] = await Promise.all([
      connect(port, '/hall'),
      connect(port, '/hall'),
      connect(port, '/hall'),
    ]);
    c.socket.close();
    await until(() => c.socket.readyState === WebSocket.CLOSED);
    a.socket.send('after');
    await until(() => b.heard.length === 1);
    expect(b.heard).toEqual(['after']);
    expect(c.heard).toEqual([]);
    a.socket.close();
    b.socket.close();
  }));

test('only room paths are rooms, and only WebSockets are served', () =>
  withRelay(async (port) => {
    const base = `http://127.0.0.1:${port}`;
    expect((await fetch(`${base}/studio`)).status).toBe(426);
    expect((await fetch(`${base}/`)).status).toBe(404);
    expect((await fetch(`${base}/a/b`)).status).toBe(404);
  }));

test('closing the relay closes the sockets of everyone in it', async () => {
  const peers: Array<Peer> = [];
  await withRelay(async (port) => {
    peers.push(await connect(port, '/studio'), await connect(port, '/studio'));
  });
  await until(() => peers.every((peer) => peer.socket.readyState === WebSocket.CLOSED));
  expect(peers.map((peer) => peer.socket.readyState)).toEqual([WebSocket.CLOSED, WebSocket.CLOSED]);
});
