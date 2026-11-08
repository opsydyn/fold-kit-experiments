import type { EdgeEnd, EditorPolicy, Endpoint, ZlozEdge, ZlozGraph, Port } from './types';

type Replacement = Readonly<{ id: string; end: EdgeEnd }>;
type PortLookup = (endpoint: Endpoint) => Port['kind'] | undefined;

export function portKind(graph: ZlozGraph, endpoint: Endpoint) {
  return graph.nodes
    .find((node) => node.id === endpoint.node)
    ?.ports.find((port) => port.id === endpoint.port)?.kind;
}

// Share precedence and callback semantics between single commits and indexed chooser passes.
function resolveReason(
  graph: ZlozGraph,
  edge: ZlozEdge,
  policy: EditorPolicy,
  replaced: Replacement | undefined,
  kind: PortLookup,
  remainingGraph: () => ZlozGraph,
  duplicate: (edge: ZlozEdge, remaining: ZlozGraph) => boolean,
) {
  if (kind(edge.source) !== 'output' || kind(edge.target) !== 'input')
    return 'Choose a compatible port.';
  const sourceReason =
    replaced?.end === 'target' ? null : policy.canConnectPort?.(edge.source, graph);
  const portReason =
    sourceReason ??
    (replaced?.end === 'source' ? null : policy.canConnectPort?.(edge.target, graph)) ??
    null;
  if (portReason !== null) return portReason;
  const remaining = remainingGraph();
  if (duplicate(edge, remaining)) return 'These ports are already connected';
  return policy.canConnect?.(edge, remaining) ?? null;
}

export function connectionReason(
  graph: ZlozGraph,
  edge: ZlozEdge,
  policy: EditorPolicy,
  replaced?: Replacement,
) {
  return resolveReason(
    graph,
    edge,
    policy,
    replaced,
    (endpoint) => portKind(graph, endpoint),
    () => ({ ...graph, edges: graph.edges.filter((item) => item.id !== replaced?.id) }),
    (candidate, remaining) =>
      remaining.edges.some(
        (item) =>
          item.source.node === candidate.source.node &&
          item.source.port === candidate.source.port &&
          item.target.node === candidate.target.node &&
          item.target.port === candidate.target.port,
      ),
  );
}

const connectionKey = ({ source, target }: ZlozEdge) =>
  JSON.stringify([source.node, source.port, target.node, target.port]);

/** Internal, invocation-local facts only. Policy results are never cached. */
export function connectionValidation(
  graph: ZlozGraph,
  policy: EditorPolicy,
  replaced?: Replacement,
) {
  const nodes = new Map<string, Map<string, Port['kind']>>();
  for (const node of graph.nodes) {
    // Preserve first-match lookup semantics even for a stale, invalid host graph.
    if (nodes.has(node.id)) continue;
    const ports = new Map<string, Port['kind']>();
    for (const port of node.ports) if (!ports.has(port.id)) ports.set(port.id, port.kind);
    nodes.set(node.id, ports);
  }
  const remaining = { ...graph, edges: graph.edges.filter((edge) => edge.id !== replaced?.id) };
  const connections = new Set(remaining.edges.map(connectionKey));
  const kind: PortLookup = ({ node, port }) => nodes.get(node)?.get(port);
  return {
    portKind: kind,
    proposedEdge: (source: Endpoint, target: Endpoint) => {
      const ids = new Set(graph.edges.map(({ id }) => id));
      return { id: nextEdgeId((id) => ids.has(id)), source, target };
    },
    reason: (edge: ZlozEdge) =>
      resolveReason(
        graph,
        edge,
        policy,
        replaced,
        kind,
        () => remaining,
        (candidate) => connections.has(connectionKey(candidate)),
      ),
  };
}

function nextEdgeId(occupied: (id: string) => boolean) {
  let index = 1;
  while (occupied(`edge:${index}`)) index++;
  return `edge:${index}`;
}

export function proposedEdge(graph: ZlozGraph, source: Endpoint, target: Endpoint) {
  // Single commits/previews avoid allocating a full ID index when the first ID is free.
  return { id: nextEdgeId((id) => graph.edges.some((edge) => edge.id === id)), source, target };
}
