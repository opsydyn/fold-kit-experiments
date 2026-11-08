import type { EditorState, ZlozEdge, ZlozGraph, ZlozNode, Point } from './types';

const collapsedSize = { width: 224, height: 56 };

/** Presentation only. The authored nodes and endpoints remain in the document. */
export function presentGroups(
  graph: ZlozGraph,
  collapsedGroups: readonly string[],
  hiddenNodeIds?: readonly string[],
) {
  const excludedNodes = hiddenNodeIds?.length ? withDescendants(graph, hiddenNodeIds) : undefined;
  const authored = excludedNodes
    ? graph.nodes.filter((node) => !excludedNodes.has(node.id))
    : graph.nodes;
  const hiddenBy = new Map<string, ZlozNode>();
  if (collapsedGroups.length === 0) return { nodes: authored, hiddenBy, excludedNodes };

  const collapsed = new Set(collapsedGroups);
  const byId = new Map(
    authored.map((node) => [
      node.id,
      collapsed.has(node.id) ? { ...node, size: collapsedSize } : node,
    ]),
  );
  const nodes = [];
  for (const node of byId.values()) {
    let parent = node.parentId;
    let boundary: ZlozNode | undefined;
    while (parent !== undefined) {
      const group = byId.get(parent);
      if (group && collapsed.has(parent)) boundary = group;
      parent = group?.parentId;
    }
    if (boundary) hiddenBy.set(node.id, boundary);
    else nodes.push(node);
  }
  return { nodes, hiddenBy, excludedNodes };
}

export function edgeIsVisible(edge: ZlozEdge, hiddenBy: ReadonlyMap<string, ZlozNode>): boolean {
  const sourceGroup = hiddenBy.get(edge.source.node);
  return !sourceGroup || sourceGroup !== hiddenBy.get(edge.target.node);
}

type PresentationState = Pick<EditorState, 'graph' | 'collapsedGroups' | 'visibility'>;

export function presentEditorGroups(state: PresentationState, graph = state.graph) {
  return presentGroups(graph, state.collapsedGroups, state.visibility?.hiddenNodeIds);
}

/** Nodes that can be revealed, including descendants of collapsed groups. */
export function revealableNodes(
  state: Pick<EditorState, 'graph' | 'visibility'>,
): readonly ZlozNode[] {
  return presentGroups(state.graph, [], state.visibility?.hiddenNodeIds).nodes;
}

/** Compose filtering and collapse without changing authored nodes or endpoints. */
export function presentVisibleGraph(state: PresentationState) {
  const { graph, visibility } = state;
  const presentation = presentEditorGroups(state);
  const { excludedNodes, hiddenBy } = presentation;
  const hiddenEdges = visibility?.hiddenEdgeIds?.length
    ? new Set(visibility.hiddenEdgeIds)
    : undefined;
  const edges = graph.edges.filter(
    (edge) =>
      !hiddenEdges?.has(edge.id) &&
      !excludedNodes?.has(edge.source.node) &&
      !excludedNodes?.has(edge.target.node) &&
      edgeIsVisible(edge, hiddenBy),
  );
  return { ...presentation, edges };
}

/** Connections that can be revealed, including those inside collapsed groups. */
export function revealableEdges(
  state: Pick<EditorState, 'graph' | 'visibility'>,
): readonly ZlozEdge[] {
  return presentVisibleGraph({ ...state, collapsedGroups: [] }).edges;
}

/** Parents paint below nested groups. Siblings keep document order. */
export function groupsInPaintOrder(nodes: readonly ZlozNode[]): ZlozNode[] {
  const groups = nodes.filter((node) => node.kind === 'group');
  const byId = new Map(groups.map((group) => [group.id, group]));
  function depth(node: ZlozNode): number {
    const parent = node.parentId === undefined ? undefined : byId.get(node.parentId);
    return parent ? depth(parent) + 1 : 0;
  }
  return groups.sort((a, b) => depth(a) - depth(b));
}

export function groupAtDropPoint(
  nodes: readonly ZlozNode[],
  collapsedGroups: readonly string[],
  moving: ReadonlySet<string>,
  point: Point,
): string | null {
  const collapsed = new Set(collapsedGroups);
  return (
    groupsInPaintOrder(nodes)
      .reverse()
      .find(
        (group) =>
          !moving.has(group.id) &&
          !collapsed.has(group.id) &&
          point.x >= group.position.x &&
          point.x <= group.position.x + group.size.width &&
          point.y >= group.position.y &&
          point.y <= group.position.y + group.size.height,
      )?.id ?? null
  );
}

export function withDescendants(graph: ZlozGraph, ids: readonly string[]): ReadonlySet<string> {
  const children = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (node.parentId === undefined) continue;
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node.id);
    children.set(node.parentId, siblings);
  }
  const included = new Set(ids);
  for (const id of included) {
    for (const child of children.get(id) ?? []) included.add(child);
  }
  return included;
}
