import {
  portPosition,
  portBoundaryPosition,
  type EdgeRoute,
  type ZlozEdge,
  type ZlozNode,
  type Point,
} from '@opsydyn/foldkit-zloz';

const clearance = 8;
const lead = 16;
const directions = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

function obstacle(node: ZlozNode) {
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

function portLead(node: ZlozNode, id: string) {
  const port = node.ports.find((item) => item.id === id);
  if (!port) throw new Error(`Missing port ${id} on ${node.id}.`);
  const point = portPosition(node, id);
  const boundary = portBoundaryPosition(node, id);
  const direction = directions[port.side];
  return {
    point,
    // Curved-outline intersections can sit inside the conservative rectangular obstacle.
    // Leave that envelope before searching corridors, retaining the authored endpoint.
    outside: {
      x:
        direction.x < 0
          ? node.position.x - lead
          : direction.x > 0
            ? node.position.x + node.size.width + lead
            : boundary.x,
      y:
        direction.y < 0
          ? node.position.y - lead
          : direction.y > 0
            ? node.position.y + node.size.height + lead
            : boundary.y,
    },
  };
}

type Segment = Readonly<{ from: Point; to: Point }>;

function corridorPenalty(from: Point, to: Point, occupied: readonly Segment[]): number {
  if (from.x === to.x && from.y === to.y) return 0;
  const vertical = from.x === to.x;
  const axis = vertical ? 'y' : 'x';
  const across = vertical ? 'x' : 'y';
  const low = Math.min(from[axis], to[axis]);
  const high = Math.max(from[axis], to[axis]);
  let penalty = 0;
  for (const segment of occupied) {
    const otherVertical = segment.from.x === segment.to.x;
    if (vertical === otherVertical) {
      if (Math.abs(from[across] - segment.from[across]) >= 12) continue;
      const overlap =
        Math.min(high, Math.max(segment.from[axis], segment.to[axis])) -
        Math.max(low, Math.min(segment.from[axis], segment.to[axis]));
      penalty += Math.max(0, overlap) * 4;
    } else if (
      segment.from[axis] > low &&
      segment.from[axis] < high &&
      from[across] > Math.min(segment.from[across], segment.to[across]) &&
      from[across] < Math.max(segment.from[across], segment.to[across])
    )
      penalty += 48;
  }
  return penalty;
}

export function routeForceEdges(
  nodes: readonly ZlozNode[],
  edges: readonly ZlozEdge[],
): EdgeRoute[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const obstacles = nodes.map(obstacle);
  const columns = [...new Set(obstacles.flatMap(({ left, right }) => [left, right]))];
  const rows = [...new Set(obstacles.flatMap(({ top, bottom }) => [top, bottom]))];
  const occupied: Segment[] = [];
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

    const laneColumns = occupied.flatMap(({ from }) => [from.x - 12, from.x + 12]);
    const laneRows = occupied.flatMap(({ from }) => [from.y - 12, from.y + 12]);
    const candidates = [
      ...[...new Set([a.x, b.x, (a.x + b.x) / 2, ...columns, ...laneColumns])].map((x) => [
        a,
        { x, y: a.y },
        { x, y: b.y },
        b,
      ]),
      ...[...new Set([a.y, b.y, (a.y + b.y) / 2, ...rows, ...laneRows])].map((y) => [
        a,
        { x: a.x, y },
        { x: b.x, y },
        b,
      ]),
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
        length +=
          Math.abs(to.x - from.x) + Math.abs(to.y - from.y) + corridorPenalty(from, to, occupied);
      }
      if (clear && length < distance) {
        distance = length;
        shortest = points;
        if (length === directDistance) break;
      }
    }
    if (!shortest) return [];
    for (let index = 1; index < shortest.length; index++) {
      const from = shortest[index - 1];
      const to = shortest[index];
      if (from && to && (from.x !== to.x || from.y !== to.y)) occupied.push({ from, to });
    }
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
