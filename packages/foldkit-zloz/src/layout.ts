import { commitGraph } from './editor';
import { finitePoint } from './geometry';
import { copyGraph, validateGraph, ZlozError } from './graph';
import type { EditorState, LayoutRequest, LayoutResult, LayoutRequestOptions } from './types';

/** Validate a typed engine request, including explicit label envelopes. Not a raw-data decoder. */
export function validateLayoutRequest(request: LayoutRequest): void {
  validateGraph(request.graph);
  if (!request.requestId.trim() || !Number.isSafeInteger(request.revision) || request.revision < 0)
    throw new ZlozError('invalid-layout', 'Invalid layout request identity');
  const seen = new Set<string>();
  for (const label of request.edgeLabels ?? []) {
    if (
      seen.has(label.id) ||
      !request.graph.edges.some((e) => e.id === label.id) ||
      !Number.isFinite(label.size.width) ||
      !Number.isFinite(label.size.height) ||
      label.size.width <= 0 ||
      label.size.height <= 0
    )
      throw new ZlozError(
        'invalid-layout',
        'Label bounds require unique existing edges and positive finite dimensions',
      );
    seen.add(label.id);
  }
}
/** Store this request as active in the host Model before starting the engine. */
export function layoutRequest(
  state: EditorState,
  requestId: string,
  options: LayoutRequestOptions = {},
): LayoutRequest {
  const base = { requestId, revision: state.revision, graph: copyGraph(state.graph) };
  const request =
    options.edgeLabels === undefined
      ? base
      : {
          ...base,
          edgeLabels: options.edgeLabels.map((label) => ({
            id: label.id,
            size: { ...label.size },
          })),
        };
  validateLayoutRequest(request);
  return request;
}
function currentResult(state: EditorState, active: LayoutRequest, result: LayoutResult): boolean {
  return (
    state.gesture.type === 'idle' &&
    result.requestId === active.requestId &&
    result.revision === active.revision &&
    state.revision === active.revision
  );
}
function geometry(state: EditorState, active: LayoutRequest, result: LayoutResult) {
  validateLayoutRequest(active);
  const labels = new Map((active.edgeLabels ?? []).map((label) => [label.id, label]));
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
    const expected = labels.get(route.id);
    if (route.label) {
      finitePoint(route.label.position);
      if (
        !expected ||
        !Number.isFinite(route.label.size.width) ||
        !Number.isFinite(route.label.size.height) ||
        route.label.size.width !== expected.size.width ||
        route.label.size.height !== expected.size.height
      )
        throw new ZlozError('invalid-layout', 'Layout label envelope does not match its request');
    } else if (expected)
      throw new ZlozError('invalid-layout', 'Layout omitted a declared label envelope');
    routes.add(route.id);
  }
  if ([...labels.keys()].some((id) => !routes.has(id)))
    throw new ZlozError('invalid-layout', 'Layout omitted a declared label route');
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
    routes: result.routes.map((route) => {
      const base = { id: route.id, points: route.points.map((point) => ({ ...point })) };
      return route.label
        ? {
            ...base,
            label: { position: { ...route.label.position }, size: { ...route.label.size } },
          }
        : base;
    }),
  };
}
/** Pass the currently active request, never the one captured by a completion closure. */
export function applyLayout(
  state: EditorState,
  active: LayoutRequest,
  result: LayoutResult,
): EditorState {
  if (state.readOnly || !currentResult(state, active, result)) return state;
  const next = geometry(state, active, result);
  return { ...commitGraph(state, next.graph), routes: next.routes, notice: 'Layout applied' };
}
/** Geometry-only layout for a detached read-only preview. Advances revision without appending Undo. */
export function applyPreviewLayout(
  state: EditorState,
  active: LayoutRequest,
  result: LayoutResult,
): EditorState {
  if (!state.readOnly || !currentResult(state, active, result)) return state;
  const next = geometry(state, active, result);
  return {
    ...state,
    graph: next.graph,
    routes: next.routes,
    revision: state.revision + 1,
    fitViewTransition: { type: 'idle', id: state.fitViewTransition.id },
    notice: 'Preview layout applied',
  };
}
