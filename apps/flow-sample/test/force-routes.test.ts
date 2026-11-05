import { expect, test } from 'bun:test';

import type { FlowGraph, Point } from '@opsydyn/foldkit-flow';

import { routeForceEdges } from '../src/editor/force-routes';

test('separate connections use a free corridor instead of sharing a long segment', () => {
  const positions = [
    { x: 0, y: 160 },
    { x: 0, y: 0 },
    { x: 200, y: 320 },
    { x: 400, y: 320 },
    { x: 400, y: 160 },
    { x: 0, y: 480 },
  ];
  const graph: FlowGraph = {
    nodes: positions.map((position, index) => ({
      id: String(index),
      label: String(index),
      position,
      size: { width: 120, height: 80 },
      ports: [
        { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
        { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
      ],
    })),
    edges: [0, 1, 2].map((index) => ({
      id: String(index),
      source: { node: String(index), port: 'out' },
      target: { node: String(index + 3), port: 'in' },
    })),
  };
  const routes = routeForceEdges(graph.nodes, graph.edges);
  expect(routes).toHaveLength(3);
  expect(routeForceEdges(graph.nodes, graph.edges)).toEqual(routes);
  const segments = (points: readonly Point[]) =>
    points.slice(1).flatMap((to, index) => {
      const from = points[index];
      return from ? [{ from, to }] : [];
    });
  for (const [index, route] of routes.entries()) {
    for (const other of routes.slice(index + 1)) {
      for (const a of segments(route.points))
        for (const b of segments(other.points)) {
          const vertical = a.from.x === a.to.x;
          if (vertical !== (b.from.x === b.to.x)) continue;
          const axis = vertical ? 'y' : 'x';
          const across = vertical ? 'x' : 'y';
          if (a.from[across] !== b.from[across]) continue;
          const overlap =
            Math.min(Math.max(a.from[axis], a.to[axis]), Math.max(b.from[axis], b.to[axis])) -
            Math.max(Math.min(a.from[axis], a.to[axis]), Math.min(b.from[axis], b.to[axis]));
          expect(overlap).toBeLessThanOrEqual(0);
        }
    }
  }
});
