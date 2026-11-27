import {
  portBoundaryPosition,
  type Endpoint,
  type ZlozGraph,
  type ZlozNode,
  type Point,
  type Port,
} from '@opsydyn/foldkit-zloz';

/** One endpoint-only curve function serves finished edges and incomplete previews. */
function raisedPath({
  source,
  target,
}: Readonly<{
  source: import('@opsydyn/foldkit-zloz').Point;
  target: import('@opsydyn/foldkit-zloz').Point;
}>) {
  const control = { x: (source.x + target.x) / 2, y: Math.min(source.y, target.y) - 100 };
  return {
    path: `M${source.x},${source.y} Q${control.x},${control.y} ${target.x},${target.y}`,
    labelPosition: {
      x: (source.x + 2 * control.x + target.x) / 4,
      y: (source.y + 2 * control.y + target.y) / 4,
    },
  };
}

type CurveContext = Readonly<{
  graph: ZlozGraph;
  source: Point;
  target: Point;
  sourceGroup: ZlozNode | undefined;
  targetGroup: ZlozNode | undefined;
}>;

/** Custom anchors use side-aware tangents so diagonal endpoints remain visible at the circle perimeter. */
function connectionPath(
  context: CurveContext,
  sourceEndpoint: Endpoint | null,
  targetEndpoint: Endpoint | null,
) {
  const reference = (endpoint: Endpoint | null) => {
    const node = context.graph.nodes.find((node) => node.id === endpoint?.node);
    const port = node?.ports.find((port) => port.id === endpoint?.port);
    return node && port ? { node, port } : undefined;
  };
  const sourceRef = reference(sourceEndpoint),
    targetRef = reference(targetEndpoint);
  if (
    context.sourceGroup ||
    context.targetGroup ||
    (!sourceRef?.port.anchor && !targetRef?.port.anchor)
  )
    return raisedPath(context);
  const lead = (
    point: Point,
    ref: Readonly<{ node: ZlozNode; port: Port }> | undefined,
    fallback: number,
  ): Point => {
    if (!ref) return { x: point.x + fallback, y: point.y };
    const boundary = portBoundaryPosition(ref.node, ref.port.id);
    const direction = {
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
      top: { x: 0, y: -1 },
      bottom: { x: 0, y: 1 },
    }[ref.port.side];
    return { x: boundary.x + direction.x * 64, y: boundary.y + direction.y * 64 };
  };
  const { source, target } = context;
  const direction = target.x >= source.x ? 64 : -64;
  const first = lead(source, sourceRef, direction),
    second = lead(target, targetRef, -direction);
  return {
    path: `M${source.x},${source.y} C${first.x},${first.y} ${second.x},${second.y} ${target.x},${target.y}`,
    labelPosition: {
      x: (source.x + 3 * first.x + 3 * second.x + target.x) / 8,
      y: (source.y + 3 * first.y + 3 * second.y + target.y) / 8,
    },
  };
}

/** Preserve explicit authored styles and layout routing for finished edges. */
export const raisedEdge: import('@opsydyn/foldkit-zloz').ZlozEdgeGeometryPolicy = (context) => {
  if (context.edge.waypoints || context.edge.pathStyle !== undefined || context.route)
    return undefined;
  return connectionPath(context, context.edge.source, context.edge.target);
};

/** Reconnection drops invalidate layout routing; authored styles still use the built-in geometry. */
export const raisedConnection: import('@opsydyn/foldkit-zloz').ZlozConnectionGeometryPolicy = (
  context,
) => {
  if (context.edge?.waypoints || context.edge?.pathStyle !== undefined) return undefined;
  return connectionPath(context, context.sourceEndpoint, context.targetEndpoint);
};

export function releaseGatePosition(nodes: readonly ZlozNode[]) {
  const review = nodes.find((node) => node.id === 'review');
  if (!review) return undefined;
  return { x: review.position.x + review.size.width / 2, y: review.position.y - 14 };
}
