import * as Cloudflare from '@alchemy.run/cloudflare';
import { Clock, Effect } from 'effect';

export interface DiagramPeer {
  readonly connectionId: string;
  readonly actorId: string;
  readonly name: string;
  readonly selection: readonly string[];
  readonly cursor: { readonly x: number; readonly y: number } | null;
  readonly seenAt: number;
}
/** Constructed per DO instance, never a module-level mutable peer collection. */
const presenceInstance = Effect.sync(() => {
  const peers = new Map<string, DiagramPeer>();
  return {
    heartbeat: (peer: Omit<DiagramPeer, 'seenAt'>) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        for (const [id, item] of peers) if (now - item.seenAt >= 15_000) peers.delete(id);
        const key = `${peer.actorId}:${peer.connectionId}`;
        if (peers.has(key) || peers.size < 32) peers.set(key, { ...peer, seenAt: now });
        return [...peers.values()];
      }),
  };
});
/** Volatile per-diagram data. Restart and TTL both remove it; never stored in SQL. */
export class DiagramPresence extends Cloudflare.DurableObject<DiagramPresence>()(
  'ZlozDiagramPresenceV1',
  Effect.sync(() => presenceInstance),
) {}
