import type { Point, ZlozEdge, ZlozEdgeWaypoint } from './types';

/** Internal wire/edit boundary shared by the codec and reducer. */
export function validEdgeWaypoints(value: unknown): value is readonly ZlozEdgeWaypoint[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const ids = new Set<string>();
  for (const waypoint of value) {
    if (
      typeof waypoint !== 'object' ||
      waypoint === null ||
      Array.isArray(waypoint) ||
      typeof waypoint.id !== 'string' ||
      !waypoint.id.trim() ||
      ids.has(waypoint.id) ||
      typeof waypoint.position !== 'object' ||
      waypoint.position === null ||
      Array.isArray(waypoint.position) ||
      typeof waypoint.position.x !== 'number' ||
      !Number.isFinite(waypoint.position.x) ||
      typeof waypoint.position.y !== 'number' ||
      !Number.isFinite(waypoint.position.y) ||
      Object.keys(waypoint).some((key) => key !== 'id' && key !== 'position') ||
      Object.keys(waypoint.position).some((key) => key !== 'x' && key !== 'y')
    )
      return false;
    ids.add(waypoint.id);
  }
  return true;
}

/** Copy/insertion moves an entire fragment; ordinary endpoint movement keeps world-space bends. */
export function translateEdgeWaypoints(edge: ZlozEdge, delta: Point): ZlozEdge {
  return edge.waypoints
    ? {
        ...edge,
        waypoints: edge.waypoints.map(({ id, position }) => ({
          id,
          position: { x: position.x + delta.x, y: position.y + delta.y },
        })),
      }
    : edge;
}

/** Authored bounds only; collapsed endpoint projection suppresses the original bends. */
export function edgeWaypointBounds(
  edges: readonly ZlozEdge[],
  hiddenBy?: ReadonlyMap<string, unknown>,
) {
  return edges.flatMap((edge) =>
    hiddenBy?.has(edge.source.node) || hiddenBy?.has(edge.target.node)
      ? []
      : (edge.waypoints ?? []).map(({ position }) => ({ position, size: { width: 0, height: 0 } })),
  );
}
