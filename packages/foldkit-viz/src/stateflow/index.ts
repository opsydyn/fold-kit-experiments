import { runForceLayout } from '../simulation';

export type StateFlowNodeRole = 'initial' | 'normal' | 'active' | 'error' | 'transient';
export type StateFlowGuard = 'unguarded' | 'when' | 'otherwise';

export type StateFlowNode = Readonly<{
  id: string;
  label: string;
  role: StateFlowNodeRole;
  visitCount: number;
}>;

export type StateFlowEdge = Readonly<{
  id: string;
  source: string;
  target: string;
  event: string;
  guard: StateFlowGuard;
  guardPosition?: number;
  transitionCount: number;
  lastSeenAt?: number;
}>;

export type StateFlowGraph = Readonly<{
  nodes: ReadonlyArray<StateFlowNode>;
  edges: ReadonlyArray<StateFlowEdge>;
}>;

export type StateFlowLayoutNode = Readonly<
  StateFlowNode & {
    x: number;
    y: number;
  }
>;

export type StateFlowLayoutEdge = Readonly<
  StateFlowEdge & {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
>;

export type StateFlowLayout = Readonly<{
  nodes: ReadonlyArray<StateFlowLayoutNode>;
  edges: ReadonlyArray<StateFlowLayoutEdge>;
}>;

export type StateFlowLayoutOptions = Readonly<{
  width?: number;
  height?: number;
  strength?: number;
  linkDistance?: number;
  collideRadius?: number;
  iterations?: number;
}>;

const assertUniqueIds = (kind: 'node' | 'edge', ids: ReadonlyArray<string>): void => {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ${kind} ID: ${id}`);
    }
    seen.add(id);
  }
};

const validateGraph = (graph: StateFlowGraph): void => {
  assertUniqueIds(
    'node',
    graph.nodes.map(({ id }) => id),
  );
  assertUniqueIds(
    'edge',
    graph.edges.map(({ id }) => id),
  );

  const nodeIds = new Set(graph.nodes.map(({ id }) => id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) {
      throw new Error(`Edge ${edge.id} references unknown node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      throw new Error(`Edge ${edge.id} references unknown node: ${edge.target}`);
    }
  }
};

const positionFor = (
  positions: ReadonlyMap<string, Readonly<{ x: number; y: number }>>,
  id: string,
  error: string,
): Readonly<{ x: number; y: number }> => {
  const position = positions.get(id);
  if (!position) {
    throw new Error(error);
  }
  return position;
};

const layoutEdge = (
  edge: StateFlowEdge,
  positions: ReadonlyMap<string, Readonly<{ x: number; y: number }>>,
): StateFlowLayoutEdge => {
  const source = positionFor(
    positions,
    edge.source,
    `Layout is missing endpoint position for edge: ${edge.id}`,
  );
  const target = positionFor(
    positions,
    edge.target,
    `Layout is missing endpoint position for edge: ${edge.id}`,
  );
  return { ...edge, x1: source.x, y1: source.y, x2: target.x, y2: target.y };
};

export function layoutStateFlow(
  graph: StateFlowGraph,
  options: StateFlowLayoutOptions = {},
): StateFlowLayout {
  validateGraph(graph);

  const layout = runForceLayout({
    nodes: graph.nodes,
    links: graph.edges,
    ...options,
  });
  const positions = new Map(layout.nodes.map((node) => [node.id, node]));

  const nodes = graph.nodes.map((node) => ({
    ...node,
    ...positionFor(positions, node.id, `Layout is missing position for node: ${node.id}`),
  }));
  const edges = graph.edges.map((edge) => layoutEdge(edge, positions));

  return { nodes, edges };
}
