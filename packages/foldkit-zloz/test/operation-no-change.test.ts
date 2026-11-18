import { expect, test } from 'bun:test';

import { parseGraph } from '../src/graph';
import type { ZlozGraphOperation } from '../src/operation-types';
import { createOperationDocument, decideOperation } from '../src/operations';
import fixture from './fixtures/operations-v1.json';

const scope = { actorId: 'alice', teamId: 'team-a', diagramId: 'diagram-a' };

test('a label decision retains full replay validation without canonicalizing unrelated labels', () => {
  const initial = createOperationDocument({
    nodes: Array.from({ length: 250 }, (_, index) => ({
      id: `n${index}`,
      label: `Node ${index}`,
      position: { x: (index % 10) * 180, y: Math.floor(index / 10) * 120 },
      size: { width: 150, height: 80 },
      ports: [
        { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
        { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
      ],
    })),
    edges: Array.from({ length: 500 }, (_, index) => ({
      id: `e${index}`,
      source: { node: `n${index % 250}`, port: 'out' },
      target: { node: `n${(index + 1) % 250}`, port: 'in' },
    })),
  });
  let labelReads = 0;
  const input = {
    ...initial,
    graph: {
      ...initial.graph,
      nodes: initial.graph.nodes.map((node) => ({
        ...node,
        get label() {
          labelReads++;
          return node.label;
        },
      })),
    },
  };
  const result = decideOperation(
    input,
    {
      version: 1,
      operationId: 'rename',
      operation: { type: 'RenameNode', id: 'n0', expected: 0, label: 'Changed' },
    },
    scope,
  );
  // Allow the complete input validation and detached copy. Detect the additional
  // complete-graph canonical comparison without a host-dependent timing budget.
  expect(labelReads).toBeLessThan(540);
  expect(result.receipt).toMatchObject({ status: 'accepted', documentVersion: 1 });
  expect(result.document.graph).toEqual({
    ...initial.graph,
    nodes: initial.graph.nodes.map((node) =>
      node.id === 'n0' ? { ...node, label: 'Changed' } : node,
    ),
  });
  expect(input.graph.nodes[0]?.label).toBe('Node 0');
});

test('no-op fields and invalid empty edits preserve the document and consume no clock or inverse', () => {
  const document = createOperationDocument(
    parseGraph(JSON.stringify({ version: 1, graph: fixture.graph })),
  );
  const a = document.graph.nodes.find((node) => node.id === 'a')!;
  const operations: readonly ZlozGraphOperation[] = [
    { type: 'RenameNode', id: 'a', expected: 0, label: a.label },
    { type: 'MoveNodes', nodes: [{ id: 'a', expected: 0, position: a.position }] },
    {
      type: 'ResizeNodes',
      nodes: [{ id: 'a', expected: 0, frame: { position: a.position, size: a.size } }],
    },
    { type: 'MoveNodes', nodes: [] },
    { type: 'ResizeNodes', nodes: [] },
    { type: 'Delete', expectedVersion: 0, nodeIds: [], edgeIds: [] },
  ];
  for (const [index, operation] of operations.entries()) {
    const result = decideOperation(
      document,
      { version: 1, operationId: `no-op-${index}`, operation },
      scope,
    );
    expect(result.receipt).toMatchObject({
      status: 'rejected',
      code: index < 3 ? 'NoChange' : 'InvalidOperation',
    });
    expect(result.document).toBe(document);
    expect(result.document.version).toBe(0);
    expect(result.document.undo).toEqual([]);
  }
  const stale = decideOperation(
    document,
    {
      version: 1,
      operationId: 'stale-no-op',
      operation: { type: 'RenameNode', id: 'a', expected: 1, label: a.label },
    },
    scope,
  );
  expect(stale.receipt).toMatchObject({ status: 'rejected', code: 'Conflict' });
  const invalid = decideOperation(
    {
      ...document,
      graph: {
        ...document.graph,
        edges: [{ ...document.graph.edges[0]!, target: { node: 'missing', port: 'in' } }],
      },
    },
    { version: 1, operationId: 'invalid-no-op', operation: operations[0]! },
    scope,
  );
  expect(invalid.receipt).toMatchObject({ status: 'rejected', code: 'InvalidGraph' });
});
