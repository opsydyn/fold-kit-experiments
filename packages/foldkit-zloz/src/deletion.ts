import { withDescendants } from './group-presentation';
import type { DeletionDecision, DeletionTargets, EditorPolicy, ZlozGraph } from './types';

/** Resolves an atomic deletion against the full document, including collapsed descendants. */
export function resolveDeletion(
  graph: ZlozGraph,
  targets: DeletionTargets,
  canDelete?: EditorPolicy['canDelete'],
): DeletionDecision {
  if (targets.nodeIds.length === 0 && targets.edgeIds.length === 0) return { type: 'empty' };
  const nodeIds = withDescendants(graph, targets.nodeIds);
  const edgeIds = new Set(targets.edgeIds);
  const candidate = {
    nodes: graph.nodes.filter((node) => nodeIds.has(node.id)),
    edges: graph.edges.filter(
      (edge) =>
        edgeIds.has(edge.id) || nodeIds.has(edge.source.node) || nodeIds.has(edge.target.node),
    ),
  };
  if (!candidate.nodes.length && !candidate.edges.length) return { type: 'empty' };
  const reason = canDelete?.(candidate, graph) ?? null;
  return reason === null
    ? { type: 'allowed', candidate }
    : { type: 'blocked', reason: reason.trim() || 'This deletion is protected.' };
}
