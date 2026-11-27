import { UiSchema } from '@effect/ui';
import type { DiagramFeed } from '@opsydyn/foldkit-zloz-alchemy/delta';
import type { DiagramRoom, DiagramSession } from '@opsydyn/foldkit-zloz-alchemy/session';
import { Schema } from 'effect';

export const ReconnectDelay = Schema.Literals([0, 1000]);
export const SocketSlot = Schema.Literals(['a', 'b']);
export type SocketSlot = typeof SocketSlot.Type;
export const Connection = UiSchema.TaggedEnum({
  Opening: {},
  Live: {},
  Handoff: { previousRun: Schema.Number, previousDelayMs: ReconnectDelay },
  Reconnecting: {},
  Denied: {},
});
type FeedState = {
  readonly connection: typeof Connection.Type;
  readonly socketRun: number;
  readonly socketSlot: SocketSlot;
  readonly reconnectDelayMs: typeof ReconnectDelay.Type;
};
export const otherSlot = (slot: SocketSlot): SocketSlot => (slot === 'a' ? 'b' : 'a');
export const isLiveConnection = (connection: typeof Connection.Type) =>
  connection._tag === 'Live' || connection._tag === 'Handoff';

/** Stable slots keep an opening replacement alive when it becomes primary. */
export function feedDescriptor(model: FeedState, slot: SocketSlot) {
  const single = () => ({
    run: model.socketRun,
    delay: model.reconnectDelayMs,
    active: model.socketSlot === slot,
  });
  return Connection.match(model.connection, {
    Opening: single,
    Live: single,
    Reconnecting: single,
    Denied: () => ({ run: 0, delay: 0 as const, active: false }),
    Handoff: ({ previousRun, previousDelayMs }) => ({
      run: slot === model.socketSlot ? previousRun : model.socketRun,
      delay: slot === model.socketSlot ? previousDelayMs : model.reconnectDelayMs,
      active: true,
    }),
  });
}

type BoardFeedState = FeedState &
  Readonly<{
    room: DiagramRoom;
    feedMode: 'legacy' | 'delta';
    feedSeeds: ReadonlyArray<Readonly<{ run: number; feed: DiagramFeed }>>;
    session: Pick<DiagramSession, 'confirmed'>;
  }>;

/** A feed stays bound to its HTTP snapshot cursor for the lifetime of its socket run. */
export function boardFeedBinding(model: BoardFeedState, slot: SocketSlot) {
  const descriptor = feedDescriptor(model, slot);
  const seed = model.feedSeeds.find((entry) => entry.run === descriptor.run);
  return {
    ...descriptor,
    room: model.room,
    after: model.feedMode === 'delta' && seed ? seed.feed.cursor : null,
    active:
      descriptor.active &&
      Boolean(model.room.generation) &&
      model.session.confirmed !== null &&
      (model.feedMode === 'legacy' || Boolean(seed)),
  };
}
