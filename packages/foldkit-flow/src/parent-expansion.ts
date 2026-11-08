import type { FlowGraph } from './types';

const padding = 16;

/** Grow enabled ancestors without moving their contents in canvas coordinates. */
export function expandParents(graph: FlowGraph, childId: string): FlowGraph {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  let child = byId.get(childId);
  let changed = false;
  while (child?.expandParent && child.parentId !== undefined) {
    const parent = byId.get(child.parentId);
    if (!parent) break;
    const childRight = child.position.x + child.size.width;
    const childBottom = child.position.y + child.size.height;
    const parentRight = parent.position.x + parent.size.width;
    const parentBottom = parent.position.y + parent.size.height;
    const left =
      child.position.x < parent.position.x ? child.position.x - padding : parent.position.x;
    const top =
      child.position.y < parent.position.y ? child.position.y - padding : parent.position.y;
    const right = childRight > parentRight ? childRight + padding : parentRight;
    const bottom = childBottom > parentBottom ? childBottom + padding : parentBottom;
    if (
      left !== parent.position.x ||
      top !== parent.position.y ||
      right !== parentRight ||
      bottom !== parentBottom
    ) {
      const expanded = {
        ...parent,
        position: { x: left, y: top },
        size: { width: right - left, height: bottom - top },
      };
      byId.set(parent.id, expanded);
      child = expanded;
      changed = true;
    } else child = parent;
  }
  return changed
    ? { ...graph, nodes: graph.nodes.map((node) => byId.get(node.id) ?? node) }
    : graph;
}
