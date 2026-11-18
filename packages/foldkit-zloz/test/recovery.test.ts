import { expect, test } from 'bun:test';

import { createOperationDocument, decideOperation } from '../src/operations';
import { recoverOperationDocument } from '../src/recovery';

const original = {
  nodes: [
    {
      id: 'a',
      label: 'Original',
      position: { x: 10, y: 20 },
      size: { width: 120, height: 80 },
      ports: [],
      data: { keep: true },
    },
  ],
  edges: [],
};
const scope = { teamId: 'team', diagramId: 'diagram', actorId: 'actor' };
test('recovery is a new versioned edit, preserves consumed identities and invalidates old inverses', () => {
  const initial = createOperationDocument(original);
  const deleted = decideOperation(
    initial,
    {
      version: 1,
      operationId: 'delete',
      operation: { type: 'Delete', expectedVersion: 0, nodeIds: ['a'], edgeIds: [] },
    },
    scope,
  ).document;
  const restored = recoverOperationDocument(deleted, original, 1);
  expect(restored.status).toBe('restored');
  expect(restored.document.version).toBe(2);
  expect(restored.document.graph).toEqual(original);
  expect(restored.document.nodes).toEqual([
    { id: 'a', present: true, version: 2, geometry: 2, label: 2, ports: 2 },
  ]);
  expect(restored.document.undo).toEqual([]);
  expect(deleted.graph.nodes).toEqual([]);
  const wrongVersion = recoverOperationDocument(restored.document, { nodes: [], edges: [] }, 1);
  expect(wrongVersion.status).toBe('conflict');
  expect(wrongVersion.document).toBe(restored.document);
});
test('recovery cannot erase a concurrently accepted change, and missing restored IDs remain tombstoned', () => {
  const first = createOperationDocument(original);
  const renamed = decideOperation(
    first,
    {
      version: 1,
      operationId: 'rename',
      operation: { type: 'RenameNode', id: 'a', expected: 0, label: 'Peer' },
    },
    scope,
  ).document;
  expect(recoverOperationDocument(renamed, original, 0).document.graph.nodes[0]?.label).toBe(
    'Peer',
  );
  const removed = recoverOperationDocument(renamed, { nodes: [], edges: [] }, 1);
  expect(removed.document.nodes[0]).toEqual({
    id: 'a',
    present: false,
    version: 2,
    geometry: 2,
    label: 2,
    ports: 2,
  });
  expect(recoverOperationDocument(removed.document, { nodes: [], edges: [] }, 2).status).toBe(
    'unchanged',
  );
  expect(() =>
    recoverOperationDocument(
      first,
      { nodes: [{ ...original.nodes[0]!, parentId: 'missing' }], edges: [] },
      0,
    ),
  ).toThrow();
});
