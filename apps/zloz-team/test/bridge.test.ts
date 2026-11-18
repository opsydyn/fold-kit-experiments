import { expect, test } from 'bun:test';

import {
  createEditor,
  createOperationDocument,
  decideOperation,
  parseGraph,
} from '@opsydyn/foldkit-zloz';
import type { EditorState } from '@opsydyn/foldkit-zloz';
import type { DiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';

import fixture from '../../../packages/foldkit-zloz/test/fixtures/operations-v1.json';
import { bridgeEvent } from '../src/editor/bridge';
import { liveFrames } from '../src/editor/protocol';

const graph = () => parseGraph(JSON.stringify({ version: 1, graph: fixture.graph }));
const scope = { teamId: 't', diagramId: 'd', actorId: 'a' };
test('completed local gestures use observed field clocks and never snapshot Undo', () => {
  const document = createOperationDocument(graph());
  const editor = { ...createEditor(graph()), selectedNodes: ['a'] };
  const result = bridgeEvent(
    editor,
    { type: 'SelectionNudged', delta: { x: 5, y: 0 } },
    document,
    'stable-edge',
  );
  expect(result.editor.past).toEqual([]);
  expect(result.operation).toMatchObject({
    type: 'MoveNodes',
    nodes: [{ id: 'a', expected: 0, position: { x: 15, y: 20 } }],
  });
  if (!result.operation) throw new Error('Expected a gesture operation');
  const renamed = decideOperation(
    document,
    {
      version: 1,
      operationId: 'peer-rename',
      operation: { type: 'RenameNode', id: 'a', expected: 0, label: 'Peer label' },
    },
    { ...scope, actorId: 'b' },
  );
  const moved = decideOperation(
    renamed.document,
    { version: 1, operationId: 'move', operation: result.operation },
    scope,
  );
  expect(moved.type).toBe('accepted');
  expect(moved.document.graph.nodes[0]).toMatchObject({
    label: 'Peer label',
    position: { x: 15, y: 20 },
  });
});
test('measurements, layout-like local changes, reparenting and snapshot Undo cannot become shared operations', () => {
  const document = createOperationDocument(graph());
  const editor = createEditor(graph());
  for (const event of [
    { type: 'NodeMeasured', id: 'a', size: { width: 999, height: 999 } },
    { type: 'SelectionGrouped' },
    { type: 'UndoPressed' },
    { type: 'DuplicatePressed' },
  ] as const) {
    expect(bridgeEvent(editor, event, document, 'stable').operation).toBeNull();
    expect(bridgeEvent(editor, event, document, 'stable').editor.graph).toEqual(editor.graph);
  }
  const selected: EditorState = { ...editor, selectedNodes: ['a'] };
  const resized = bridgeEvent(
    selected,
    { type: 'NodeWidthChanged', id: 'a', width: 180 },
    document,
    'stable',
  );
  expect(resized.operation).toMatchObject({
    type: 'ResizeNodes',
    nodes: [{ id: 'a', expected: 0, frame: { size: { width: 180, height: 80 } } }],
  });
});
test('literal pinned live RPC envelope accepts only validated public frames', () => {
  const frame: DiagramFrame = {
    target: scope,
    sourceVersion: 9,
    document: createOperationDocument(graph()),
    coverage: [],
  };
  expect(
    liveFrames(
      JSON.stringify({ _tag: 'Chunk', requestId: '1', values: [{ state: frame, cursor: 999 }] }),
    ),
  ).toEqual([frame]);
  expect(liveFrames('{"_tag":"Exit"}\n{broken')).toEqual([]);
  expect(
    liveFrames(
      JSON.stringify({
        _tag: 'Chunk',
        values: [{ state: { ...frame, document: { ...frame.document, undo: [{}] } } }],
      }),
    ),
  ).toEqual([]);
});

test('releasing a navigation gesture cannot turn stale peer geometry into a local move', () => {
  const document = createOperationDocument(graph());
  const editor = bridgeEvent(
    createEditor(graph()),
    { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } },
    document,
    'stable',
  ).editor;
  const moved = decideOperation(
    document,
    {
      version: 1,
      operationId: 'peer-move',
      operation: {
        type: 'MoveNodes',
        nodes: [{ id: 'a', expected: 0, position: { x: 70, y: 90 } }],
      },
    },
    { ...scope, actorId: 'b' },
  );
  expect(
    bridgeEvent(editor, { type: 'PointerReleased', pointer: 1 }, moved.document, 'stable')
      .operation,
  ).toBeNull();
});

test('an unrelated pointer release does not commit the active node preview', () => {
  const document = createOperationDocument(graph());
  const start = bridgeEvent(
    createEditor(graph()),
    { type: 'NodeDragStarted', id: 'a', pointer: 1, point: { x: 0, y: 0 } },
    document,
    'stable',
  ).editor;
  const moved = bridgeEvent(
    start,
    { type: 'PointerMoved', pointer: 1, point: { x: 30, y: 30 } },
    document,
    'stable',
  ).editor;
  const unrelated = bridgeEvent(moved, { type: 'PointerReleased', pointer: 2 }, document, 'stable');
  expect(unrelated.operation).toBeNull();
  expect(unrelated.editor.gesture.type).toBe('node-drag');
});
