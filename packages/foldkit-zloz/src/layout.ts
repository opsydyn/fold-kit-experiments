import { commitGraph } from './editor';
import { finitePoint } from './geometry';
import { copyGraph, ZlozError } from './graph';
import type { EditorState, LayoutRequest, LayoutResult } from './types';

/** Store this request as active in the host Model before starting the engine. */
export function layoutRequest(state: EditorState, requestId: string): LayoutRequest {
  if (requestId.length === 0)
    throw new ZlozError('invalid-layout', 'Layout request ID must be non-empty');
  return { requestId, revision: state.revision, graph: copyGraph(state.graph) };
}
function currentResult(state: EditorState, active: LayoutRequest, result: LayoutResult): boolean {
  return (
    state.gesture.type === 'idle' &&
    result.requestId === active.requestId &&
    result.revision === active.revision &&
    state.revision === active.revision
  );
}
function geometry(state: EditorState, result: LayoutResult) {
  const positions = new Map(result.positions.map((position) => [position.id, position]));
  if (
    positions.size !== result.positions.length ||
    positions.size !== state.graph.nodes.length ||
    state.graph.nodes.some((node) => !positions.has(node.id))
  )
    throw new ZlozError('invalid-layout', 'Layout must contain every node exactly once');
  for (const position of positions.values()) finitePoint(position);
  const routes = new Set<string>();
  for (const route of result.routes) {
    if (
      routes.has(route.id) ||
      !state.graph.edges.some((edge) => edge.id === route.id) ||
      route.points.length < 2
    )
      throw new ZlozError('invalid-layout', 'Invalid edge route');
    route.points.forEach(finitePoint);
    routes.add(route.id);
  }
  const graph = {
    ...state.graph,
    nodes: state.graph.nodes.map((node) => {
      const position = positions.get(node.id);
      if (!position) throw new ZlozError('invalid-layout', `Missing node ${node.id}`);
      const size = position.size ?? node.size;
      if (
        position.size &&
        (node.kind !== 'group' ||
          !Number.isFinite(size.width) ||
          !Number.isFinite(size.height) ||
          size.width <= 0 ||
          size.height <= 0)
      )
        throw new ZlozError('invalid-layout', `Invalid layout size for ${node.id}`);
      return { ...node, size: { ...size }, position: { x: position.x, y: position.y } };
    }),
  };
  return {
    graph,
    routes: result.routes.map((route) => ({
      id: route.id,
      points: route.points.map((point) => ({ ...point })),
    })),
  };
}
/** Pass the currently active request, never the one captured by a completion closure. */
export function applyLayout(
  state: EditorState,
  active: LayoutRequest,
  result: LayoutResult,
): EditorState {
  if (state.readOnly || !currentResult(state, active, result)) return state;
  const next = geometry(state, result);
  return { ...commitGraph(state, next.graph), routes: next.routes, notice: 'Layout applied' };
}
/** Geometry-only layout for a detached read-only preview. Advances revision without appending Undo. */
export function applyPreviewLayout(
  state: EditorState,
  active: LayoutRequest,
  result: LayoutResult,
): EditorState {
  if (!state.readOnly || !currentResult(state, active, result)) return state;
  const next = geometry(state, result);
  return {
    ...state,
    graph: next.graph,
    routes: next.routes,
    revision: state.revision + 1,
    fitViewTransition: { type: 'idle', id: state.fitViewTransition.id },
    notice: 'Preview layout applied',
  };
}
