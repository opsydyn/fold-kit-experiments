import type { EditorPolicy, ZlozGraph } from './types';

/** Check the complete set of nodes that would travel together. */
export function movementReason(
  graph: ZlozGraph,
  moving: ReadonlySet<string>,
  canMoveNode: EditorPolicy['canMoveNode'],
): string | undefined {
  if (!canMoveNode) return undefined;
  for (const node of graph.nodes) {
    if (!moving.has(node.id)) continue;
    const reason = canMoveNode(node, graph);
    if (reason !== null) return reason;
  }
  return undefined;
}
