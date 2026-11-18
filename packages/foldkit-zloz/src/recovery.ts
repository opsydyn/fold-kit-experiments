import { copyGraph, validateGraph, ZlozError } from './graph';
import { canonicalOperationValue } from './operation-codec';
import type { ZlozOperationDocument } from './operation-types';
import { isOperationDocument } from './operations';
import type { ZlozGraph } from './types';

export type ZlozRecoveryDecision = Readonly<{
  status: 'restored' | 'conflict' | 'unchanged';
  document: ZlozOperationDocument;
}>;
/** Privileged hosts authorize this separately; ordinary graph operations cannot invoke it. */
export function recoverOperationDocument(
  current: ZlozOperationDocument,
  checkpoint: ZlozGraph,
  expectedVersion: number,
): ZlozRecoveryDecision {
  if (
    !isOperationDocument(current) ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  )
    throw new ZlozError('invalid-edit', 'Invalid recovery version or document');
  const graph = copyGraph(checkpoint);
  validateGraph(graph);
  if (current.version !== expectedVersion) return { status: 'conflict', document: current };
  if (canonicalOperationValue(current.graph) === canonicalOperationValue(graph))
    return { status: 'unchanged', document: current };
  const version = current.version + 1;
  if (!Number.isSafeInteger(version))
    throw new ZlozError('invalid-edit', 'Recovery version is exhausted');
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  const nodes = new Set([...current.nodes.map((node) => node.id), ...nodeIds]);
  const edges = new Set([...current.edges.map((edge) => edge.id), ...edgeIds]);
  return {
    status: 'restored',
    document: {
      version,
      graph,
      nodes: [...nodes].map((id) => ({
        id,
        present: nodeIds.has(id),
        version,
        geometry: version,
        label: version,
        ports: version,
      })),
      edges: [...edges].map((id) => ({ id, present: edgeIds.has(id), version })),
      undo: [],
    },
  };
}
