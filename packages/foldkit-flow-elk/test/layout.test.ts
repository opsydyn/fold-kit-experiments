import { expect, test } from 'bun:test';

import {
  applyLayout,
  updateEditor,
  createEditor,
  layoutRequest,
  portPosition,
  type FlowGraph,
} from '@opsydyn/foldkit-flow';

import { createElkLayout } from '../src/index';

const graph: FlowGraph = {
  nodes: [
    {
      id: 'root',
      label: 'Source',
      position: { x: 10, y: 10 },
      size: { width: 140, height: 90 },
      ports: [{ id: 'p:0:0', kind: 'output', side: 'right', offset: 0.25 }],
    },
    {
      id: 'n:0',
      label: 'Sink',
      position: { x: 10, y: 10 },
      size: { width: 180, height: 120 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.75 }],
    },
  ],
  edges: [
    { id: 'e:0', source: { node: 'root', port: 'p:0:0' }, target: { node: 'n:0', port: 'in' } },
  ],
};
const nodeA = graph.nodes[0];
const nodeB = graph.nodes[1];
if (!nodeA || !nodeB) throw new Error('Fixture requires two nodes');

test('real ELK lays out variable-size nodes, fixed ports and routes without mutating the input', async () => {
  const request = layoutRequest(createEditor(graph), 'arrange:1');
  const before = JSON.stringify(request);
  const result = await createElkLayout()(request);
  expect(result.requestId).toBe('arrange:1');
  expect(result.revision).toBe(0);
  const source = result.positions.find((n) => n.id === 'root');
  const target = result.positions.find((n) => n.id === 'n:0');
  if (!source || !target) throw new Error('Missing laid-out nodes');
  expect(target.x).toBeGreaterThan(source.x + 140);
  expect(result.routes).toHaveLength(1);
  expect(result.routes[0]?.id).toBe('e:0');
  expect(result.routes[0]?.points[0]).toEqual(
    portPosition({ ...nodeA, position: source }, 'p:0:0'),
  );
  expect(result.routes[0]?.points.at(-1)).toEqual(
    portPosition({ ...nodeB, position: target }, 'in'),
  );
  expect(JSON.stringify(request)).toBe(before);
});

test('empty and disconnected graphs remain valid; caller-supplied engines retain ownership', async () => {
  const empty = await createElkLayout()(
    layoutRequest(createEditor({ nodes: [], edges: [] }), 'empty'),
  );
  expect(empty.positions).toEqual([]);
  expect(empty.routes).toEqual([]);
  const result = await createElkLayout({ direction: 'DOWN' })(
    layoutRequest(createEditor({ ...graph, edges: [] }), 'separate'),
  );
  expect(result.positions).toHaveLength(2);
  expect(new Set(result.positions.map((p) => `${p.x},${p.y}`)).size).toBe(2);
});

test('engine failures propagate instead of publishing fabricated positions', async () => {
  const error = new Error('Layout failed');
  const layout = createElkLayout({ elk: { layout: () => Promise.reject(error) } });
  await expect(layout(layoutRequest(createEditor(graph), 'failed'))).rejects.toBe(error);
});

test('real ELK lays out nested boundaries and joins routes that cross them', async () => {
  const boundary = {
    kind: 'group' as const,
    label: 'Boundary',
    position: { x: 0, y: 0 },
    size: { width: 600, height: 400 },
    ports: [],
  };
  const before = createEditor({
    nodes: [
      { ...boundary, id: 'outer' },
      { ...boundary, id: 'inner', parentId: 'outer' },
      { ...nodeA, parentId: 'outer' },
      { ...nodeB, parentId: 'inner' },
    ],
    edges: graph.edges,
  });
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const request = layoutRequest(before, direction);
    const result = await createElkLayout({ direction })(request);
    const arranged = applyLayout(before, request, result);
    const nodes = new Map(arranged.graph.nodes.map((node) => [node.id, node]));
    for (const node of arranged.graph.nodes) {
      if (node.parentId === undefined) continue;
      const parent = nodes.get(node.parentId);
      if (!parent) throw new Error('Missing parent');
      expect(node.position.x).toBeGreaterThanOrEqual(parent.position.x);
      expect(node.position.y).toBeGreaterThanOrEqual(parent.position.y + 52);
      expect(node.position.x + node.size.width).toBeLessThanOrEqual(
        parent.position.x + parent.size.width,
      );
      expect(node.position.y + node.size.height).toBeLessThanOrEqual(
        parent.position.y + parent.size.height,
      );
    }
    const source = nodes.get(nodeA.id);
    const sink = nodes.get(nodeB.id);
    if (!source || !sink) throw new Error('Missing endpoints');
    expect(arranged.routes[0]?.points[0]).toEqual(portPosition(source, 'p:0:0'));
    expect(arranged.routes[0]?.points.at(-1)).toEqual(portPosition(sink, 'in'));
    expect(updateEditor(arranged, { type: 'UndoPressed' }).graph).toEqual(before.graph);
  }
});
