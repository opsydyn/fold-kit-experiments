import { resolveDeletion } from './deletion';
import type { EditorPolicy, Endpoint, FlowGraph, PortRemovalDecision } from './types';

/** Authorizes the complete attached-edge deletion before removing an authored port. */
export function resolvePortRemoval(
  graph: FlowGraph,
  endpoint: Endpoint,
  canDelete?: EditorPolicy['canDelete'],
): PortRemovalDecision {
  const node = graph.nodes.find(({ id }) => id === endpoint.node);
  const port = node?.ports.find(({ id }) => id === endpoint.port);
  if (!node || !port) return { type: 'empty' };
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
