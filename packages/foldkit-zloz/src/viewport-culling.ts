import { screenToWorld } from './geometry';
import type { EditorState, ZlozEdge, ZlozNode, Point } from './types';

export type ZlozViewportCulling = boolean | Readonly<{ overscan?: number }>;

type Bounds = { left: number; top: number; right: number; bottom: number };

function nodeBounds(node: ZlozNode): Bounds {
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + node.size.width,
    bottom: node.position.y + node.size.height,
  };
}

function intersects(a: Bounds, b: Bounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export function viewportItems(
  state: EditorState,
  presentation: Readonly<{
    nodes: readonly ZlozNode[];
    edges: readonly ZlozEdge[];
    hiddenBy: ReadonlyMap<string, ZlozNode>;
  }>,
  routes: ReadonlyMap<string, readonly Point[]>,
  keepCustomEdges: boolean,
  culling?: ZlozViewportCulling,
) {
  if (!culling || !state.surface) return presentation;
  const overscan = culling === true ? 96 : (culling.overscan ?? 96);
  if (!Number.isFinite(overscan) || overscan < 0)
    throw new RangeError('Viewport overscan must be finite and non-negative');
  const topLeft = screenToWorld({ x: -overscan, y: -overscan }, state.viewport);
  const bottomRight = screenToWorld(
    { x: state.surface.width + overscan, y: state.surface.height + overscan },
    state.viewport,
  );
  const viewport = { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y };

  const pinned = new Set(state.selectedNodes);
  if (state.focusedNodeId) pinned.add(state.focusedNodeId);
  if (state.context?.kind === 'node') pinned.add(state.context.id);
  if (state.connection) pinned.add(state.connection.node);
  const { gesture } = state;
  if (gesture.type === 'port-anchor-drag') pinned.add(gesture.endpoint.node);
  if (gesture.type === 'node-drag' || gesture.type === 'node-resize')
    for (const id of gesture.ids) pinned.add(id);
  if (gesture.type === 'node-drag' && gesture.dropParent) pinned.add(gesture.dropParent);
  if (gesture.type === 'connection-drag') {
    if (gesture.target) pinned.add(gesture.target.node);
    if (gesture.rejected) pinned.add(gesture.rejected.endpoint.node);
  }

  const bounds = new Map<string, Bounds>();
  const nodes = [];
  for (const node of presentation.nodes) {
    const rectangle = nodeBounds(node);
    bounds.set(node.id, rectangle);
    if (pinned.has(node.id) || intersects(rectangle, viewport)) nodes.push(node);
  }
  if (keepCustomEdges) return { nodes, edges: presentation.edges };
  const selectedEdges = new Set(state.selectedEdges);
  const endpointBounds = (id: string) => bounds.get(presentation.hiddenBy.get(id)?.id ?? id);
  const edges = presentation.edges.filter((edge) => {
    if (
      selectedEdges.has(edge.id) ||
      edge.label ||
      state.edgeLabelDraft?.id === edge.id ||
      (state.context?.kind === 'edge' && state.context.id === edge.id) ||
      (gesture.type === 'connection-drag' && gesture.reconnect?.id === edge.id)
    )
      return true;
    const source = endpointBounds(edge.source.node);
    const target = endpointBounds(edge.target.node);
    if (!source || !target) return true;
    const edgeBounds = {
      left: Math.min(source.left, target.left),
      top: Math.min(source.top, target.top),
      right: Math.max(source.right, target.right),
      bottom: Math.max(source.bottom, target.bottom),
    };
    // Built-in straight, stepped and smooth segments stay inside their endpoint envelope.
    // Routed paths can leave that envelope, so include every routed point.
    for (const point of routes.get(edge.id) ?? []) {
      edgeBounds.left = Math.min(edgeBounds.left, point.x);
      edgeBounds.top = Math.min(edgeBounds.top, point.y);
      edgeBounds.right = Math.max(edgeBounds.right, point.x);
      edgeBounds.bottom = Math.max(edgeBounds.bottom, point.y);
    }
    return intersects(edgeBounds, viewport);
  });
  return { nodes, edges };
}
