import { expect, test } from 'bun:test';

import { captureGroupDocumentV3 } from '../src/group-document-v3';
import {
  createGroupWorkbenchV3,
  updateGroupWorkbenchV3,
  groupWorkbenchGraphV3,
} from '../src/group-workbench-v3';
import wire from './fixtures/group-document-v3-ported.json';
const init = () => createGroupWorkbenchV3(captureGroupDocumentV3(wire), { sessionId: 'native-v3' });
test('pointer preview remains transient, snaps once, checks live protection at release and creates one Undo', () => {
  const before = init();
  const start = updateGroupWorkbenchV3(before, {
    type: 'NodeDragStarted',
    id: 'g',
    pointer: 4,
    point: { x: 0, y: 0 },
  });
  const preview = updateGroupWorkbenchV3(
    start,
    { type: 'PointerMoved', pointer: 4, point: { x: 26, y: 13 } },
    {},
    { grid: 10 },
  );
  expect(preview.editor).toBe(before.editor);
  expect(groupWorkbenchGraphV3(preview).nodes[1]?.position).toEqual({ x: 120, y: 90 });
  const veto = updateGroupWorkbenchV3(
    preview,
    { type: 'PointerReleased', pointer: 4 },
    { canMoveNode: () => 'Locked now.' },
  );
  expect(veto.editor).toBe(before.editor);
  expect(veto.status).toBe('Locked now.');
  const applied = updateGroupWorkbenchV3(preview, { type: 'PointerReleased', pointer: 4 });
  expect(applied.editor.history.past).toHaveLength(1);
  expect(updateGroupWorkbenchV3(applied, { type: 'UndoPressed' }).editor.document).toEqual(
    before.editor.document,
  );
});
test('cancellation, stale source, foreign pointer and busy lifecycle never publish a partial drag', () => {
  const before = init(),
    start = updateGroupWorkbenchV3(before, {
      type: 'NodeDragStarted',
      id: 'g',
      pointer: 4,
      point: { x: 0, y: 0 },
    });
  expect(updateGroupWorkbenchV3(start, { type: 'PointerReleased', pointer: 5 })).toBe(start);
  expect(updateGroupWorkbenchV3(start, { type: 'GestureCancelled' }).editor).toBe(before.editor);
  const moved = updateGroupWorkbenchV3(start, {
    type: 'PointerMoved',
    pointer: 4,
    point: { x: 40, y: 0 },
  });
  const stale = { ...moved, editor: { ...moved.editor, revision: 1 } };
  expect(updateGroupWorkbenchV3(stale, { type: 'PointerReleased', pointer: 4 }).editor).toBe(
    stale.editor,
  );
  expect(updateGroupWorkbenchV3(moved, { type: 'UndoPressed' }).status).toContain('gesture');
  const busy = {
    ...moved,
    editor: { ...moved.editor, activity: { type: 'busy' as const, reason: 'Host operation.' } },
  };
  expect(updateGroupWorkbenchV3(busy, { type: 'PointerReleased', pointer: 4 }).status).toBe(
    'Host operation.',
  );
});
test('keyboard selection obeys policies, group controls retain capabilities and read-only cannot edit', () => {
  const before = init();
  expect(
    updateGroupWorkbenchV3(
      before,
      { type: 'NodeSelected', id: 'g', additive: false },
      { canSelectNode: () => 'Protected.' },
    ).selectedNodeIds,
  ).toEqual([]);
  const selected = updateGroupWorkbenchV3(before, {
    type: 'NodeSelected',
    id: 'g',
    additive: false,
  });
  const moved = updateGroupWorkbenchV3(selected, {
    type: 'SelectionNudged',
    delta: { x: 5, y: 0 },
  });
  expect(moved.editor.document.capabilities).toEqual({ groupPorts: true });
  const readonly = { ...selected, editor: { ...selected.editor, readOnly: true } };
  expect(updateGroupWorkbenchV3(readonly, { type: 'DeletePressed' }).editor).toBe(readonly.editor);
  const collapsed = updateGroupWorkbenchV3(selected, { type: 'GroupCollapseToggled', id: 'g' });
  expect(collapsed.editor).toBe(before.editor);
  expect(collapsed.collapsedGroupIds).toEqual(['g']);
});
test('click/keyboard and drag connection creation both use strict eligibility and one atomic frame', () => {
  const base = init();
  const document = captureGroupDocumentV3({
    ...base.editor.document,
    graph: { ...base.editor.document.graph, edges: [] },
  });
  const before = createGroupWorkbenchV3(document, { sessionId: 'connection' });
  const source = updateGroupWorkbenchV3(before, {
    type: 'PortActivated',
    endpoint: { node: 'g', port: 'out' },
  });
  const result = updateGroupWorkbenchV3(source, {
    type: 'PortActivated',
    endpoint: { node: 'b', port: 'in' },
  });
  expect(result.editor.document.graph.edges[0]?.source).toEqual({ node: 'g', port: 'out' });
  expect(result.editor.history.past).toHaveLength(1);
  const start = updateGroupWorkbenchV3(before, {
    type: 'ConnectionDragStarted',
    pointer: 2,
    point: { x: 0, y: 0 },
    endpoint: { node: 'g', port: 'out' },
  });
  const hover = updateGroupWorkbenchV3(start, {
    type: 'PointerMoved',
    pointer: 2,
    point: { x: 30, y: 0 },
    target: { node: 'b', port: 'in' },
  });
  expect(
    updateGroupWorkbenchV3(
      hover,
      { type: 'PointerReleased', pointer: 2 },
      { canConnect: () => 'No new wires.' },
    ).editor,
  ).toBe(before.editor);
  expect(
    updateGroupWorkbenchV3(hover, { type: 'PointerReleased', pointer: 2 }).editor.history.past,
  ).toHaveLength(1);
});
test('session clipboard is transient, live guarded, repeatable and supports one Undo without restoring clipboard authority', () => {
  const selected = updateGroupWorkbenchV3(init(), {
    type: 'NodeSelected',
    id: 'g',
    additive: false,
  });
  const copied = updateGroupWorkbenchV3(selected, { type: 'CopyPressed' });
  expect(copied.editor).toBe(selected.editor);
  expect(copied.clipboard?.document.graph.nodes.map((n) => n.id)).toEqual(['child', 'g']);
  expect(copied.clipboardFindings[0]?.code).toBe('boundary-edge-omitted');
  const blocked = updateGroupWorkbenchV3(
    copied,
    { type: 'PastePressed' },
    { canEditPort: () => 'Interfaces frozen.' },
  );
  expect(blocked.editor).toBe(copied.editor);
  expect(blocked.status).toBe('Interfaces frozen.');
  const pasted = updateGroupWorkbenchV3(copied, { type: 'PastePressed' }, {}, { grid: 20 });
  expect(pasted.editor.document.graph.nodes).toHaveLength(5);
  expect(pasted.selectedNodeIds).toHaveLength(1);
  expect(pasted.editor.history.past).toHaveLength(1);
  expect(pasted.clipboard).toBe(copied.clipboard);
  const repeated = updateGroupWorkbenchV3(pasted, { type: 'PastePressed' }, {}, { grid: 20 });
  expect(repeated.editor.document.graph.nodes).toHaveLength(7);
  expect(repeated.editor.document.graph.nodes[5]?.position).toEqual({ x: 220, y: 220 });
  const protectedUndo = updateGroupWorkbenchV3(
    pasted,
    { type: 'UndoPressed' },
    { canDelete: () => 'Pasted boundary locked.' },
  );
  expect(protectedUndo.editor).toBe(pasted.editor);
  const undone = updateGroupWorkbenchV3(pasted, { type: 'UndoPressed' });
  expect(undone.editor.document).toEqual(copied.editor.document);
  expect(undone.clipboard).toBe(copied.clipboard);
  const redo = updateGroupWorkbenchV3(undone, { type: 'RedoPressed' });
  expect(redo.editor.document).toEqual(pasted.editor.document);
  const readOnly = { ...copied, editor: { ...copied.editor, readOnly: true } };
  expect(updateGroupWorkbenchV3(readOnly, { type: 'CopyPressed' }).status).toContain(
    'Selection copied',
  );
  expect(updateGroupWorkbenchV3(readOnly, { type: 'PastePressed' }).editor).toBe(readOnly.editor);
  const deniedCopy = updateGroupWorkbenchV3(
    copied,
    { type: 'CopyPressed' },
    { canCopyGroupFragmentV3: () => 'Copy protected.' },
  );
  expect(deniedCopy.clipboard).toBe(copied.clipboard);
  expect(deniedCopy.status).toBe('Copy protected.');
  const gesture = updateGroupWorkbenchV3(copied, {
    type: 'NodeDragStarted',
    id: 'g',
    point: { x: 0, y: 0 },
    pointer: 9,
  });
  expect(updateGroupWorkbenchV3(gesture, { type: 'PastePressed' }).editor).toBe(copied.editor);
});
