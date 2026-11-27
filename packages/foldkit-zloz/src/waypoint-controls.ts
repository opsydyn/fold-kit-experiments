import { resolveEdgeGeometry } from './edge-geometry';
import { resolveEdgeWaypointEdit } from './edge-waypoint-edit';
import { edgeEndpoints } from './geometry';
import { presentVisibleGraph } from './group-presentation';
import type {
  EditorEvent,
  EditorPolicy,
  EditorState,
  Point,
  ZlozEdge,
  ZlozEdgeWaypoint,
} from './types';
import { resolveEdgeWaypointPreview } from './waypoint-interaction';

export type ZlozEdgeWaypointAction = Readonly<{
  label: string;
  reason: string | null;
  event: EditorEvent;
}>;
export type ZlozEdgeWaypointHandleContext = Readonly<{
  edgeId: string;
  revision: number;
  waypoint: ZlozEdgeWaypoint;
  label: string;
  reason: string | null;
  active: boolean;
  step: number;
  zoom: number;
  remove: ZlozEdgeWaypointAction;
}>;
export type ZlozEdgeWaypointControlsContext = Readonly<{
  panel: Readonly<{ position: Point; width: number; maxHeight: number }>;
  edge: ZlozEdge;
  handles: readonly ZlozEdgeWaypointHandleContext[];
  add: ZlozEdgeWaypointAction;
  reset: ZlozEdgeWaypointAction;
  reason: string | null;
  position: Point;
  zoom: number;
  dragging: boolean;
  bypassed: boolean;
}>;
/** Clear a waypoint handle while keeping the offset constant in screen pixels. */
export function waypointLabelPosition(
  edge: ZlozEdge,
  anchor: Point,
  zoom: number,
  offset: Point = { x: 0, y: -32 },
): Point {
  const overlaps = edge.waypoints?.some(
    ({ position }) => Math.hypot(position.x - anchor.x, position.y - anchor.y) * zoom < 28,
  );
  return overlaps ? { x: anchor.x + offset.x / zoom, y: anchor.y + offset.y / zoom } : anchor;
}

/** Package-owned availability, identity allocation and actions; no view or host state is required. */
export function resolveEdgeWaypointControls(
  state: EditorState,
  id: string,
  policy: EditorPolicy = {},
): ZlozEdgeWaypointControlsContext | null {
  const edge = state.graph.edges.find((edge) => edge.id === id);
  if (!edge) return null;
  const check = resolveEdgeWaypointEdit(
    state,
    { id, revision: state.revision, waypoints: edge.waypoints ?? null },
    policy,
  );
  const reason = check.type === 'blocked' ? check.reason : null;
  const drag = state.gesture;
  const dragging = drag.type === 'edge-waypoint-drag' && drag.id === id;
  const preview = dragging ? resolveEdgeWaypointPreview(state, policy) : null;
  const effective = preview?.type === 'allowed' ? preview.edge : edge;
  const previewReason = preview?.type === 'blocked' ? preview.reason : null;
  const visible = presentVisibleGraph(state);
  const geometry = resolveEdgeGeometry(state.graph, effective, {
    route: state.routes.find((route) => route.id === id)?.points,
    labelPosition: state.routes.find((route) => route.id === id)?.label?.position,
    sourceGroup: visible.hiddenBy.get(edge.source.node),
    targetGroup: visible.hiddenBy.get(edge.target.node),
  });
  const position = geometry.labelPosition ?? { x: 0, y: 0 };
  const endpoints = edgeEndpoints(state.graph, edge);
  const points = [
    endpoints.source,
    ...(edge.waypoints ?? []).map((waypoint) => waypoint.position),
    endpoints.target,
  ];
  let insertion = 0;
  let length = -1;
  let addedPosition = position;
  if (edge.waypoints) {
    for (let index = 0; index < points.length - 1; index++) {
      const first = points[index],
        second = points[index + 1];
      if (!first || !second) continue;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (distance > length) {
        length = distance;
        insertion = index;
        addedPosition = { x: first.x / 2 + second.x / 2, y: first.y / 2 + second.y / 2 };
      }
    }
    if (length === 0)
      addedPosition = { x: position.x + state.gridSpacing, y: position.y + state.gridSpacing };
  }
  const ids = new Set(edge.waypoints?.map((waypoint) => waypoint.id));
  let sequence = 1;
  while (ids.has(`waypoint:${sequence}`)) sequence++;
  const event = (waypoints: readonly ZlozEdgeWaypoint[] | null): EditorEvent => ({
    type: 'EdgeWaypointsChanged',
    id,
    revision: state.revision,
    waypoints,
  });
  return {
    panel: {
      position: {
        x: ((state.surface?.width ?? 800) - 12 - state.viewport.x) / state.viewport.zoom,
        y: ((state.surface?.height ?? 440) - 12 - state.viewport.y) / state.viewport.zoom,
      },
      width: Math.max(1, Math.min(360, (state.surface?.width ?? 800) - 24)),
      maxHeight: Math.max(1, Math.min(280, (state.surface?.height ?? 440) - 24)),
    },
    edge: effective,
    position,
    zoom: state.viewport.zoom,
    dragging,
    bypassed: dragging && drag.bypassed,
    reason: dragging ? previewReason : reason,
    add: {
      label: 'Add bend',
      reason,
      event: event([
        ...(edge.waypoints ?? []).slice(0, insertion),
        { id: `waypoint:${sequence}`, position: addedPosition },
        ...(edge.waypoints ?? []).slice(insertion),
      ]),
    },
    reset: {
      label: 'Reset bends',
      reason: reason ?? (edge.waypoints ? null : 'No authored bends to reset.'),
      event: event(null),
    },
    handles: (visible.hiddenBy.has(edge.source.node) || visible.hiddenBy.has(edge.target.node)
      ? []
      : (effective.waypoints ?? [])
    ).map((waypoint, index) => ({
      edgeId: id,
      revision: state.revision,
      waypoint,
      zoom: state.viewport.zoom,
      label: `Move bend ${index + 1}`,
      step: state.snapToGrid ? state.gridSpacing : 1,
      reason: dragging && drag.waypointId === waypoint.id ? previewReason : reason,
      active: dragging && drag.waypointId === waypoint.id,
      remove: {
        label: `Remove bend ${index + 1}`,
        reason,
        event: {
          type: 'EdgeWaypointRemoved',
          id,
          waypointId: waypoint.id,
          revision: state.revision,
        },
      },
    })),
  };
}
