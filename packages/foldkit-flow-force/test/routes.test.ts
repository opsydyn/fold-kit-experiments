import { expect, test } from 'bun:test';

import type { FlowGraph, Point } from '@opsydyn/foldkit-flow';

import { routeForceEdges } from '../src/routes';

/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts here, not structural placeholder names. */
test('force routes preserve shaped defaults and authored endpoints inside their original envelopes', () => {
  const nodes: FlowGraph['nodes'] = [
    {
      id: 'a',
      label: 'A',
      position: { x: 10, y: 20 },
      size: { width: 200, height: 100 },
      appearance: { shape: 'cylinder' },
      architecture: { family: 'c4', role: 'container' },
      ports: [{ id: 'out', kind: 'output', side: 'top', offset: 0 }],
    },
    {
      id: 'b',
      label: 'B',
      position: { x: 400, y: 200 },
      size: { width: 200, height: 100 },
      appearance: { shape: 'rounded-rectangle' },
      ports: [{ id: 'in', kind: 'input', side: 'left', anchor: { x: 0.2, y: 0.8 } }],
    },
  ];
  const routes = routeForceEdges(nodes, [
    { id: 'edge', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } },
  ]);
  expect(routes[0]?.points[0]).toEqual({ x: 10, y: 36 });
  expect(routes[0]?.points.at(-1)).toEqual({ x: 440, y: 280 });
});
/* oxlint-enable anti-slop/no-shape-in-symbol-names */

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

test('custom interior anchors leave node bounds before obstacle routing and return to authored endpoints', () => {
  const nodes: FlowGraph['nodes'] = [
    {
      id: 'a',
      label: 'A',
      position: { x: 0, y: 0 },
      size: { width: 160, height: 100 },
      ports: [{ id: 'out', kind: 'output', side: 'right', anchor: { x: 0.75, y: 0.2 } }],
    },
    {
      id: 'b',
      label: 'B',
      position: { x: 400, y: 100 },
      size: { width: 160, height: 100 },
      ports: [{ id: 'in', kind: 'input', side: 'left', anchor: { x: 0.25, y: 0.8 } }],
    },
  ];
  const result = routeForceEdges(nodes, [
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } },
  ]);
  expect(result).toHaveLength(1);
  expect(result[0]?.points[0]).toEqual({ x: 120, y: 20 });
  expect(result[0]?.points[1]).toEqual({ x: 176, y: 20 });
  expect(result[0]?.points.at(-1)).toEqual({ x: 440, y: 180 });
  expect(result[0]?.points.at(-2)).toEqual({ x: 384, y: 180 });
});
