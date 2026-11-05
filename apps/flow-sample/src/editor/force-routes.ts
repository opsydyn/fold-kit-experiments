import {
  portPosition,
  type EdgeRoute,
  type FlowEdge,
  type FlowNode,
  type Point,
} from '@opsydyn/foldkit-flow';

const clearance = 8;
const lead = 16;
const directions = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

function obstacle(node: FlowNode) {
  return {
    id: node.id,
    left: node.position.x - clearance,
    right: node.position.x + node.size.width + clearance,
    top: node.position.y - clearance,
    bottom: node.position.y + node.size.height + clearance,
  };
}

function segmentClear(a: Point, b: Point, obstacles: readonly ReturnType<typeof obstacle>[]) {
  return obstacles.every(({ left, right, top, bottom }) => {
    if (a.x === b.x)
      return (
        a.x <= left || a.x >= right || Math.max(a.y, b.y) <= top || Math.min(a.y, b.y) >= bottom
      );
    return a.y <= top || a.y >= bottom || Math.max(a.x, b.x) <= left || Math.min(a.x, b.x) >= right;
  });
}

function portLead(node: FlowNode, id: string) {
  const port = node.ports.find((item) => item.id === id);
  if (!port) throw new Error(`Missing port ${id} on ${node.id}.`);
  const point = portPosition(node, id);
  const direction = directions[port.side];
  return { point, outside: { x: point.x + direction.x * lead, y: point.y + direction.y * lead } };
}

export function routeForceEdges(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
): EdgeRoute[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const obstacles = nodes.map(obstacle);
  const columns = [...new Set(obstacles.flatMap(({ left, right }) => [left, right]))];
  const rows = [...new Set(obstacles.flatMap(({ top, bottom }) => [top, bottom]))];
  return edges.flatMap((edge) => {
    const source = byId.get(edge.source.node);
    const target = byId.get(edge.target.node);
    if (!source || !target || edge.pathStyle !== undefined) return [];
    const start = portLead(source, edge.source.port);
    const end = portLead(target, edge.target.port);
    const a = start.outside;
    const b = end.outside;
    if (
      !segmentClear(
        start.point,
        a,
        obstacles.filter((item) => item.id !== source.id),
      ) ||
      !segmentClear(
        b,
        end.point,
        obstacles.filter((item) => item.id !== target.id),
      )
    )
      return [];

    const candidates = [
      ...[a.x, b.x, (a.x + b.x) / 2, ...columns].map((x) => [a, { x, y: a.y }, { x, y: b.y }, b]),
      ...[a.y, b.y, (a.y + b.y) / 2, ...rows].map((y) => [a, { x: a.x, y }, { x: b.x, y }, b]),
    ];
    const directDistance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    let shortest: Point[] | undefined;
    let distance = Infinity;
    for (const points of candidates) {
      let length = 0;
      let clear = true;
      for (let index = 1; index < points.length; index++) {
        const from = points[index - 1];
        const to = points[index];
        if (!from || !to || !segmentClear(from, to, obstacles)) {
          clear = false;
          break;
        }
        length += Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
      }
      if (clear && length < distance) {
        distance = length;
        shortest = points;
        if (length === directDistance) break;
      }
    }
    if (!shortest) return [];
    const points = [start.point, ...shortest, end.point];
    return [
      {
        id: edge.id,
        points: points.filter((point, index) => {
          const previous = points[index - 1];
          return previous?.x !== point.x || previous.y !== point.y;
        }),
      },
    ];
  });
}
