import { expect, test } from 'bun:test';

import { createOperationDocument, isOperationDocument } from '../src/operations';

const nodes = Array.from({ length: 250 }, (_, index) => ({
  id: `n${index}`,
  label: `Node ${index}`,
  position: { x: index * 10, y: 0 },
  size: { width: 150, height: 80 },
  ports: [
    { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
    { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
  ],
}));
const edges = Array.from({ length: 500 }, (_, index) => ({
  id: `e${index}`,
  source: { node: `n${index % 250}`, port: 'out' },
  target: { node: `n${(index + 1) % 250}`, port: 'in' },
}));

test('document membership validation uses bounded identity reads for the declared graph', () => {
  const document = createOperationDocument({ nodes, edges });
  let reads = 0;
  const graph = {
    nodes: document.graph.nodes.map((node) => ({
      ...node,
      get id() {
        reads++;
        return node.id;
      },
    })),
    edges: document.graph.edges.map((edge) => ({
      ...edge,
      get id() {
        reads++;
        return edge.id;
      },
    })),
  };
  expect(isOperationDocument({ ...document, graph })).toBe(true);
  // Count actual input reads rather than using a host-dependent timing target.
  // Re-scanning all graph entities for each clock violates this linear budget.
  expect(reads).toBeLessThan(32 * (nodes.length + edges.length));
});

test('membership checks retain exact coverage, duplicate rejection and absent tombstones', () => {
  const document = createOperationDocument({ nodes, edges });
  const node = document.nodes[0]!;
  const edge = document.edges[0]!;
  expect(isOperationDocument({ ...document, nodes: document.nodes.slice(1) })).toBe(false);
  expect(isOperationDocument({ ...document, edges: document.edges.slice(1) })).toBe(false);
  expect(isOperationDocument({ ...document, nodes: [...document.nodes, node] })).toBe(false);
  expect(isOperationDocument({ ...document, edges: [...document.edges, edge] })).toBe(false);
  expect(
    isOperationDocument({
      ...document,
      nodes: [{ ...node, present: false }, ...document.nodes.slice(1)],
    }),
  ).toBe(false);
  expect(
    isOperationDocument({
      ...document,
      edges: [{ ...edge, present: false }, ...document.edges.slice(1)],
    }),
  ).toBe(false);
  expect(
    isOperationDocument({
      ...document,
      nodes: [...document.nodes, { ...node, id: 'missing', present: true }],
    }),
  ).toBe(false);
  expect(
    isOperationDocument({
      ...document,
      edges: [...document.edges, { ...edge, id: 'missing', present: true }],
    }),
  ).toBe(false);
  expect(
    isOperationDocument({
      ...document,
      nodes: [...document.nodes, { ...node, id: 'deleted-node', present: false }],
      edges: [...document.edges, { ...edge, id: 'deleted-edge', present: false }],
    }),
  ).toBe(true);
});
