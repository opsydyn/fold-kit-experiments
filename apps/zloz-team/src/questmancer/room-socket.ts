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
      socket.addEventListener('open', opened);
      socket.addEventListener('message', received);
      socket.addEventListener('close', closed);
      return { socket, opened, received, closed };
    });
    return Effect.acquireRelease(connect, ({ socket, opened, received, closed }) =>
      Effect.sync(() => {
        socket.removeEventListener('open', opened);
        socket.removeEventListener('message', received);
        socket.removeEventListener('close', closed);
        socket.close();
      }),
    );
  });
