/**
 * Live mode: an app that runs a specimen's Machine reports each message it gives the
 * machine on a BroadcastChannel, and the observatory, open in another tab, listens. Same
 * origin only, nothing leaves the browser; with no observatory open the messages go nowhere.
 */
import { Cause, Effect, Option, Queue, Schema, Stream } from 'effect';

/** The channel apps report on and the observatory listens to. */
export const channelName = 'foldkit-stateflow';

/** One message, encoded as its machine's Message schema encodes it, for a specimen. */
export const LiveEnvelope = Schema.Struct({ specimen: Schema.String, event: Schema.String });
export type LiveEnvelope = typeof LiveEnvelope.Type;

const decodeEnvelope = Schema.decodeUnknownOption(LiveEnvelope);

/** The browser's BroadcastChannel, absent on a server or in an old browser. */
const channels = () => Option.fromNullishOr(globalThis.BroadcastChannel);

/** Posts a message to any observatory listening; a Command runs it. */
export const postLive = (envelope: LiveEnvelope): void =>
  Option.match(channels(), {
    onNone: () => undefined,
    onSome: (Channel) => {
      const channel = new Channel(channelName);
      channel.postMessage(envelope);
      channel.close();
    },
  });

const listen = (queue: Queue.Queue<LiveEnvelope, Cause.Done>) => {
  const open = Effect.sync(() =>
    Option.match(channels(), {
      onNone: () => () => undefined,
      onSome: (Channel) => {
        const channel = new Channel(channelName);
        channel.onmessage = ({ data }: MessageEvent<unknown>) =>
          Option.map(decodeEnvelope(data), (envelope) => Queue.offerUnsafe(queue, envelope));
        return () => channel.close();
      },
    }),
  );
  return Effect.acquireRelease(open, Effect.sync);
};

/** Every message reported while the stream runs; malformed ones are dropped at the boundary. */
export const liveEnvelopes: Stream.Stream<LiveEnvelope> = Stream.callback<LiveEnvelope>(listen);
