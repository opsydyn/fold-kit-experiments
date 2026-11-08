import { checkedGeometry, type ZlozEdgeGeometry } from './edge-geometry';
import { geometryBetween, groupBoundaryPoint, portPosition, screenToWorld } from './geometry';
import { presentGroups } from './group-presentation';
import type { EditorState, Endpoint, ZlozEdge, ZlozGraph, ZlozNode, Point } from './types';

/** Feedback is derived from the reducer's accepted/rejected target, never from a second policy evaluation. */
export type ZlozConnectionFeedback =
  | Readonly<{ type: 'free' }>
  | Readonly<{ type: 'valid'; endpoint: Endpoint }>
  | Readonly<{ type: 'invalid'; endpoint: Endpoint; reason: string }>;
export type ZlozConnectionPreviewContext = Readonly<{
  graph: ZlozGraph;
  source: Point;
  target: Point;
  sourceEndpoint: Endpoint | null;
  targetEndpoint: Endpoint | null;
  /** Actual cursor in world units, independent of snapping to a hovered port. */
  pointer: Point;
  sourceGroup: ZlozNode | undefined;
  targetGroup: ZlozNode | undefined;
  movingEnd: 'source' | 'target';
  /** Existing edge and metadata when reconnecting; absent for a new incomplete connection. */
  edge: ZlozEdge | undefined;
  feedback: ZlozConnectionFeedback;
  defaultGeometry: ZlozEdgeGeometry;
}>;
/** Shares source/target and geometry result shapes with ZlozEdgeGeometryPolicy; no synthetic edge is required. */
export type ZlozConnectionGeometryPolicy = (
  context: ZlozConnectionPreviewContext,
) => ZlozEdgeGeometry | undefined;
export type ZlozConnectionPreview = ZlozConnectionPreviewContext & ZlozEdgeGeometry;

/** Pure world-space preview resolution. No preview for idle, keyboard-only connection selection, or read-only state. */
export function resolveConnectionPreview(
  state: EditorState,
  policy?: ZlozConnectionGeometryPolicy,
): ZlozConnectionPreview | undefined {
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
  const feedback: ZlozConnectionFeedback = drag.target
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
