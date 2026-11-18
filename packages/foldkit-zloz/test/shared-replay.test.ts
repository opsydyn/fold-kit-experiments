import { expect, test } from 'bun:test';

import {
  applyOperationChange,
  applyOperationChangeShared,
  createOperationDocument,
  decideOperation,
  parseGraph,
  parseOperationRequest,
} from '../src/index';
import type { ZlozOperationChange, ZlozOperationDocument } from '../src/index';
import fixture from './fixtures/operations-v1.json';

const scope = { actorId: 'alice', teamId: 'team-a', diagramId: 'diagram-a' };
const document = () =>
  createOperationDocument(parseGraph(JSON.stringify({ version: 1, graph: fixture.graph })));
const freeze = <T>(value: T): T => {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Recursively freeze already parsed JSON fixtures to prove input immutability.
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const accepted = (before: ZlozOperationDocument, text: string) => {
  const result = decideOperation(before, parseOperationRequest(text), scope);
  if (result.receipt.status !== 'accepted')
    throw new Error('Literal operation unexpectedly refused');
  return result.receipt.change;
};

test('immutable replay retains untouched graph identities while legacy replay still detaches the entire graph', () => {
  const before = freeze(document());
  const change = accepted(before, fixture.move);
  const result = applyOperationChangeShared(before, change);
  expect(result.graph.nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 70, y: 90 });
  expect(result.graph.nodes.find((node) => node.id === 'a')?.data).toEqual({
    host: { retain: [1, 'two', true] },
  });
  expect(result.graph.nodes.find((node) => node.id === 'b')).toBe(
    before.graph.nodes.find((node) => node.id === 'b'),
  );
  expect(result.graph.edges[0]).toBe(before.graph.edges[0]);
  expect(result.graph.nodes.find((node) => node.id === 'a')).not.toBe(
    before.graph.nodes.find((node) => node.id === 'a'),
  );
  const legacy = applyOperationChange(before, change);
  expect(result).toEqual(legacy);
  expect(legacy.graph.nodes.find((node) => node.id === 'b')).not.toBe(
    before.graph.nodes.find((node) => node.id === 'b'),
  );
  expect(before.graph.nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 10, y: 20 });
});

test.each(['move', 'rename', 'deleteGroup', 'removePort'] as const)(
  'immutable %s and Undo have exact legacy values, without modifying either input',
  (name) => {
    const before = freeze(document());
    const encoded = JSON.stringify(before);
    const change = freeze(accepted(before, fixture[name]));
    const result = applyOperationChangeShared(before, change);
    expect(result).toEqual(applyOperationChange(before, change));
    const undo = decideOperation(
      result,
      {
        version: 1,
        operationId: `undo-${name}`,
        operation: { type: 'Undo', operationId: change.operationId },
      },
      scope,
    );
    expect(undo.receipt.status).toBe('accepted');
    if (undo.receipt.status !== 'accepted') return;
    const reverted = applyOperationChangeShared(freeze(result), freeze(undo.receipt.change));
    expect(reverted).toEqual(applyOperationChange(result, undo.receipt.change));
    expect(reverted.graph).toEqual(before.graph);
    expect(JSON.stringify(before)).toBe(encoded);
  },
);

test('changed geometry and inserted JSON metadata detach from caller-owned patches', () => {
  const before = document();
  const move = structuredClone(accepted(before, fixture.move));
  const moved = applyOperationChangeShared(before, move);
  const geometry = move.nodes[0];
  if (geometry?.type !== 'geometry') throw new Error('Missing geometry fixture');
  Object.assign(geometry.after.position, { x: 999 });
  expect(moved.graph.nodes.find((node) => node.id === 'a')?.position.x).toBe(70);
  const node = {
    id: 'new',
    label: 'New node',
    position: { x: 5, y: 6 },
    size: { width: 80, height: 60 },
    ports: [],
    data: { nested: ['retained'] },
  };
  const change: ZlozOperationChange = {
    ...scope,
    operationId: 'add',
    fromVersion: 0,
    version: 1,
    undoOf: null,
    nodes: [
      {
        type: 'record',
        id: 'new',
        expected: null,
        index: before.graph.nodes.length,
        before: null,
        after: node,
      },
    ],
    edges: [],
  };
  const inserted = applyOperationChangeShared(before, change);
  node.data.nested.push('caller mutation');
  expect(inserted.graph.nodes.find((value) => value.id === 'new')?.data).toEqual({
    nested: ['retained'],
  });
  expect(before.graph.nodes.some((value) => value.id === 'new')).toBe(false);
});

test('immutable replay still rejects invalid predecessor, stale before-values, dangling ports and group cycles', () => {
  const before = freeze(document());
  const encoded = JSON.stringify(before);
  const move = accepted(before, fixture.move);
  const ports = before.graph.nodes.find((node) => node.id === 'a')!.ports;
  const cycle = {
    id: 'bad',
    label: 'Cycle',
    kind: 'group' as const,
    parentId: 'bad',
    position: { x: 0, y: 0 },
    size: { width: 80, height: 60 },
    ports: [],
  };
  const invalid: readonly ZlozOperationChange[] = [
    { ...move, fromVersion: 1, version: 2 },
    {
      ...move,
      nodes: [{ type: 'label', id: 'a', expected: 0, before: 'Wrong before', after: 'New' }],
    },
    { ...move, nodes: [{ type: 'ports', id: 'a', expected: 0, before: ports, after: [] }] },
    {
      ...move,
      nodes: [
        {
          type: 'record',
          id: 'bad',
          expected: null,
          index: before.graph.nodes.length,
          before: null,
          after: cycle,
        },
      ],
    },
  ];
  for (const change of invalid) expect(() => applyOperationChangeShared(before, change)).toThrow();
  expect(JSON.stringify(before)).toBe(encoded);
});

test('inserted edge metadata and edited port records detach while unchanged records remain shared', () => {
  const before = document();
  const edge = {
    id: 'extra',
    source: { node: 'a', port: 'out' },
    target: { node: 'b', port: 'in' },
    data: { note: ['original'] },
  };
  const change: ZlozOperationChange = {
    ...scope,
    operationId: 'edge',
    fromVersion: 0,
    version: 1,
    undoOf: null,
    nodes: [],
    edges: [
      { id: 'extra', expected: null, index: before.graph.edges.length, before: null, after: edge },
    ],
  };
  const result = applyOperationChangeShared(freeze(before), change);
  edge.data.note.push('caller mutation');
  Object.assign(edge.source, { node: 'g' });
  expect(result.graph.edges.find((value) => value.id === 'extra')?.data).toEqual({
    note: ['original'],
  });
  expect(result.graph.edges.find((value) => value.id === 'extra')?.source.node).toBe('a');
  expect(result.graph.nodes[0]).toBe(before.graph.nodes[0]);
  const port = {
    id: 'in',
    kind: 'input' as const,
    side: 'left' as const,
    anchor: { x: 0.25, y: 0.5 },
    label: 'Renamed input',
  };
  const portsChange: ZlozOperationChange = {
    ...scope,
    operationId: 'port-label',
    fromVersion: 0,
    version: 1,
    undoOf: null,
    nodes: [
      {
        type: 'ports',
        id: 'b',
        expected: 0,
        before: before.graph.nodes.find((node) => node.id === 'b')!.ports,
        after: [port],
      },
    ],
    edges: [],
  };
  const portsResult = applyOperationChangeShared(before, portsChange);
  expect(portsResult).toEqual(applyOperationChange(before, portsChange));
  Object.assign(port, { label: 'caller mutation' });
  port.anchor.x = 0.99;
  expect(portsResult.graph.nodes.find((value) => value.id === 'b')?.ports).toEqual([
    { id: 'in', kind: 'input', side: 'left', anchor: { x: 0.25, y: 0.5 }, label: 'Renamed input' },
  ]);
});
