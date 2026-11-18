import type { ZlozGraph, ZlozGraphOperation, ZlozOperationDocument } from '@opsydyn/foldkit-zloz';
import type { DiagramSession } from '@opsydyn/foldkit-zloz-alchemy/session';

/** Display-only pending geometry; confirmed state and operation clocks stay authoritative. */
export function pendingGeometryGraph(
  document: ZlozOperationDocument,
  pending: DiagramSession['pending'],
): ZlozGraph {
  return geometryGraph(document, pending?.request.operation);
}

export function geometryGraph(
  document: ZlozOperationDocument,
  operation?: ZlozGraphOperation,
): ZlozGraph {
  const graph = document.graph;
  if (!operation) return graph;
  if (operation.type !== 'MoveNodes' && operation.type !== 'ResizeNodes') return graph;
  const clocks = new Map(document.nodes.map((clock) => [clock.id, clock]));
  // Moves/resizes are atomic. Do not mask an intervening geometry change or
  // resurrect deleted nodes, even when the original reply is still in flight.
  if (
    !operation.nodes.every(({ id, expected }) => {
      const clock = clocks.get(id);
      return clock?.present && clock.geometry === expected;
    })
  )
    return graph;
  if (operation.type === 'MoveNodes') {
    const positions = new Map(operation.nodes.map((node) => [node.id, node.position]));
    return {
      ...graph,
      nodes: graph.nodes.map((node) => {
        const position = positions.get(node.id);
        return position ? { ...node, position } : node;
      }),
    };
  }
  const frames = new Map(operation.nodes.map((node) => [node.id, node.frame]));
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const frame = frames.get(node.id);
      return frame ? { ...node, position: frame.position, size: frame.size } : node;
    }),
  };
}
