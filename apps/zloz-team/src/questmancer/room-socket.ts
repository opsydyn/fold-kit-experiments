import { Effect, Queue, Schema, Stream } from 'effect';

import { RoomNotice } from './contracts';

const isNotice = Schema.is(RoomNotice);

export const roomSocket = (api: string) =>
  Stream.callback<RoomNotice | 'connected'>((queue) => {
    const connect = Effect.sync(() => {
      const url = new URL(api + 'live', location.origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url);
      const opened = () => Queue.offerUnsafe(queue, 'connected');
      const received = ({ data }: MessageEvent) => {
        if (isNotice(data)) Queue.offerUnsafe(queue, data);
      };
      const closed = () => Queue.endUnsafe(queue);
      // A backgrounded tab can miss a notice without seeing a socket close.
      // Reopening reads the current room and party Ledger on the existing reconnect path.
      const resumed = () => {
        if (document.visibilityState === 'visible') closed();
      };
      window.addEventListener('focus', resumed);
      document.addEventListener('visibilitychange', resumed);
      socket.addEventListener('open', opened);
      socket.addEventListener('message', received);
      socket.addEventListener('close', closed);
      return { socket, opened, received, closed, resumed };
    });
    return Effect.acquireRelease(connect, ({ socket, opened, received, closed, resumed }) =>
      Effect.sync(() => {
        window.removeEventListener('focus', resumed);
        document.removeEventListener('visibilitychange', resumed);
        socket.removeEventListener('open', opened);
        socket.removeEventListener('message', received);
        socket.removeEventListener('close', closed);
        socket.close();
      }),
    );
  });
