import { checkedGeometry, type FlowEdgeGeometry } from './edge-geometry';
import { geometryBetween, groupBoundaryPoint, portPosition, screenToWorld } from './geometry';
import { presentGroups } from './group-presentation';
import type { EditorState, Endpoint, FlowEdge, FlowGraph, FlowNode, Point } from './types';

/** Feedback is derived from the reducer's accepted/rejected target, never from a second policy evaluation. */
export type FlowConnectionFeedback =
  | Readonly<{ type: 'free' }>
  | Readonly<{ type: 'valid'; endpoint: Endpoint }>
  | Readonly<{ type: 'invalid'; endpoint: Endpoint; reason: string }>;
export type FlowConnectionPreviewContext = Readonly<{
  graph: FlowGraph;
  source: Point;
  target: Point;
  sourceEndpoint: Endpoint | null;
  targetEndpoint: Endpoint | null;
  /** Actual cursor in world units, independent of snapping to a hovered port. */
  pointer: Point;
  sourceGroup: FlowNode | undefined;
  targetGroup: FlowNode | undefined;
  movingEnd: 'source' | 'target';
  /** Existing edge and metadata when reconnecting; absent for a new incomplete connection. */
  edge: FlowEdge | undefined;
  feedback: FlowConnectionFeedback;
  defaultGeometry: FlowEdgeGeometry;
}>;
/** Shares source/target and geometry result shapes with FlowEdgeGeometryPolicy; no synthetic edge is required. */
export type FlowConnectionGeometryPolicy = (
  context: FlowConnectionPreviewContext,
) => FlowEdgeGeometry | undefined;
export type FlowConnectionPreview = FlowConnectionPreviewContext & FlowEdgeGeometry;

/** Pure world-space preview resolution. No preview for idle, keyboard-only connection selection, or read-only state. */
export function resolveConnectionPreview(
  state: EditorState,
  policy?: FlowConnectionGeometryPolicy,
): FlowConnectionPreview | undefined {
  const drag = state.gesture;
  if (state.readOnly || drag.type !== 'connection-drag' || !state.connection) return undefined;
  const pointer = screenToWorld(drag.point, state.viewport);
  const movingEnd = drag.reconnect?.end ?? 'target';
  const hovered = drag.target ?? drag.rejected?.endpoint ?? null;
  const sourceEndpoint = movingEnd === 'source' ? hovered : state.connection;
  const targetEndpoint = movingEnd === 'target' ? hovered : state.connection;
  const presentation = presentGroups(state.graph, state.collapsedGroups);
  const anchor = (endpoint: Endpoint | null) => {
    if (!endpoint) return { point: pointer, group: undefined };
    const node = state.graph.nodes.find((node) => node.id === endpoint.node);
    if (!node || !node.ports.some((port) => port.id === endpoint.port))
      return { point: pointer, group: undefined };
    const group = presentation.hiddenBy.get(node.id);
    return {
      point: group
        ? {
            x: group.position.x + group.size.width / 2,
            y: group.position.y + group.size.height / 2,
          }
        : portPosition(node, endpoint.port),
      group,
    };
  };
  const from = anchor(sourceEndpoint);
  const to = anchor(targetEndpoint);
  const source = from.group ? groupBoundaryPoint(from.group, to.point) : from.point;
  const target = to.group ? groupBoundaryPoint(to.group, from.point) : to.point;
  const edge = state.graph.edges.find((edge) => edge.id === drag.reconnect?.id);
  const builtIn = geometryBetween(source, target, edge?.pathStyle);
  const defaultGeometry = { path: builtIn.path, labelPosition: builtIn.center };
  const feedback: FlowConnectionFeedback = drag.target
    ? { type: 'valid', endpoint: drag.target }
    : drag.rejected
      ? { type: 'invalid', ...drag.rejected }
      : { type: 'free' };
  const context = {
    graph: state.graph,
    source,
    target,
    sourceEndpoint,
    targetEndpoint,
    pointer,
    sourceGroup: from.group,
    targetGroup: to.group,
    movingEnd,
    edge,
    feedback,
    defaultGeometry,
  };
  return {
    ...context,
    ...checkedGeometry(policy?.(context) ?? defaultGeometry, 'connection preview'),
  };
}
