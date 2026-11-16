import { expect, test } from 'bun:test';

import {
  createGroupEditorV3,
  captureGroupDocumentV3,
  captureGroupEditorSourceV3,
  updateGroupEditorV3,
  planGroupOperationV3,
  applyGroupOperationV3,
  type ZlozGroupOperationV3,
  type ZlozGroupEditorStateV3,
} from '../src/index';
import wire from './fixtures/group-document-v3-ported.json';
const init = () => createGroupEditorV3(captureGroupDocumentV3(wire), { sessionId: 'group-ops' });
const req = (editor: ZlozGroupEditorStateV3, operation: ZlozGroupOperationV3) => ({
  source: captureGroupEditorSourceV3(editor),
  operation,
});
const undo = (editor: ZlozGroupEditorStateV3) =>
  updateGroupEditorV3(editor, { type: 'UndoPressed', source: captureGroupEditorSourceV3(editor) });

test('moving ancestor and selected descendant translates each world position exactly once', () => {
  const editor = init(),
    request = req(editor, { operation: 'move', nodeIds: ['g', 'child'], delta: { x: 20, y: 30 } });
  const plan = planGroupOperationV3(editor, request);
  expect(plan.type).toBe('ready');
  expect(editor.revision).toBe(0);
  if (plan.type !== 'ready') throw new Error('Expected ready');
  expect(plan.changedNodeIds).toEqual(['child', 'g']);
  const moved = applyGroupOperationV3(editor, plan.request);
  expect(moved.editor.document.graph.nodes[0]?.position).toEqual({ x: 160, y: 170 });
  expect(moved.editor.document.graph.nodes[1]?.position).toEqual({ x: 120, y: 110 });
  expect(moved.editor.document.graph.edges).toEqual(editor.document.graph.edges);
  expect(moved.editor.history.past).toHaveLength(1);
  expect(undo(moved.editor).editor.document).toEqual(editor.document);
  expect(
    applyGroupOperationV3(editor, request, {
      canMoveNode: (n) => (n.id === 'child' ? 'Child protected.' : null),
    }),
  ).toMatchObject({ type: 'blocked', reason: 'Child protected.' });
});

test('reparent retains world coordinates, rejects cycles and validates complete extents', () => {
  const editor = init(),
    request = req(editor, { operation: 'reparent', nodeIds: ['child'], parentId: null });
  const result = applyGroupOperationV3(editor, request);
  const child = result.editor.document.graph.nodes[0];
  expect(child?.parentId).toBeUndefined();
  expect(child?.position).toEqual({ x: 140, y: 140 });
  expect(undo(result.editor).editor.document).toEqual(editor.document);
  expect(
    planGroupOperationV3(
      editor,
      req(editor, { operation: 'reparent', nodeIds: ['g'], parentId: 'g' }),
    ).type,
  ).toBe('blocked');
  expect(
    planGroupOperationV3(
      editor,
      req(editor, { operation: 'reparent', nodeIds: ['child'], parentId: 'b' }),
    ).type,
  ).toBe('blocked');
  const extent = createGroupEditorV3(
    captureGroupDocumentV3({
      ...wire,
      graph: {
        ...wire.graph,
        nodes: wire.graph.nodes.map((n) => (n.id === 'child' ? { ...n, extent: 'parent' } : n)),
      },
    }),
    { sessionId: 'extent' },
  );
  expect(
    planGroupOperationV3(
      extent,
      req(extent, { operation: 'move', nodeIds: ['child'], delta: { x: -100, y: 0 } }),
    ),
  ).toMatchObject({ type: 'blocked', code: 'constraint' });
});

test('enabled ancestor expansion is explicit in the plan and a protected ancestor vetoes all changes', () => {
  const editor = createGroupEditorV3(
    captureGroupDocumentV3({
      ...wire,
      graph: {
        ...wire.graph,
        nodes: wire.graph.nodes.map((n) =>
          n.id === 'child' ? { ...n, extent: 'parent', expandParent: true } : n,
        ),
      },
    }),
    { sessionId: 'expand' },
  );
  const request = req(editor, { operation: 'move', nodeIds: ['child'], delta: { x: -100, y: 0 } }),
    plan = planGroupOperationV3(editor, request);
  expect(plan.type).toBe('ready');
  if (plan.type !== 'ready') throw new Error('Expected ready');
  expect(plan.changedNodeIds).toEqual(['child', 'g']);
  const moved = applyGroupOperationV3(editor, request);
  expect(moved.editor.document.graph.nodes.find((n) => n.id === 'g')?.position.x).toBe(24);
  const blocked = applyGroupOperationV3(editor, request, {
    canResizeNode: (n) => (n.id === 'g' ? 'Parent size protected.' : null),
  });
  expect(blocked).toMatchObject({ type: 'blocked', reason: 'Parent size protected.' });
  expect(blocked.editor).toBe(editor);
  expect(undo(moved.editor).editor.document).toEqual(editor.document);
});

test('group resize preserves children and checks bounds, aspect and live policies', () => {
  const editor = init(),
    request = req(editor, { operation: 'resize', id: 'g', size: { width: 480, height: 320 } });
  const result = applyGroupOperationV3(editor, request);
  expect(result.type).toBe('applied');
  expect(result.editor.document.graph.nodes[0]).toEqual(editor.document.graph.nodes[0]);
  expect(result.editor.document.graph.nodes.find((n) => n.id === 'g')?.size).toEqual({
    width: 480,
    height: 320,
  });
  expect(undo(result.editor).editor.document).toEqual(editor.document);
  expect(
    applyGroupOperationV3(editor, request, { canResizeNode: () => 'Size locked.' }),
  ).toMatchObject({ type: 'blocked', reason: 'Size locked.' });
  const locked = createGroupEditorV3(
    captureGroupDocumentV3({
      ...wire,
      graph: {
        ...wire.graph,
        nodes: wire.graph.nodes.map((n) =>
          n.id === 'g' ? { ...n, keepAspectRatio: true, resizeLimits: { maxWidth: 450 } } : n,
        ),
      },
    }),
    { sessionId: 'locked' },
  );
  expect(
    planGroupOperationV3(
      locked,
      req(locked, { operation: 'resize', id: 'g', size: { width: 460, height: 345 } }),
    ),
  ).toMatchObject({ type: 'blocked', code: 'constraint' });
  expect(
    planGroupOperationV3(
      locked,
      req(locked, { operation: 'resize', id: 'g', size: { width: 420, height: 400 } }),
    ),
  ).toMatchObject({ type: 'blocked', code: 'constraint' });
});

test('delete includes descendants and every boundary edge once, checks complete policies and is one Undo', () => {
  const editor = init(),
    request = req(editor, { operation: 'delete', nodeIds: ['g', 'child'], edgeIds: [] });
  const plan = planGroupOperationV3(editor, request);
  expect(plan.type).toBe('ready');
  if (plan.type !== 'ready') throw new Error('Expected ready');
  expect(plan.removedNodeIds).toEqual(['child', 'g']);
  expect(plan.removedEdgeIds).toEqual(['boundary-link']);
  const blocked = applyGroupOperationV3(editor, request, {
    canDelete: (c) => {
      expect(c.nodes.map((n) => n.id)).toEqual(['child', 'g']);
      expect(c.edges.map((e) => e.id)).toEqual(['boundary-link']);
      return 'Deletion protected.';
    },
  });
  expect(blocked.editor).toBe(editor);
  const result = applyGroupOperationV3(editor, request);
  expect(result.editor.document.graph.nodes.map((n) => n.id)).toEqual(['b']);
  expect(result.editor.history.past).toHaveLength(1);
  expect(undo(result.editor).editor.document).toEqual(editor.document);
});

test('ported ungroup is explicit refusal; portless group/ungroup preserves membership and world geometry', () => {
  const editor = init();
  expect(
    planGroupOperationV3(editor, req(editor, { operation: 'ungroup', id: 'g' })),
  ).toMatchObject({ type: 'blocked', code: 'constraint' });
  const clean = createGroupEditorV3(
    captureGroupDocumentV3({
      ...wire,
      graph: {
        nodes: wire.graph.nodes.map((n) => (n.id === 'g' ? { ...n, ports: [] } : n)),
        edges: [],
      },
    }),
    { sessionId: 'ungroup' },
  );
  const result = applyGroupOperationV3(clean, req(clean, { operation: 'ungroup', id: 'g' }));
  expect(result.editor.document.graph.nodes.map((n) => n.id)).toEqual(['child', 'b']);
  expect(result.editor.document.graph.nodes[0]?.parentId).toBeUndefined();
  expect(result.editor.document.graph.nodes[0]?.position).toEqual({ x: 140, y: 140 });
  expect(undo(result.editor).editor.document).toEqual(clean.document);
  const node = {
    id: 'new-group',
    label: 'New group',
    kind: 'group' as const,
    position: { x: 100, y: 100 },
    size: { width: 800, height: 400 },
    ports: [],
  };
  const grouped = applyGroupOperationV3(
    result.editor,
    req(result.editor, { operation: 'group', nodeIds: ['child', 'b'], node }),
  );
  expect(grouped.type).toBe('applied');
  expect(grouped.editor.document.graph.nodes.slice(0, 2).map((n) => n.parentId)).toEqual([
    'new-group',
    'new-group',
  ]);
  expect(undo(grouped.editor).editor.document).toEqual(result.editor.document);
});

test('stale/readonly/busy requests, malformed IDs and new protections never consume history', () => {
  const editor = init(),
    request = req(editor, { operation: 'move', nodeIds: ['g'], delta: { x: 1, y: 0 } }),
    next = applyGroupOperationV3(editor, request).editor;
  expect(planGroupOperationV3(next, request)).toMatchObject({
    type: 'blocked',
    code: 'stale-source',
  });
  expect(applyGroupOperationV3({ ...editor, readOnly: true }, request).type).toBe('blocked');
  expect(
    planGroupOperationV3(
      editor,
      req(editor, { operation: 'move', nodeIds: ['unknown'], delta: { x: 1, y: 0 } }),
    ),
  ).toMatchObject({ type: 'blocked', code: 'not-found' });
  const plan = planGroupOperationV3(editor, request);
  if (plan.type !== 'ready') throw new Error('Expected ready');
  expect(
    applyGroupOperationV3(editor, plan.request, {
      canCommitGroupDocumentV3: () => 'Now protected.',
    }).editor,
  ).toBe(editor);
  const noop = applyGroupOperationV3(
    editor,
    req(editor, { operation: 'move', nodeIds: ['g'], delta: { x: 0, y: 0 } }),
  );
  expect(noop).toEqual({ type: 'unchanged', editor });
});
