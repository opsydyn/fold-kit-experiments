import { commitGraph } from './editor';
import { finitePoint } from './geometry';
import { copyGraph, FlowError } from './graph';
import type { EditorState, LayoutRequest, LayoutResult } from './types';

/** Store this request as active in the host Model before starting the engine. */
export function layoutRequest(state: EditorState, requestId: string): LayoutRequest {
  if (requestId.length === 0)
    throw new FlowError('invalid-layout', 'Layout request ID must be non-empty');
  return { requestId, revision: state.revision, graph: copyGraph(state.graph) };
}
/** Pass the currently active request, never the one captured by a completion closure. */
export function applyLayout(
  state: EditorState,
  active: LayoutRequest,
  result: LayoutResult,
): EditorState {
  if (
    state.readOnly ||
    state.gesture.type !== 'idle' ||
    result.requestId !== active.requestId ||
    result.revision !== active.revision ||
    state.revision !== active.revision
  )
    return state;
  const positions = new Map(result.positions.map((position) => [position.id, position]));
  if (
    positions.size !== result.positions.length ||
    positions.size !== state.graph.nodes.length ||
    state.graph.nodes.some((node) => !positions.has(node.id))
  )
    throw new FlowError('invalid-layout', 'Layout must contain every node exactly once');
  for (const position of positions.values()) finitePoint(position);
  const routes = new Set<string>();
  for (const route of result.routes) {
    if (
      routes.has(route.id) ||
      !state.graph.edges.some((edge) => edge.id === route.id) ||
      route.points.length < 2
    )
      throw new FlowError('invalid-layout', 'Invalid edge route');
    route.points.forEach(finitePoint);
    routes.add(route.id);
  }
  const graph = {
    ...state.graph,
    nodes: state.graph.nodes.map((node) => {
      const position = positions.get(node.id);
      if (!position) throw new FlowError('invalid-layout', `Missing node ${node.id}`);
      const size = position.size ?? node.size;
      if (
        position.size &&
        (node.kind !== 'group' ||
          !Number.isFinite(size.width) ||
          !Number.isFinite(size.height) ||
          size.width <= 0 ||
          size.height <= 0)
      )
        throw new FlowError('invalid-layout', `Invalid layout size for ${node.id}`);
      return { ...node, size: { ...size }, position: { x: position.x, y: position.y } };
    }),
  };
  return {
    ...commitGraph(state, graph),
    routes: result.routes.map((route) => ({
      id: route.id,
      points: route.points.map((point) => ({ ...point })),
    })),
    notice: 'Layout applied',
  };
}
