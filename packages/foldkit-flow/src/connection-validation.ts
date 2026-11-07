import type { EdgeEnd, EditorPolicy, Endpoint, FlowEdge, FlowGraph } from './types';

export function portKind(graph: FlowGraph, endpoint: Endpoint) {
  return graph.nodes
    .find((node) => node.id === endpoint.node)
    ?.ports.find((port) => port.id === endpoint.port)?.kind;
}

export function connectionReason(
  graph: FlowGraph,
  edge: FlowEdge,
  policy: EditorPolicy,
  replaced?: Readonly<{ id: string; end: EdgeEnd }>,
) {
  if (portKind(graph, edge.source) !== 'output' || portKind(graph, edge.target) !== 'input')
    return 'Choose a compatible port.';
  const sourceReason =
    replaced?.end === 'target' ? null : policy.canConnectPort?.(edge.source, graph);
  const portReason =
    sourceReason ??
    (replaced?.end === 'source' ? null : policy.canConnectPort?.(edge.target, graph)) ??
    null;
  if (portReason !== null) return portReason;
  const remaining = graph.edges.filter((item) => item.id !== replaced?.id);
  if (
    remaining.some(
      (item) =>
        item.source.node === edge.source.node &&
        item.source.port === edge.source.port &&
        item.target.node === edge.target.node &&
        item.target.port === edge.target.port,
    )
  )
    return 'These ports are already connected';
  return policy.canConnect?.(edge, { ...graph, edges: remaining }) ?? null;
}
