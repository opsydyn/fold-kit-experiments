import type { FlowEdge, FlowGraph, FlowNode, Point } from './types';

const collapsedSize = { width: 224, height: 56 };

/** Presentation only. The authored nodes and endpoints remain in the document. */
export function presentGroups(graph: FlowGraph, collapsedGroups: readonly string[]) {
  const hiddenBy = new Map<string, FlowNode>();
  if (collapsedGroups.length === 0) return { nodes: graph.nodes, hiddenBy };

  const collapsed = new Set(collapsedGroups);
  const byId = new Map(
    graph.nodes.map((node) => [
      node.id,
      collapsed.has(node.id) ? { ...node, size: collapsedSize } : node,
    ]),
  );
  const nodes = [];
  for (const node of byId.values()) {
    let parent = node.parentId;
    let boundary: FlowNode | undefined;
    while (parent !== undefined) {
      const group = byId.get(parent);
      if (group && collapsed.has(parent)) boundary = group;
      parent = group?.parentId;
    }
    if (boundary) hiddenBy.set(node.id, boundary);
    else nodes.push(node);
  }
  return { nodes, hiddenBy };
}

export function edgeIsVisible(edge: FlowEdge, hiddenBy: ReadonlyMap<string, FlowNode>): boolean {
  const sourceGroup = hiddenBy.get(edge.source.node);
  return !sourceGroup || sourceGroup !== hiddenBy.get(edge.target.node);
}

/** Parents paint below nested groups. Siblings keep document order. */
export function groupsInPaintOrder(nodes: readonly FlowNode[]): FlowNode[] {
  const groups = nodes.filter((node) => node.kind === 'group');
  const byId = new Map(groups.map((group) => [group.id, group]));
  function depth(node: FlowNode): number {
    const parent = node.parentId === undefined ? undefined : byId.get(node.parentId);
    return parent ? depth(parent) + 1 : 0;
  }
  return groups.sort((a, b) => depth(a) - depth(b));
}

export function groupAtDropPoint(
  nodes: readonly FlowNode[],
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

export function withDescendants(graph: FlowGraph, ids: readonly string[]): ReadonlySet<string> {
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
