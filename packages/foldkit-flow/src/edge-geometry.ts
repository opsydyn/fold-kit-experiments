import { edgeEndpoints, edgeGeometry } from './geometry';
import { FlowError } from './graph';
import type { FlowEdge, FlowGraph, FlowNode, Point } from './types';

/** One SVG path drives both decoration and selection. Undefined suppresses the on-canvas label anchor. */
export type FlowEdgeGeometry = Readonly<{
  path: string;
  labelPosition: Point | undefined;
}>;
export type FlowEdgeGeometryContext = Readonly<{
  graph: FlowGraph;
  edge: FlowEdge;
  source: Point;
  target: Point;
  route: readonly Point[] | undefined;
  sourceGroup: FlowNode | undefined;
  targetGroup: FlowNode | undefined;
  defaultGeometry: FlowEdgeGeometry;
}>;
/** Pure view policy. Return undefined to retain the authored style/layout/default route. */
export type FlowEdgeGeometryPolicy = (
  context: FlowEdgeGeometryContext,
) => FlowEdgeGeometry | undefined;
export type FlowEdgeGeometryOptions = Readonly<{
  route?: readonly Point[] | undefined;
  sourceGroup?: FlowNode | undefined;
  targetGroup?: FlowNode | undefined;
  policy?: FlowEdgeGeometryPolicy | undefined;
}>;

/** Resolve once and share the result across rendering, hit testing and label/control placement. */
export function resolveEdgeGeometry(
  graph: FlowGraph,
  edge: FlowEdge,
  options: FlowEdgeGeometryOptions = {},
): FlowEdgeGeometry {
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
  if (
    !geometry.path.trim() ||
    (geometry.labelPosition &&
      ![geometry.labelPosition.x, geometry.labelPosition.y].every(Number.isFinite))
  )
    throw new FlowError('invalid-edit', `Invalid edge geometry for ${edge.id}`);
  return geometry;
}
