/**
 * A layered layout for a state machine, in the Sugiyama style: states in ranks along the
 * direction of flow from the initial state, ordered within each rank to keep edges short,
 * edges routed as curves with the message on them. Back edges (a reload, a retry) run round
 * the outside of the graph, so the forward flow reads straight.
 *
 * App-owned: D3 has no layered layout, so it stays here rather than in `foldkit-viz`, whose
 * layouts trace D3. It keeps that package's record types, so a page can swap it for
 * `layoutStateFlow` (the force layout) without changing what it draws.
 */
import type {
  StateFlowEdge,
  StateFlowGraph,
  StateFlowLayoutNode,
} from '@opsydyn/foldkit-viz/stateflow';
import { layoutStateFlow } from '@opsydyn/foldkit-viz/stateflow';

/** Ranks left to right on a wide page; top to bottom on a phone. */
export type Orientation = 'across' | 'down';

/** Layered, or D3's force simulation through `foldkit-viz`, for comparison. */
export type LayoutKind = 'layered' | 'force';

type Point = Readonly<{ x: number; y: number }>;

/** One edge, drawn: its curve, where its message label sits, and its arrowhead. */
export type Route = Readonly<{
  edge: StateFlowEdge;
  path: string;
  label: Point;
  labelWidth: number;
  arrow: string;
}>;

export type Placed = Readonly<{
  nodes: ReadonlyArray<StateFlowLayoutNode>;
  routes: ReadonlyArray<Route>;
  width: number;
  height: number;
  /** Each state's rank, then its place in the rank: the swimlane's column order. */
  order: ReadonlyArray<string>;
}>;

/** A state's box, half its width and half its height. */
export const nodeHalf = { width: 56, height: 32 } as const;

const spacing = {
  across: { rank: 200, cross: 130, margin: 96 },
  down: { rank: 150, cross: 150, margin: 80 },
} as const;

/** The width a message label takes, in the graph's monospace face. */
export const labelWidthOf = (text: string): number => text.length * 7.3 + 12;

/** Depth-first from the initial state, then from any state it never reached: back edges. */
const backEdgesOf = (graph: StateFlowGraph, initial: string): ReadonlySet<string> => {
  const back = new Set<string>();
  const done = new Set<string>();
  const onPath = new Set<string>();
  const visit = (id: string): void => {
    onPath.add(id);
    graph.edges
      .filter((edge) => edge.source === id)
      .forEach((edge) => {
        if (edge.target === id || onPath.has(edge.target)) back.add(edge.id);
        else if (!done.has(edge.target)) visit(edge.target);
      });
    onPath.delete(id);
    done.add(id);
  };
  [initial, ...graph.nodes.map(({ id }) => id)]
    .filter((id) => !done.has(id))
    .forEach((id) => {
      if (!done.has(id)) visit(id);
    });
  return back;
};

/** Each state's rank: the longest run of forward edges that reaches it. */
const ranksOf = (
  graph: StateFlowGraph,
  forward: ReadonlyArray<StateFlowEdge>,
): ReadonlyMap<string, number> => {
  const rank = new Map(graph.nodes.map(({ id }) => [id, 0]));
  // Forward edges form a DAG, so as many relaxation passes as states settle every rank.
  graph.nodes.forEach(() =>
    forward.forEach((edge) =>
      rank.set(edge.target, Math.max(rank.get(edge.target) ?? 0, (rank.get(edge.source) ?? 0) + 1)),
    ),
  );
  return rank;
};

const mean = (values: ReadonlyArray<number>): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/** Orders each rank by the mean place of its neighbours, sweeping down and back up. */
const orderRanks = (
  graph: StateFlowGraph,
  forward: ReadonlyArray<StateFlowEdge>,
  rank: ReadonlyMap<string, number>,
): ReadonlyArray<ReadonlyArray<string>> => {
  const count = Math.max(...rank.values()) + 1;
  const initial = Array.from({ length: count }, (_, index) =>
    graph.nodes.map(({ id }) => id).filter((id) => rank.get(id) === index),
  );
  const sweep = (
    ranks: ReadonlyArray<ReadonlyArray<string>>,
    down: boolean,
  ): ReadonlyArray<ReadonlyArray<string>> => {
    const indices = Array.from({ length: count }, (_, index) => (down ? index : count - 1 - index));
    return indices.reduce<ReadonlyArray<ReadonlyArray<string>>>((current, index) => {
      const neighbour = down ? index - 1 : index + 1;
      const fixed = current[neighbour];
      if (fixed === undefined) return current;
      const placeOf = (id: string): number => {
        const linked = forward
          .filter((edge) => (down ? edge.target === id : edge.source === id))
          .map((edge) => fixed.indexOf(down ? edge.source : edge.target))
          .filter((place) => place >= 0);
        return linked.length === 0 ? (current[index] ?? []).indexOf(id) : mean(linked);
      };
      const sorted = [...(current[index] ?? [])].sort((a, b) => placeOf(a) - placeOf(b));
      return current.map((ids, at) => (at === index ? sorted : ids));
    }, ranks);
  };
  return [true, false, true, false].reduce(sweep, initial);
};

/** A point along a cubic curve, at `t` from its start. */
const cubicAt = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t ** 3 * p3.y,
  };
};

/** An arrowhead at `tip`, pointing away from `from`. */
const arrowAt = (from: Point, tip: Point): string => {
  const length = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / length;
  const uy = (tip.y - from.y) / length;
  const left = { x: tip.x - ux * 9 - uy * 4, y: tip.y - uy * 9 + ux * 4 };
  const right = { x: tip.x - ux * 9 + uy * 4, y: tip.y - uy * 9 - ux * 4 };
  return `M${left.x},${left.y} L${tip.x},${tip.y} L${right.x},${right.y} Z`;
};

const curve = (p0: Point, p1: Point, p2: Point, p3: Point): string =>
  `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;

type Box = Readonly<{ x: number; y: number; halfWidth: number; halfHeight: number }>;

const overlaps = (a: Box, b: Box): boolean =>
  Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth &&
  Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight;

/**
 * Moves each label off the states and the labels already placed: the nearest free spot
 * above or below where its curve puts it, alternating sides.
 */
const settleLabels = (
  routes: ReadonlyArray<Route>,
  nodes: ReadonlyArray<StateFlowLayoutNode>,
): ReadonlyArray<Route> => {
  const states = nodes.map(
    (node): Box => ({
      x: node.x,
      y: node.y,
      halfWidth: nodeHalf.width + 4,
      halfHeight: nodeHalf.height + 4,
    }),
  );
  // A label's own height and a little, so two labels a step apart don't touch: a top-to-bottom
  // gap between ranks fits three of them (0 and ±20) clear of the states.
  const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5].map((step) => step * 20);
  return routes.reduce<ReadonlyArray<Route>>((placed, route) => {
    const boxOf = (offset: number): Box => ({
      x: route.label.x,
      y: route.label.y + offset,
      halfWidth: route.labelWidth / 2,
      halfHeight: 9,
    });
    const taken = [
      ...states,
      ...placed.map(
        (other): Box => ({
          x: other.label.x,
          y: other.label.y,
          halfWidth: other.labelWidth / 2,
          halfHeight: 9,
        }),
      ),
    ];
    const offset = offsets.find((candidate) =>
      taken.every((box) => !overlaps(boxOf(candidate), box)),
    );
    const label = { x: route.label.x, y: route.label.y + (offset ?? 0) };
    return [...placed, { ...route, label }];
  }, []);
};

/** The layered layout: ranks, order within ranks, then curves and labels. */
export const layoutLayered = (
  graph: StateFlowGraph,
  initial: string,
  orientation: Orientation,
): Placed => {
  const back = backEdgesOf(graph, initial);
  const forward = graph.edges.filter((edge) => !back.has(edge.id));
  const rank = ranksOf(graph, forward);
  const ranks = orderRanks(graph, forward, rank);
  const space = spacing[orientation];
  const widest = Math.max(...ranks.map((ids) => ids.length));
  const rankSpan = (ranks.length - 1) * space.rank;
  const crossSpan = (widest - 1) * space.cross;
  // (u, v): along the flow and across it; `toXY` turns them to the page's axes.
  const toXY = (u: number, v: number): Point =>
    orientation === 'across' ? { x: u, y: v } : { x: v, y: u };
  const half =
    orientation === 'across'
      ? { along: nodeHalf.width, across: nodeHalf.height }
      : { along: nodeHalf.height, across: nodeHalf.width };
  const spanOf = (edge: StateFlowEdge): number =>
    Math.abs((rank.get(edge.target) ?? 0) - (rank.get(edge.source) ?? 0));
  // Forward edges that skip a rank run over the top, back edges under the bottom, each on a
  // track of its own: the shortest nearest the states, so tracks cross as little as they can.
  const byspan = (edges: ReadonlyArray<StateFlowEdge>) =>
    [...edges].sort((a, b) => spanOf(a) - spanOf(b));
  const over = byspan(forward.filter((edge) => spanOf(edge) > 1));
  const under = byspan(
    graph.edges.filter((edge) => back.has(edge.id) && edge.source !== edge.target),
  );
  const track = 26;
  const top = space.margin + over.length * track;
  const uv = new Map(
    ranks.flatMap((ids, at) =>
      ids.map((id, place) => [
        id,
        {
          u: space.margin + at * space.rank,
          v: top + crossSpan / 2 + (place - (ids.length - 1) / 2) * space.cross,
        },
      ]),
    ),
  );
  const at = (id: string) => uv.get(id) ?? { u: 0, v: 0 };
  const nodes = graph.nodes.map((node): StateFlowLayoutNode => {
    const { u, v } = at(node.id);
    return { ...node, ...toXY(u, v) };
  });
  // Edges between the same pair of states share the gap, a lane each.
  const pairOf = (edge: StateFlowEdge) => [edge.source, edge.target].sort().join('|');
  const laneOf = (edge: StateFlowEdge): number => {
    const peers = graph.edges.filter((other) => pairOf(other) === pairOf(edge));
    return peers.findIndex((other) => other.id === edge.id) - (peers.length - 1) / 2;
  };
  const above = top - half.across - 30;
  const below = top + crossSpan + half.across + 30;
  /** A curve leaving one state's side and joining another's, its apex on `level`. */
  const tracked = (
    edge: StateFlowEdge,
    p0: Point,
    p3: Point,
    level: number,
    sideOf: (p: Point) => number,
  ): Route => {
    const start = sideOf(p0);
    const end = sideOf(p3);
    // A cubic's apex reaches three quarters of the way to its control points.
    const control = (start + end) / 2 + ((level - (start + end) / 2) * 4) / 3;
    const along = (p: Point) => (orientation === 'across' ? p.x : p.y);
    const p1 = toXY(along(p0), control);
    const p2 = toXY(along(p3), control);
    return {
      edge,
      path: curve(p0, p1, p2, p3),
      label: cubicAt(p0, p1, p2, p3, 0.5),
      labelWidth: labelWidthOf(edge.event),
      arrow: arrowAt(p2, p3),
    };
  };
  const crossOf = (p: Point) => (orientation === 'across' ? p.y : p.x);
  const routeOf = (edge: StateFlowEdge): Route => {
    const source = at(edge.source);
    const target = at(edge.target);
    const lane = laneOf(edge);
    const labelWidth = labelWidthOf(edge.event);
    if (edge.source === edge.target) {
      // A self loop: out of the state and back in, the message beyond it. A state's
      // loops alternate above and below it, each further out than the last on its side.
      const loops = graph.edges.filter(
        (other) => other.source === edge.source && other.target === other.source,
      );
      const index = loops.findIndex((other) => other.id === edge.id);
      const side = index % 2 === 0 ? -1 : 1;
      const reach = 56 + Math.floor(index / 2) * 30;
      const rim = source.v + side * half.across;
      const p0 = toXY(source.u - 18, rim);
      const p1 = toXY(source.u - 40, rim + side * reach);
      const p2 = toXY(source.u + 40, rim + side * reach);
      const p3 = toXY(source.u + 18, rim);
      return {
        edge,
        path: curve(p0, p1, p2, p3),
        label: toXY(source.u, rim + side * (reach - 4)),
        labelWidth,
        arrow: arrowAt(p2, p3),
      };
    }
    const overAt = over.findIndex((other) => other.id === edge.id);
    if (overAt >= 0) {
      return tracked(
        edge,
        toXY(source.u + half.along / 2, source.v - half.across),
        toXY(target.u - half.along / 2, target.v - half.across),
        above - overAt * track,
        crossOf,
      );
    }
    const underAt = under.findIndex((other) => other.id === edge.id);
    if (underAt >= 0) {
      return tracked(
        edge,
        toXY(source.u - half.along / 2, source.v + half.across),
        toXY(target.u + half.along / 2, target.v + half.across),
        below + underAt * track,
        crossOf,
      );
    }
    const offset = lane * 14;
    const p0 = toXY(source.u + half.along, source.v + offset);
    const p3 = toXY(target.u - half.along, target.v + offset);
    const bend = (target.u - source.u) / 2;
    const p1 = toXY(source.u + half.along + bend, source.v + offset + lane * 22);
    const p2 = toXY(target.u - half.along - bend, target.v + offset + lane * 22);
    return {
      edge,
      path: curve(p0, p1, p2, p3),
      label: cubicAt(p0, p1, p2, p3, 0.5),
      labelWidth,
      arrow: arrowAt(p2, p3),
    };
  };
  const extent = toXY(space.margin * 2 + rankSpan, below + under.length * track + 30);
  // Keep every label inside the canvas, where a track runs close to its edge.
  const inside = (route: Route): Route => ({
    ...route,
    label: {
      x: Math.min(
        Math.max(route.label.x, route.labelWidth / 2 + 4),
        extent.x - route.labelWidth / 2 - 4,
      ),
      y: Math.min(Math.max(route.label.y, 14), extent.y - 14),
    },
  });
  return {
    nodes,
    routes: settleLabels(graph.edges.map(routeOf).map(inside), nodes),
    width: extent.x,
    height: extent.y,
    order: ranks.flat(),
  };
};

/** D3's force layout, through `foldkit-viz`, its edges drawn as gentle arcs. */
export const layoutForce = (graph: StateFlowGraph): Placed => {
  const size = { width: 900, height: 620 };
  const layout = layoutStateFlow(graph, {
    ...size,
    linkDistance: 220,
    collideRadius: 85,
    strength: -800,
  });
  const pairOf = (edge: StateFlowEdge) => [edge.source, edge.target].sort().join('|');
  const routes = layout.edges.map((edge): Route => {
    const peers = layout.edges.filter((other) => pairOf(other) === pairOf(edge));
    const lane = peers.findIndex((other) => other.id === edge.id) - (peers.length - 1) / 2;
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };
    const bow = 30 + lane * 36;
    const p0 = { x: edge.x1, y: edge.y1 };
    const p3 = { x: edge.x2, y: edge.y2 };
    const control = {
      x: (p0.x + p3.x) / 2 + normal.x * bow,
      y: (p0.y + p3.y) / 2 + normal.y * bow,
    };
    // Stop short of the target's box, along the curve's last tangent.
    const tangent = { x: p3.x - control.x, y: p3.y - control.y };
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    const stop = Math.min(
      nodeHalf.width / Math.abs(tangent.x / tangentLength || 1e-6),
      nodeHalf.height / Math.abs(tangent.y / tangentLength || 1e-6),
    );
    const end = {
      x: p3.x - (tangent.x / tangentLength) * stop,
      y: p3.y - (tangent.y / tangentLength) * stop,
    };
    return {
      edge,
      path: `M${p0.x},${p0.y} Q${control.x},${control.y} ${end.x},${end.y}`,
      label: { x: (p0.x + 2 * control.x + p3.x) / 4, y: (p0.y + 2 * control.y + p3.y) / 4 },
      labelWidth: labelWidthOf(edge.event),
      arrow: arrowAt(control, end),
    };
  });
  return {
    nodes: layout.nodes,
    routes: settleLabels(routes, layout.nodes),
    ...size,
    order: [...layout.nodes].sort((a, b) => a.x - b.x).map(({ id }) => id),
  };
};

/** The layout the page asked for, at its orientation. */
export const place = (
  graph: StateFlowGraph,
  initial: string,
  kind: LayoutKind,
  orientation: Orientation,
): Placed => (kind === 'force' ? layoutForce(graph) : layoutLayered(graph, initial, orientation));
