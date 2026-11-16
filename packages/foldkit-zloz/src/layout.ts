import { commitGraph } from './editor';
import { finitePoint } from './geometry';
import { copyGraphForConnectionMode, validateGraphForConnectionMode, ZlozError } from './graph';
import { resolveLayoutGroupHeader } from './group-header';
import type {
  EditorState,
  LayoutRequest,
  LayoutResult,
  LayoutRequestOptions,
  ZlozGraph,
} from './types';

/** Validate a typed engine request, including explicit label envelopes. Not a raw-data decoder. */
export function validateLayoutRequest(request: LayoutRequest): void {
  validateGraphForConnectionMode(request.graph, request.connectionMode ?? 'strict');
  validateLayoutHints(request.graph, request);
  if (!request.requestId.trim() || !Number.isSafeInteger(request.revision) || request.revision < 0)
    throw new ZlozError('invalid-layout', 'Invalid layout request identity');
}
/** @internal Shared geometry hints; graph capability validation belongs to each versioned entry. */
export function validateLayoutHints(graph: ZlozGraph, request: LayoutRequestOptions): void {
  const seen = new Set<string>();
  for (const label of request.edgeLabels ?? []) {
    if (
      seen.has(label.id) ||
      !graph.edges.some((e) => e.id === label.id) ||
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
  const groups = new Set<string>();
  for (const header of request.groupHeaders ?? []) {
    const node = graph.nodes.find((n) => n.id === header.id);
    if (!node || groups.has(header.id))
      throw new ZlozError('invalid-layout', 'Group header IDs must name unique existing groups');
    resolveLayoutGroupHeader(node, header);
    groups.add(header.id);
  }
}
/** Store this request as active in the host Model before starting the engine. */
export function layoutRequest(
  state: EditorState,
  requestId: string,
  options: LayoutRequestOptions = {},
): LayoutRequest {
  const base = {
    requestId,
    revision: state.revision,
    graph: copyGraphForConnectionMode(state.graph, state.connectionMode ?? 'strict'),
    connectionMode: state.connectionMode ?? 'strict',
  };
  const withLabels =
    options.edgeLabels === undefined
      ? base
      : {
          ...base,
          edgeLabels: options.edgeLabels.map((label) => ({
            id: label.id,
            size: { ...label.size },
          })),
        };
  const request =
    options.groupHeaders === undefined
      ? withLabels
      : {
          ...withLabels,
          groupHeaders: options.groupHeaders.map((header) => ({
            ...header,
            size: { ...header.size },
            padding: { ...header.padding },
          })),
        };
  validateLayoutRequest(request);
  return request;
}
function currentResult(state: EditorState, active: LayoutRequest, result: LayoutResult): boolean {
  return (
    state.gesture.type === 'idle' &&
    (state.connectionMode ?? 'strict') === (active.connectionMode ?? 'strict') &&
    result.requestId === active.requestId &&
    result.revision === active.revision &&
    state.revision === active.revision
  );
}
/** @internal Geometry only; callers validate their versioned source and publish through its kernel. */
export function resolveLayoutGeometry(
  source: ZlozGraph,
  active: LayoutRequestOptions,
  result: LayoutResult,
) {
  const labels = new Map((active.edgeLabels ?? []).map((label) => [label.id, label]));
  const positions = new Map(result.positions.map((position) => [position.id, position]));
  if (
    positions.size !== result.positions.length ||
    positions.size !== source.nodes.length ||
    source.nodes.some((node) => !positions.has(node.id))
  )
    throw new ZlozError('invalid-layout', 'Layout must contain every node exactly once');
  for (const position of positions.values()) finitePoint(position);
  const routes = new Set<string>();
  for (const route of result.routes) {
    if (
      routes.has(route.id) ||
      !source.edges.some((edge) => edge.id === route.id) ||
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
    ...source,
    nodes: source.nodes.map((node) => {
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
  for (const header of active.groupHeaders ?? []) {
    const node = graph.nodes.find((n) => n.id === header.id);
    if (!node) throw new ZlozError('invalid-layout', 'Missing laid-out group');
    const { minimumSize, contentPadding } = resolveLayoutGroupHeader(node, header);
    if (
      node.size.width < minimumSize.width ||
      node.size.height < minimumSize.height ||
      graph.nodes.some(
        (child) =>
          child.parentId === node.id &&
          (child.position.x < node.position.x + contentPadding.left - 1e-6 ||
            child.position.y < node.position.y + contentPadding.top - 1e-6 ||
            child.position.x + child.size.width >
              node.position.x + node.size.width - contentPadding.right + 1e-6 ||
            child.position.y + child.size.height >
              node.position.y + node.size.height - contentPadding.bottom + 1e-6),
      )
    )
      throw new ZlozError(
        'invalid-layout',
        'Layout did not reserve the declared group header and child padding',
      );
  }

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
  validateLayoutRequest(active);
  const next = resolveLayoutGeometry(state.graph, active, result);
  return { ...commitGraph(state, next.graph), routes: next.routes, notice: 'Layout applied' };
}
/** Geometry-only layout for a detached read-only preview. Advances revision without appending Undo. */
export function applyPreviewLayout(
  state: EditorState,
  active: LayoutRequest,
  result: LayoutResult,
): EditorState {
  if (!state.readOnly || !currentResult(state, active, result)) return state;
  validateLayoutRequest(active);
  const next = resolveLayoutGeometry(state.graph, active, result);
  return {
    ...state,
    graph: next.graph,
    routes: next.routes,
    revision: state.revision + 1,
    fitViewTransition: { type: 'idle', id: state.fitViewTransition.id },
    notice: 'Preview layout applied',
  };
}
