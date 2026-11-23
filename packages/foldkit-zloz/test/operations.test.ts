import { expect, test } from 'bun:test';

import { createEditor } from '../src/editor';
import { parseGraph, serializeGraph } from '../src/graph';
import {
  parseOperationRequest,
  serializeOperationRequest,
  canonicalOperationValue,
} from '../src/operation-codec';
import { applyEditorOperation } from '../src/operation-editor';
import type { ZlozOperationDocument, ZlozOperationRequest } from '../src/operation-types';
import {
  createOperationDocument,
  decideOperation,
  applyOperationChange,
  isOperationDocument,
  isOperationReceipt,
} from '../src/operations';
import fixture from './fixtures/operations-v1.json';

const graph = () => parseGraph(JSON.stringify({ version: 1, graph: fixture.graph }));
const scope = { actorId: 'alice', teamId: 'team-a', diagramId: 'diagram-a' };
const request = (text: string) => parseOperationRequest(text);
const decide = (document: ZlozOperationDocument, input: ZlozOperationRequest, actorId = 'alice') =>
  decideOperation(document, input, { ...scope, actorId });

test('literal move, teammate rename and conditional Undo retain the teammate label and legacy metadata', () => {
  const initial = createOperationDocument(graph());
  const moved = decide(initial, request(fixture.move));
  expect(moved.type).toBe('accepted');
  expect(moved.document.graph.nodes[0]?.position).toEqual({ x: 70, y: 90 });
  const renamed = decide(moved.document, request(fixture.rename), 'bob');
  const undone = decide(renamed.document, request(fixture.undoMove));
  expect(undone.type).toBe('accepted');
  expect(undone.document.version).toBe(3);
  expect(undone.document.graph).toEqual(
    parseGraph(
      JSON.stringify({
        version: 1,
        graph: {
          ...fixture.graph,
          nodes: fixture.graph.nodes.map((node) =>
            node.id === 'a' ? { ...node, label: 'Teammate name' } : node,
          ),
        },
      }),
    ),
  );
  expect(serializeGraph(initial.graph)).toBe(serializeGraph(graph()));
});

test('overlapping moves, ABA geometry and deletion invalidate an old inverse without resurrecting data', () => {
  const moved = decide(createOperationDocument(graph()), request(fixture.move));
  const later: ZlozOperationRequest = {
    version: 1,
    operationId: 'bob-move',
    operation: { type: 'MoveNodes', nodes: [{ id: 'a', expected: 1, position: { x: 10, y: 20 } }] },
  };
  const returned = decide(moved.document, later, 'bob');
  const refused = decide(returned.document, request(fixture.undoMove));
  expect(refused.receipt.status).toBe('rejected');
  expect(refused.receipt.code).toBe('Conflict');
  expect(refused.document).toBe(returned.document);
  const deleted = decide(
    moved.document,
    {
      version: 1,
      operationId: 'bob-delete',
      operation: { type: 'Delete', expectedVersion: 1, nodeIds: ['a'], edgeIds: [] },
    },
    'bob',
  );
  expect(decide(deleted.document, request(fixture.undoMove)).receipt.status).toBe('rejected');
  expect(deleted.document.graph.nodes.some((node) => node.id === 'a')).toBe(false);
});

test('group and port deletion are atomic, include incident edges and respect complete-candidate policy vetoes', () => {
  const initial = createOperationDocument(graph());
  const removed = decide(initial, request(fixture.deleteGroup));
  expect(removed.document.graph.nodes.map((node) => node.id)).toEqual(['a', 'b']);
  expect(removed.document.graph.edges.map((edge) => edge.id)).toEqual(['ab']);
  const portRemoved = decide(initial, request(fixture.removePort));
  expect(portRemoved.document.graph.edges).toEqual([]);
  expect(portRemoved.document.graph.nodes[1]?.ports).toEqual([]);
  const denied = decideOperation(initial, request(fixture.deleteGroup), scope, {
    canDelete: (candidate) =>
      candidate.nodes.some((node) => node.id === 'c') ? 'Child is protected' : null,
  });
  expect(denied.receipt.code).toBe('Protected');
  expect(denied.document).toBe(initial);
  const undo = decide(removed.document, {
    version: 1,
    operationId: 'undo-delete',
    operation: { type: 'Undo', operationId: 'delete-group' },
  });
  expect(undo.document.graph).toEqual(initial.graph);
});

test('the production local editor bridge shares the decision, makes one checkpoint and keeps rejected history untouched', () => {
  const document = createOperationDocument(graph());
  const editor = createEditor(document.graph);
  const result = applyEditorOperation(editor, document, request(fixture.move), scope);
  expect(result.decision.document.graph.nodes[0]?.position).toEqual({ x: 70, y: 90 });
  expect(result.editor.past).toEqual([editor.graph]);
  expect(result.editor.revision).toBe(editor.revision + 1);
  const denied = applyEditorOperation(
    result.editor,
    result.decision.document,
    request(fixture.move),
    scope,
  );
  expect(denied.editor).toBe(result.editor);
  expect(denied.decision.receipt.status).toBe('rejected');
  expect(denied.editor.past).toHaveLength(1);
});

test('wire codecs reject unknown commands, missing preconditions, non-finite numbers and injected authority', () => {
  for (const operation of [
    { type: 'NodeMeasured', id: 'a', height: 999 },
    { type: 'RenameNode', id: 'a', label: 'Missing expected' },
    { type: 'MoveNodes', nodes: [{ id: 'a', expected: 0, position: { x: null, y: 0 } }] },
    { type: 'RenameNode', id: 'a', expected: 0, label: 'Forged', actorId: 'owner' },
  ])
    expect(() =>
      parseOperationRequest(JSON.stringify({ version: 1, operationId: 'bad', operation })),
    ).toThrow();
  const input = request(fixture.move);
  expect(request(serializeOperationRequest(input))).toEqual(input);
  expect(canonicalOperationValue({ b: 2, a: 1 })).toBe(canonicalOperationValue({ a: 1, b: 2 }));
});

test('accepted changes replay exactly; gaps and stale field preconditions cannot partially apply', () => {
  const initial = createOperationDocument(graph());
  const moved = decide(initial, request(fixture.move));
  if (moved.receipt.status !== 'accepted') throw new Error('Expected literal move acceptance');
  expect(applyOperationChange(initial, moved.receipt.change)).toEqual(moved.document);
  const change = moved.receipt.change;
  expect(() => applyOperationChange(moved.document, change)).toThrow();
  const stale = decide(moved.document, {
    version: 1,
    operationId: 'stale-batch',
    operation: {
      type: 'MoveNodes',
      nodes: [
        { id: 'b', expected: 0, position: { x: 600, y: 0 } },
        { id: 'a', expected: 0, position: { x: 0, y: 0 } },
      ],
    },
  });
  expect(stale.receipt.code).toBe('Conflict');
  expect(stale.document).toBe(moved.document);
});

test('ABA returning to the original accepted position still invalidates the old inverse by field version', () => {
  const moved = decide(createOperationDocument(graph()), request(fixture.move));
  const out = decide(
    moved.document,
    {
      version: 1,
      operationId: 'bob-out',
      operation: {
        type: 'MoveNodes',
        nodes: [{ id: 'a', expected: 1, position: { x: 200, y: 200 } }],
      },
    },
    'bob',
  );
  const back = decide(
    out.document,
    {
      version: 1,
      operationId: 'bob-back',
      operation: {
        type: 'MoveNodes',
        nodes: [{ id: 'a', expected: 2, position: { x: 70, y: 90 } }],
      },
    },
    'bob',
  );
  const undo = decide(back.document, request(fixture.undoMove));
  expect(undo.receipt.status).toBe('rejected');
  expect(undo.receipt.code).toBe('Conflict');
  expect(undo.document).toBe(back.document);
});

test('explicit IDs, authored resize, directed connections and tombstones have the same validation boundary', () => {
  const initial = createOperationDocument(graph());
  const added = decide(initial, {
    version: 1,
    operationId: 'add-node',
    operation: {
      type: 'AddNode',
      expectedVersion: 0,
      node: {
        id: 'stable-new-id',
        label: 'New',
        position: { x: 500, y: 20 },
        size: { width: 120, height: 80 },
        ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
        data: { retain: true },
      },
    },
  });
  expect(added.receipt.status).toBe('accepted');
  const resized = decide(added.document, {
    version: 1,
    operationId: 'resize-new',
    operation: {
      type: 'ResizeNodes',
      nodes: [
        {
          id: 'stable-new-id',
          expected: 1,
          frame: { position: { x: 500, y: 20 }, size: { width: 160, height: 100 } },
        },
      ],
    },
  });
  expect(resized.document.graph.nodes.at(-1)?.size).toEqual({ width: 160, height: 100 });
  const connected = decide(resized.document, {
    version: 1,
    operationId: 'connect-new',
    operation: {
      type: 'Connect',
      expectedVersion: 2,
      edge: {
        id: 'stable-new-edge',
        source: { node: 'a', port: 'out' },
        target: { node: 'stable-new-id', port: 'in' },
        data: { retain: 'relationship' },
      },
    },
  });
  expect(connected.document.graph.edges.at(-1)?.id).toBe('stable-new-edge');
  const invalid = decide(connected.document, {
    version: 1,
    operationId: 'bad-connection',
    operation: {
      type: 'Connect',
      expectedVersion: 3,
      edge: {
        id: 'invalid-edge',
        source: { node: 'b', port: 'in' },
        target: { node: 'stable-new-id', port: 'in' },
      },
    },
  });
  expect(invalid.receipt.code).toBe('InvalidGraph');
  expect(invalid.document).toBe(connected.document);
  const deleted = decide(connected.document, {
    version: 1,
    operationId: 'delete-new',
    operation: { type: 'Delete', expectedVersion: 3, nodeIds: ['stable-new-id'], edgeIds: [] },
  });
  const reused = decide(deleted.document, {
    version: 1,
    operationId: 'reuse-id',
    operation: {
      type: 'AddNode',
      expectedVersion: 4,
      node: {
        id: 'stable-new-id',
        label: 'Reused',
        position: { x: 0, y: 0 },
        size: { width: 1, height: 1 },
        ports: [],
      },
    },
  });
  expect(reused.receipt.code).toBe('IdentityUsed');
  expect(reused.document).toBe(deleted.document);
});

test('group movement requires all descendants and inverse policies are checked against affected fields', () => {
  const initial = createOperationDocument(graph());
  const incomplete = decide(initial, {
    version: 1,
    operationId: 'partial-group',
    operation: {
      type: 'MoveNodes',
      nodes: [{ id: 'g', expected: 0, position: { x: 100, y: 300 } }],
    },
  });
  expect(incomplete.receipt.code).toBe('Conflict');
  expect(incomplete.document).toBe(initial);
  const complete = decide(initial, {
    version: 1,
    operationId: 'whole-group',
    operation: {
      type: 'MoveNodes',
      nodes: [
        { id: 'g', expected: 0, position: { x: 100, y: 300 } },
        { id: 'c', expected: 0, position: { x: 130, y: 330 } },
      ],
    },
  });
  expect(complete.receipt.status).toBe('accepted');
  const renamed = decide(initial, request(fixture.rename));
  const requestUndo: ZlozOperationRequest = {
    version: 1,
    operationId: 'undo-rename',
    operation: { type: 'Undo', operationId: 'rename-b' },
  };
  expect(decide(renamed.document, requestUndo, 'bob').receipt.code).toBe('UndoUnavailable');
  const veto = decideOperation(renamed.document, requestUndo, scope, {
    canApplyOperation: (_operation, _graph, _scope, change) =>
      change.nodes.some((patch) => patch.type === 'label') ? 'Naming is now protected' : null,
  });
  expect(veto.receipt.code).toBe('Protected');
  expect(veto.document).toBe(renamed.document);
});

test('the bounded Undo window expires explicitly and does not erase the graph or field clocks', () => {
  let document = createOperationDocument(graph());
  for (let index = 0; index < 101; index += 1)
    document = decide(document, {
      version: 1,
      operationId: `rename-${index}`,
      operation: { type: 'RenameNode', id: 'a', expected: index, label: `Name ${index}` },
    }).document;
  expect(document.version).toBe(101);
  expect(document.undo).toHaveLength(100);
  const refused = decide(document, {
    version: 1,
    operationId: 'too-old',
    operation: { type: 'Undo', operationId: 'rename-0' },
  });
  expect(refused.receipt.code).toBe('UndoUnavailable');
  expect(refused.document).toBe(document);
  expect(refused.document.graph.nodes[0]?.label).toBe('Name 100');
});

test('persisted operation state and receipts reject corrupt field clocks and malformed accepted changes', () => {
  const document = createOperationDocument(graph());
  expect(isOperationDocument(document)).toBe(true);
  expect(
    isOperationDocument({
      ...document,
      nodes: document.nodes.map((clock) => ({ ...clock, geometry: 99 })),
    }),
  ).toBe(false);
  expect(
    isOperationDocument({
      ...document,
      undo: [{ actorId: 'alice', operationId: 'forged', inverse: { nodes: [{}], edges: [] } }],
    }),
  ).toBe(false);
  const accepted = decide(document, request(fixture.move));
  expect(isOperationReceipt(accepted.receipt)).toBe(true);
  expect(isOperationReceipt({ ...accepted.receipt, change: {} })).toBe(false);
  expect(isOperationReceipt({ ...accepted.receipt, actorId: 'bob' })).toBe(false);
  const legacy = graph();
  const longId = 'legacy:'.repeat(100);
  const original = legacy.nodes[0];
  if (!original) throw new Error('Missing literal legacy node');
  const longDocument = createOperationDocument({ nodes: [{ ...original, id: longId }], edges: [] });
  expect(isOperationDocument(longDocument)).toBe(true);
  expect(
    decide(longDocument, {
      version: 1,
      operationId: 'rename-long',
      operation: { type: 'RenameNode', id: longId, expected: 0, label: 'Kept legacy identity' },
    }).receipt.status,
  ).toBe('accepted');
});

test('a decimal group translation accepts floating-point rounding while retaining the exact authored positions', () => {
  const initialGraph = graph();
  const document = createOperationDocument({
    ...initialGraph,
    nodes: initialGraph.nodes.map((node) =>
      node.id === 'g'
        ? { ...node, position: { x: 0.1, y: 200 } }
        : node.id === 'c'
          ? { ...node, position: { x: 0.2, y: 230 } }
          : node,
    ),
  });
  const result = decide(document, {
    version: 1,
    operationId: 'decimal-group',
    operation: {
      type: 'MoveNodes',
      nodes: [
        { id: 'g', expected: 0, position: { x: 0.3, y: 200 } },
        { id: 'c', expected: 0, position: { x: 0.4, y: 230 } },
      ],
    },
  });
  expect(result.receipt.status).toBe('accepted');
  expect(result.document.graph.nodes.find((node) => node.id === 'g')?.position.x).toBe(0.3);
  expect(result.document.graph.nodes.find((node) => node.id === 'c')?.position.x).toBe(0.4);
});

test('a shared icon change replays, rejects a stale selection and undoes without reverting a peer rename', () => {
  const initial = createOperationDocument(graph());
  const set = request(
    '{"version":1,"operationId":"set-icon","operation":{"type":"SetNodeIcon","id":"a","expected":0,"icon":"builtin:database"}}',
  );
  const changed = decide(initial, set);
  expect(changed.type).toBe('accepted');
  if (changed.type !== 'accepted') throw new Error('Expected the icon change to be accepted');
  expect(parseGraph(serializeGraph(changed.document.graph)).nodes[0]?.icon).toBe(
    'builtin:database',
  );
  expect(applyOperationChange(initial, changed.receipt.change)).toEqual(changed.document);
  expect(isOperationDocument(changed.document)).toBe(true);
  const peer = decide(changed.document, request(fixture.rename), 'bob');
  expect(peer.type).toBe('accepted');
  const stale = decide(peer.document, { ...set, operationId: 'stale-icon' });
  expect(stale.receipt.code).toBe('Conflict');
  const undone = decide(
    peer.document,
    request(
      '{"version":1,"operationId":"undo-icon","operation":{"type":"Undo","operationId":"set-icon"}}',
    ),
  );
  expect(undone.type).toBe('accepted');
  expect(undone.document.graph.nodes[0]?.icon).toBeUndefined();
  expect(undone.document.graph.nodes[0]?.label).toBe(peer.document.graph.nodes[0]?.label);
});

test('an empty-board import is one replayable edit and cannot overwrite a peer or a newer empty board', () => {
  const empty = createOperationDocument({ nodes: [], edges: [] });
  const imported = graph();
  const operation = request(
    JSON.stringify({
      version: 1,
      operationId: 'import-reviewed',
      operation: { type: 'ImportEmptyBoard', expectedVersion: 0, graph: imported },
    }),
  );
  const result = decide(empty, operation);
  expect(result.type).toBe('accepted');
  if (result.receipt.status !== 'accepted') throw new Error('Import should be accepted');
  expect(result.document.version).toBe(1);
  expect(result.document.graph).toEqual(imported);
  expect(applyOperationChange(empty, result.receipt.change).graph).toEqual(imported);

  const rejected = decide(
    result.document,
    {
      ...operation,
      operationId: 'peer',
      operation: { type: 'ImportEmptyBoard', expectedVersion: 1, graph: imported },
    },
    'bob',
  );
  expect(rejected.receipt).toMatchObject({ status: 'rejected', code: 'Conflict' });
  expect(rejected.document).toBe(result.document);

  const undone = decide(result.document, {
    version: 1,
    operationId: 'undo-import',
    operation: { type: 'Undo', operationId: 'import-reviewed' },
  });
  expect(undone.document.graph.nodes).toEqual([]);
  expect(undone.document.graph.edges).toEqual([]);
  expect(
    decide(undone.document, { ...operation, operationId: 'stale-preview' }, 'bob').receipt,
  ).toMatchObject({ status: 'rejected', code: 'Conflict' });
});
