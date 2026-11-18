import type { ZlozGraphOperation, ZlozOperationDocument } from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

const Targets = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    expected: Schema.Number,
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  }),
).pipe(Schema.check(Schema.isMinLength(1)));
export const QueuedMove = defineTaggedUnion({
  Ready: { nodes: Targets },
  Blocked: { nodes: Targets },
});
export type QueuedMove = typeof QueuedMove.Type;

export const isGeometryOperation = (operation: ZlozGraphOperation) =>
  operation.type === 'MoveNodes' || operation.type === 'ResizeNodes';

/** Coalesce unsent absolute positions only; an in-flight request is never changed. */
export function appendMove(
  previous: QueuedMove | null,
  operation: Extract<ZlozGraphOperation, { type: 'MoveNodes' }>,
): QueuedMove {
  const nodes = new Map(previous?.nodes.map((node) => [node.id, node]) ?? []);
  for (const node of operation.nodes) nodes.set(node.id, node);
  return QueuedMove.Ready({ nodes: [...nodes.values()] });
}

/** Advance only clocks proven to belong to this tab's acknowledged geometry operation. */
export function advanceQueuedMove(
  queue: QueuedMove,
  operation: ZlozGraphOperation,
  version: number,
  confirmed: ZlozOperationDocument,
): QueuedMove {
  if (
    queue._tag === 'Blocked' ||
    (operation.type !== 'MoveNodes' && operation.type !== 'ResizeNodes')
  )
    return queue;
  const owned = new Map(operation.nodes.map((node) => [node.id, node.expected]));
  const clocks = new Map(confirmed.nodes.map((clock) => [clock.id, clock]));
  return QueuedMove.Ready({
    nodes: queue.nodes.map((node) =>
      owned.get(node.id) === node.expected && clocks.get(node.id)?.geometry === version
        ? { ...node, expected: version }
        : node,
    ),
  });
}

/** A gesture keeps its visual start graph; only proven owned clocks may advance underneath it. */
export function advanceGestureBase(
  base: ZlozOperationDocument | null,
  operation: ZlozGraphOperation,
  version: number,
  confirmed: ZlozOperationDocument,
): ZlozOperationDocument | null {
  if (!base || (operation.type !== 'MoveNodes' && operation.type !== 'ResizeNodes')) return base;
  const owned = new Map(operation.nodes.map((node) => [node.id, node.expected]));
  const clocks = new Map(confirmed.nodes.map((clock) => [clock.id, clock]));
  return {
    ...base,
    version: Math.max(base.version, version),
    nodes: base.nodes.map((clock) =>
      owned.get(clock.id) === clock.geometry && clocks.get(clock.id)?.geometry === version
        ? { ...clock, version: Math.max(clock.version, version), geometry: version }
        : clock,
    ),
  };
}
