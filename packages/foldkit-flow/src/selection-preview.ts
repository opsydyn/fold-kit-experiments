import { boxBounds } from './geometry';
import type { EditorState, FlowNode, Gesture } from './types';

export type BoxSelectionPreview = Readonly<{
  bounds: Readonly<ReturnType<typeof boxBounds>>;
  previewNodeIds: readonly string[];
}>;

/** Shared selection resolution for the visible preview and final pointer release. */
export function resolveBoxSelection(
  state: EditorState,
  gesture: Extract<Gesture, { type: 'box-selection' }>,
  nodes: readonly FlowNode[],
): BoxSelectionPreview {
  const bounds = boxBounds(gesture.origin, gesture.point);
  const collapsed = new Set(state.collapsedGroups);
  const partial = state.boxSelectionMatch === 'partial';
  const hasArea = bounds.left < bounds.right && bounds.top < bounds.bottom;
  const matched = nodes.filter((node) => {
    const { x, y } = node.position;
    const right = x + node.size.width;
    const bottom = y + node.size.height;
    // Expanded groups keep enclosure semantics so a marquee can select their children.
    if (partial && (node.kind !== 'group' || collapsed.has(node.id)))
      return (
        hasArea &&
        x < bounds.right &&
        y < bounds.bottom &&
        right > bounds.left &&
        bottom > bounds.top
      );
    return x >= bounds.left && y >= bounds.top && right <= bounds.right && bottom <= bounds.bottom;
  });
  const matchedIds = new Set(matched.map((node) => node.id));
  const byId = new Map(state.graph.nodes.map((node) => [node.id, node]));
  const previewNodeIds = matched
    .filter((node) => {
      let parent = node.parentId;
      while (parent !== undefined) {
        if (matchedIds.has(parent)) return false;
        parent = byId.get(parent)?.parentId;
      }
      return true;
    })
    .map((node) => node.id);
  return { bounds, previewNodeIds };
}
