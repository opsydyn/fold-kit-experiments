import { edgeEndpoints, edgeGeometry } from './geometry';
import { ZlozError } from './graph';
import type { ZlozEdge, ZlozGraph, ZlozNode, Point } from './types';

/** One SVG path drives both decoration and selection. Undefined suppresses the on-canvas label anchor. */
export type ZlozEdgeGeometry = Readonly<{
  path: string;
  labelPosition: Point | undefined;
}>;
export type ZlozEdgeGeometryContext = Readonly<{
  graph: ZlozGraph;
  edge: ZlozEdge;
  source: Point;
  target: Point;
  route: readonly Point[] | undefined;
  sourceGroup: ZlozNode | undefined;
  targetGroup: ZlozNode | undefined;
  defaultGeometry: ZlozEdgeGeometry;
}>;
/** Pure view policy. Return undefined to retain the authored style/layout/default route. */
export type ZlozEdgeGeometryPolicy = (
  context: ZlozEdgeGeometryContext,
) => ZlozEdgeGeometry | undefined;
export type ZlozEdgeGeometryOptions = Readonly<{
  route?: readonly Point[] | undefined;
  sourceGroup?: ZlozNode | undefined;
  targetGroup?: ZlozNode | undefined;
  policy?: ZlozEdgeGeometryPolicy | undefined;
}>;

/** Resolve once and share the result across rendering, hit testing and label/control placement. */
export function resolveEdgeGeometry(
  graph: ZlozGraph,
  edge: ZlozEdge,
  options: ZlozEdgeGeometryOptions = {},
): ZlozEdgeGeometry {
  const groups = { source: options.sourceGroup, target: options.targetGroup };
  const builtIn = edgeGeometry(graph, edge, options.route, groups);
  const defaultGeometry = { path: builtIn.path, labelPosition: builtIn.center };
  if (!options.policy) return defaultGeometry;
  const anchors = edgeEndpoints(graph, edge, groups);
  const geometry =
    options.policy({
      graph,
      edge,
      ...anchors,
      route: options.route,
      sourceGroup: options.sourceGroup,
      targetGroup: options.targetGroup,
      defaultGeometry,
    }) ?? defaultGeometry;
  return checkedGeometry(geometry, `edge ${edge.id}`);
}

/** Shared validation at the host geometry-policy boundary. */
export function checkedGeometry(geometry: ZlozEdgeGeometry, description: string): ZlozEdgeGeometry {
  if (
    !geometry.path.trim() ||
    (geometry.labelPosition &&
      ![geometry.labelPosition.x, geometry.labelPosition.y].every(Number.isFinite))
  )
    throw new ZlozError('invalid-edit', `Invalid geometry for ${description}`);
  return geometry;
}
