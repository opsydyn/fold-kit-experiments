import { resolveDeletion } from './deletion';
import { portEditReason } from './port-edit';
import type { EditorPolicy, Endpoint, FlowGraph, PortRemovalDecision } from './types';

/** Authorizes a direct port edit and the complete attached-edge deletion before removal. */
export function resolvePortRemoval(
  graph: FlowGraph,
  endpoint: Endpoint,
  canDelete?: EditorPolicy['canDelete'],
  canEditPort?: EditorPolicy['canEditPort'],
): PortRemovalDecision {
  const node = graph.nodes.find(({ id }) => id === endpoint.node);
  const port = node?.ports.find(({ id }) => id === endpoint.port);
  if (!node || !port) return { type: 'empty' };
  const reason = portEditReason({ operation: 'remove', node, port }, graph, canEditPort);
  if (reason !== null) return { type: 'blocked', reason };
  const edges = graph.edges.filter(
    (edge) =>
      (edge.source.node === endpoint.node && edge.source.port === endpoint.port) ||
      (edge.target.node === endpoint.node && edge.target.port === endpoint.port),
  );
  const decision = resolveDeletion(
    graph,
    { nodeIds: [], edgeIds: edges.map(({ id }) => id) },
    canDelete,
  );
  if (decision.type === 'blocked') return decision;
  return { type: 'allowed', node, port, edges };
}
