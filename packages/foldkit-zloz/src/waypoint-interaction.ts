import { resolveEdgeWaypointEdit } from './edge-waypoint-edit';
import { finitePoint, screenToWorld } from './geometry';
import type {
  EditorEvent,
  EditorPolicy,
  EditorState,
  Point,
  ZlozEdgeWaypointEdit,
  ZlozEdgeWaypointEditDecision,
} from './types';

function movedPosition(state: EditorState, start: Point, delta: Point, bypassed: boolean): Point {
  const raw = { x: start.x + delta.x, y: start.y + delta.y };
  const snap = state.snapToGrid && !bypassed && (delta.x !== 0 || delta.y !== 0);
  return snap
    ? {
        x: Math.round(raw.x / state.gridSpacing) * state.gridSpacing,
        y: Math.round(raw.y / state.gridSpacing) * state.gridSpacing,
      }
    : raw;
}
function requestAt(
  state: EditorState,
  id: string,
  waypointId: string,
  revision: number,
  position: Point,
): ZlozEdgeWaypointEdit {
  const edge = state.graph.edges.find((edge) => edge.id === id);
  return {
    id,
    revision,
    waypoints:
      edge?.waypoints?.map((waypoint) =>
        waypoint.id === waypointId ? { ...waypoint, position } : waypoint,
      ) ?? null,
  };
}
/** Proposed world-space geometry only. The saved graph and Undo remain unchanged during a drag. */
export function resolveEdgeWaypointPreview(
  state: EditorState,
  policy: EditorPolicy = {},
): ZlozEdgeWaypointEditDecision {
  const drag = state.gesture;
  if (drag.type !== 'edge-waypoint-drag') return { type: 'unchanged' };
  const point = screenToWorld(drag.point, state.viewport);
  const position = movedPosition(
    state,
    drag.start,
    { x: point.x - drag.origin.x, y: point.y - drag.origin.y },
    drag.bypassed,
  );
  return resolveEdgeWaypointEdit(
    { ...state, gesture: { type: 'idle' } },
    requestAt(state, drag.id, drag.waypointId, drag.revision, position),
    policy,
  );
}
export function startEdgeWaypointDrag(
  state: EditorState,
  event: Extract<EditorEvent, { type: 'EdgeWaypointDragStarted' }>,
  policy: EditorPolicy,
): EditorState {
  if (state.gesture.type !== 'idle') return state;
  const edge = state.graph.edges.find((edge) => edge.id === event.id);
  const waypoint = edge?.waypoints?.find((waypoint) => waypoint.id === event.waypointId);
  if (!waypoint) return { ...state, notice: 'This waypoint is unavailable.' };
  const check = resolveEdgeWaypointEdit(
    state,
    { id: event.id, revision: event.revision, waypoints: edge?.waypoints ?? null },
    policy,
  );
  if (check.type === 'blocked') return { ...state, notice: check.reason };
  finitePoint(event.point);
  return {
    ...state,
    context: null,
    notice: null,
    selectedNodes: [],
    selectedEdges: [event.id],
    gesture: {
      type: 'edge-waypoint-drag',
      id: event.id,
      waypointId: event.waypointId,
      revision: event.revision,
      pointer: event.pointer,
      origin: screenToWorld(event.point, state.viewport),
      start: { ...waypoint.position },
      point: { ...event.point },
      bypassed: event.snapBypassed ?? false,
    },
  };
}
export function moveEdgeWaypointDrag(
  state: EditorState,
  point: Point,
  bypassed: boolean,
  policy: EditorPolicy,
): EditorState {
  const drag = state.gesture;
  if (drag.type !== 'edge-waypoint-drag') return state;
  finitePoint(point);
  const next = { ...state, gesture: { ...drag, point: { ...point }, bypassed } };
  const check = resolveEdgeWaypointPreview(next, policy);
  return check.type === 'blocked'
    ? { ...state, gesture: { type: 'idle' }, notice: check.reason }
    : next;
}
export function nudgeEdgeWaypointRequest(
  state: EditorState,
  event: Extract<EditorEvent, { type: 'EdgeWaypointNudged' }>,
): ZlozEdgeWaypointEdit | null {
  finitePoint(event.delta);
  const waypoint = state.graph.edges
    .find((edge) => edge.id === event.id)
    ?.waypoints?.find((waypoint) => waypoint.id === event.waypointId);
  return waypoint
    ? requestAt(
        state,
        event.id,
        event.waypointId,
        event.revision,
        movedPosition(state, waypoint.position, event.delta, event.snapBypassed ?? false),
      )
    : null;
}
