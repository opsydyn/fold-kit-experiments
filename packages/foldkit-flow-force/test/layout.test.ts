import { expect, test } from 'bun:test';

import { applyLayout, createEditor, layoutRequest, type FlowGraph } from '@opsydyn/foldkit-flow';

import { createForceLayout, supportsForceLayout } from '../src/index';

const graph: FlowGraph = {
  nodes: [0, 1, 2, 3].map((index) => ({
    id: String(index),
    label: String(index),
    position: { x: index * 240, y: 0 },
    size: { width: 140 + index * 60, height: 80 + index * 20 },
    ports: [
      { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
      { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
    ],
  })),
  edges: [0, 1, 2].map((index) => ({
    id: String(index),
    source: { node: String(index), port: 'out' },
    target: { node: String(index + 1), port: 'in' },
  })),
};

test('public engine arranges mixed cards deterministically and integrates with core undo', async () => {
  const before = JSON.stringify(graph);
  const state = createEditor(graph);
  const request = layoutRequest(state, 'force');
  const engine = createForceLayout();
  const result = await engine(request);
  expect(await engine(request)).toEqual(result);
  expect(result.requestId).toBe(request.requestId);
  expect(result.revision).toBe(request.revision);
  expect(JSON.stringify(graph)).toBe(before);
  const arranged = applyLayout(state, request, result);
  expect(arranged.past).toHaveLength(1);
  expect(arranged.graph.edges).toEqual(graph.edges);
  expect(result.routes).toHaveLength(graph.edges.length);
  for (const [index, node] of arranged.graph.nodes.entries())
    for (const other of arranged.graph.nodes.slice(index + 1))
      expect(
        node.position.x >= other.position.x + other.size.width ||
          other.position.x >= node.position.x + node.size.width ||
          node.position.y >= other.position.y + other.size.height ||
          other.position.y >= node.position.y + node.size.height,
      ).toBe(true);
});

test('public engine rejects unsupported and malformed graphs', async () => {
  const engine = createForceLayout();
  const empty = { nodes: [], edges: [] };
  const grouped: FlowGraph = {
    nodes: [
      {
        id: 'g',
        kind: 'group',
        label: 'Group',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 },
        ports: [],
      },
    ],
    edges: [],
  };
  expect(supportsForceLayout(empty)).toBe(false);
  expect(supportsForceLayout(grouped)).toBe(false);
  await expect(engine({ graph: grouped, requestId: 'group', revision: 0 })).rejects.toThrow(
    'flat graph',
  );
  await expect(engine({ graph: empty, requestId: 'empty', revision: 0 })).rejects.toThrow(
    'flat graph',
  );
  const invalid = { ...graph, nodes: [...graph.nodes, ...graph.nodes] };
  await expect(engine({ graph: invalid, requestId: 'invalid', revision: 0 })).rejects.toThrow();
});
