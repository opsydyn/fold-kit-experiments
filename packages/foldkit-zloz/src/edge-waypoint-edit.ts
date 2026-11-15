import { validEdgeWaypoints } from './edge-waypoints';
import { ZlozError } from './graph';
import { presentVisibleGraph } from './group-presentation';
import type {
  EditorPolicy,
  EditorState,
  ZlozEdge,
  ZlozEdgeWaypointEdit,
  ZlozEdgeWaypointEditDecision,
} from './types';

/** Pure preview/availability check. updateEditor rechecks this against live state before committing. */
export function resolveEdgeWaypointEdit(
  state: EditorState,
  request: ZlozEdgeWaypointEdit,
  policy: EditorPolicy = {},
): ZlozEdgeWaypointEditDecision {
  const blocked = (reason: string): ZlozEdgeWaypointEditDecision => ({ type: 'blocked', reason });
  if (state.readOnly) return blocked('Waypoint editing is unavailable in read-only mode.');
  if (state.gesture.type !== 'idle' || state.connection !== null || state.edgeLabelDraft !== null)
    return blocked('Finish the current interaction before editing waypoints.');
  if (request.revision !== state.revision)
    return blocked('The graph changed; review the waypoints again.');
  if (state.historyLimit === 0) return blocked('Enable graph Undo before editing waypoints.');
  const edge = state.graph.edges.find((item) => item.id === request.id);
  const visible = presentVisibleGraph(state);
  if (
    !edge ||
    !visible.edges.some((item) => item.id === request.id) ||
    visible.hiddenBy.has(edge.source.node) ||
    visible.hiddenBy.has(edge.target.node)
  )
    return blocked('The connection is unavailable for waypoint editing.');
  if (request.waypoints !== null && !validEdgeWaypoints(request.waypoints))
    throw new ZlozError(
      'invalid-edit',
      'Waypoints require unique non-blank IDs and finite world coordinates.',
    );
  const { waypoints: previous, ...automatic } = edge;
  const next: ZlozEdge =
    request.waypoints === null
      ? automatic
      : {
          ...automatic,
          waypoints: request.waypoints.map(({ id, position }) => ({
            id,
            position: { ...position },
          })),
        };
  const veto = policy.canChangeEdgeWaypoints?.(edge, next, state.graph);
  if (veto != null) return blocked(veto.trim() || 'Waypoint editing is unavailable.');
  if (
    (previous?.length ?? 0) === (next.waypoints?.length ?? 0) &&
    (previous ?? []).every(
      (waypoint, index) =>
        waypoint.id === next.waypoints?.[index]?.id &&
        waypoint.position.x === next.waypoints?.[index]?.position.x &&
        waypoint.position.y === next.waypoints?.[index]?.position.y,
    )
  )
    return { type: 'unchanged' };
  return { type: 'allowed', edge: next };
}
