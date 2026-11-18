import { canonicalOperationValue } from '@opsydyn/foldkit-zloz';
import { DiagramDeltaSchema, type DiagramDelta } from '@opsydyn/foldkit-zloz-alchemy/delta';
import { isDiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import type { DiagramFrame, DiagramRoom } from '@opsydyn/foldkit-zloz-alchemy/session';
import { Cause, Data, Effect, Option, Queue, Result, Schema, Stream } from 'effect';

export const pathFor = (room: Pick<DiagramRoom, 'teamId' | 'diagramId'>) =>
  `/api/zloz/diagrams/${encodeURIComponent(room.teamId)}/${encodeURIComponent(room.diagramId)}`;
const WireSnapshot = Schema.Struct({ state: Schema.Unknown });
type WireSnapshot = typeof WireSnapshot.Type;
const Chunk = Schema.Struct({
  _tag: Schema.Literal('Chunk'),
  values: Schema.Array(WireSnapshot),
});
const decodeChunk = Schema.decodeUnknownOption(Schema.fromJsonString(Chunk));
/** Decode the pinned SDK's read-only RPC frames; private event streams are not consumed. */
export function liveFrames(text: string): readonly DiagramFrame[] {
  return wireSnapshots(text)
    .map((snapshot) => snapshot.state)
    .filter(isDiagramFrame);
}
/** Unknown wire values are fully validated at the editor Model boundary. */
function wireSnapshots(text: string): readonly WireSnapshot[] {
  const result: WireSnapshot[] = [];
  for (const line of text.split('\n').filter(Boolean)) {
    const chunk = decodeChunk(line);
    if (Option.isNone(chunk)) continue;
    for (const snapshot of chunk.value.values) result.push(snapshot);
  }
  return result;
}
export function liveStream<M>(
  room: DiagramRoom,
  onSnapshot: (snapshot: WireSnapshot) => M,
  onClose: (reason: 'lease' | 'failure') => M,
) {
  return Stream.callback<M>(
    (queue) => {
      const acquire = Effect.sync(() => {
        const url = new URL('/api/zloz/live', location.origin);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.searchParams.set(
          'read',
          JSON.stringify({
            id: '1',
            tag: 'ZlozDiagramLiveV1.watch',
            payload: { key: canonicalOperationValue([room.teamId, room.diagramId]) },
          }),
        );
        const socket = new WebSocket(url);
        const message = (event: MessageEvent) => {
          const decoded = wireSnapshots(String(event.data));
          for (const snapshot of decoded) Queue.offerUnsafe(queue, onSnapshot(snapshot));
        };
        const close = (event: CloseEvent) =>
          Queue.offerUnsafe(
            queue,
            onClose(
              event.code === 1000 && event.reason === 'Authorization lease ended; reconnect'
                ? 'lease'
                : 'failure',
            ),
          );
        const error = () => Queue.offerUnsafe(queue, onClose('failure'));
        socket.addEventListener('message', message);
        socket.addEventListener('close', close);
        socket.addEventListener('error', error);
        return { socket, message, close, error };
      });
      return Effect.acquireRelease(acquire, ({ socket, message, close, error }) =>
        Effect.sync(() => {
          socket.removeEventListener('message', message);
          socket.removeEventListener('close', close);
          socket.removeEventListener('error', error);
          socket.close();
        }),
      );
    },
    { bufferSize: 32, strategy: 'sliding' },
  );
}

const Counter = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
  ),
);
const DeltaEntry = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal('CaughtUp'), cursor: Counter }),
  Schema.Struct({
    event: Schema.Struct({ _tag: Schema.Literal('PublicDelta'), delta: DiagramDeltaSchema }),
    envelope: Schema.Struct({ seq: Counter }),
  }),
]);
export type PublicRead =
  | Readonly<{ kind: 'caught-up'; cursor: number }>
  | Readonly<{ kind: 'delta'; cursor: number; delta: DiagramDelta }>;
/** Malformed/failed reads trigger resync; no incremental entry is silently dropped. */
export function deltaEntries(text: string): readonly PublicRead[] {
  const result: PublicRead[] = [];
  for (const line of text.split('\n').filter(Boolean)) {
    const value = Schema.decodeUnknownSync(
      Schema.Struct({ _tag: Schema.Literal('Chunk'), values: Schema.Array(DeltaEntry) }),
    )(JSON.parse(line));
    for (const entry of value.values)
      result.push(
        '_tag' in entry
          ? { kind: 'caught-up', cursor: entry.cursor }
          : { kind: 'delta', cursor: entry.envelope.seq, delta: entry.event.delta },
      );
  }
  return result;
}
class FeedOverflow extends Data.TaggedError('FeedOverflow') {}
// oxlint-disable-next-line linteffect/no-effect-wrapper-alias -- Scoped browser resource adapter matches the legacy liveStream boundary.
export function deltaStream<M>(
  room: DiagramRoom,
  after: number,
  onRead: (entry: PublicRead) => M,
  onClose: (reason: 'lease' | 'failure') => M,
) {
  return Stream.callback<M, FeedOverflow>(
    (queue) => {
      const acquire = Effect.sync(() => {
        const url = new URL('/api/zloz/live', location.origin);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.searchParams.set(
          'read',
          JSON.stringify({
            id: '1',
            tag: 'ZlozDiagramDeltaV1.events',
            payload: { key: canonicalOperationValue([room.teamId, room.diagramId]), after },
          }),
        );
        const socket = new WebSocket(url);
        let ended = false;
        const fail = () => {
          if (ended) return;
          ended = true;
          Queue.failCauseUnsafe(queue, Cause.fail(new FeedOverflow()));
          // oxlint-disable-next-line linteffect/no-manual-resource-close -- Overflow aborts delivery immediately; the scope finalizer still owns listener cleanup.
          socket.close();
        };
        const offer = (message: M) => {
          if (!ended && !Queue.offerUnsafe(queue, message)) fail();
        };
        const message = (event: MessageEvent) => {
          Result.match(
            Result.try(() => deltaEntries(String(event.data))),
            {
              onSuccess: (entries) => {
                for (const entry of entries) offer(onRead(entry));
              },
              onFailure: fail,
            },
          );
        };
        const close = (event: CloseEvent) =>
          offer(
            onClose(
              event.code === 1000 && event.reason === 'Authorization lease ended; reconnect'
                ? 'lease'
                : 'failure',
            ),
          );
        const error = () => fail();
        socket.addEventListener('message', message);
        socket.addEventListener('close', close);
        socket.addEventListener('error', error);
        return { socket, message, close, error };
      });
      return Effect.acquireRelease(acquire, ({ socket, message, close, error }) =>
        Effect.sync(() => {
          socket.removeEventListener('message', message);
          socket.removeEventListener('close', close);
          socket.removeEventListener('error', error);
          socket.close();
        }),
      );
    },
    { bufferSize: 32, strategy: 'dropping' },
  ).pipe(Stream.catchCause(() => Stream.succeed(onClose('failure'))));
}
