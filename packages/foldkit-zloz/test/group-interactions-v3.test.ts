import { expect, test } from 'bun:test';

import {
  createGroupWorkbenchV3,
  updateGroupWorkbenchV3,
  groupWorkbenchGraphV3,
  captureGroupDocumentV3,
} from '../src/index';
import wire from './fixtures/group-document-v3-ported.json';
const init = () => ({
  ...createGroupWorkbenchV3(captureGroupDocumentV3(wire), { sessionId: 'native-gestures' }),
  viewport: { x: 0, y: 0, zoom: 1 },
});
test('native group resize is transient, live protected, cancellable and one complete Undo', () => {
  const before = init(),
    started = updateGroupWorkbenchV3(before, {
      type: 'NodeResizeStarted',
      id: 'g',
      handle: 'bottom-right',
      pointer: 1,
      point: { x: 500, y: 380 },
    });
  const moved = updateGroupWorkbenchV3(started, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 560, y: 420 },
  });
  expect(moved.editor).toBe(before.editor);
  expect(groupWorkbenchGraphV3(moved).nodes.find((n) => n.id === 'g')?.size).toEqual({
    width: 460,
    height: 340,
  });
  expect(updateGroupWorkbenchV3(moved, { type: 'GestureCancelled' }).editor).toBe(before.editor);
  expect(
    updateGroupWorkbenchV3(
      moved,
      { type: 'PointerReleased', pointer: 1 },
      { canResizeNode: () => 'Size frozen.' },
    ).editor,
  ).toBe(before.editor);
  const applied = updateGroupWorkbenchV3(moved, { type: 'PointerReleased', pointer: 1 });
  expect(applied.editor.history.past).toHaveLength(1);
  expect(updateGroupWorkbenchV3(applied, { type: 'UndoPressed' }).editor.document).toEqual(
    before.editor.document,
  );
});
test('native ordinary node bounds and port anchors retain owners/socket IDs and use current edit protection', () => {
  const before = init(),
    start = updateGroupWorkbenchV3(before, {
      type: 'PortAnchorDragStarted',
      endpoint: { node: 'b', port: 'in' },
      pointer: 2,
      point: { x: 600, y: 190 },
    });
  const moved = updateGroupWorkbenchV3(start, {
      type: 'PointerMoved',
      pointer: 2,
      point: { x: 700, y: 140 },
    }),
    port = groupWorkbenchGraphV3(moved).nodes.find((n) => n.id === 'b')?.ports[0];
  expect(port?.anchor).toEqual({ x: 0.5, y: 0 });
  expect(port?.id).toBe('in');
  expect(
    updateGroupWorkbenchV3(
      moved,
      { type: 'PointerReleased', pointer: 2 },
      { canEditPort: () => 'Socket protected.' },
    ).editor,
  ).toBe(before.editor);
  const applied = updateGroupWorkbenchV3(moved, { type: 'PointerReleased', pointer: 2 });
  expect(applied.editor.history.past).toHaveLength(1);
  const nudged = updateGroupWorkbenchV3(applied, {
    type: 'PortAnchorNudged',
    endpoint: { node: 'b', port: 'in' },
    delta: { x: 0.1, y: 0.1 },
  });
  expect(nudged.editor.document.graph.nodes.find((n) => n.id === 'b')?.ports[0]?.anchor).toEqual({
    x: 0.6,
    y: 0.1,
  });
  const resize = updateGroupWorkbenchV3(before, {
      type: 'NodeResizeStarted',
      id: 'b',
      handle: 'bottom-right',
      pointer: 3,
      point: { x: 800, y: 240 },
    }),
    preview = updateGroupWorkbenchV3(resize, {
      type: 'PointerMoved',
      pointer: 3,
      point: { x: 840, y: 270 },
    });
  expect(groupWorkbenchGraphV3(preview).nodes.find((n) => n.id === 'b')?.size).toEqual({
    width: 240,
    height: 130,
  });
});
test('reconnection drag preserves edge identity and checks release-time policies', () => {
  const before = init(),
    start = updateGroupWorkbenchV3(before, {
      type: 'ReconnectionDragStarted',
      id: 'boundary-link',
      end: 'target',
      pointer: 4,
      point: { x: 600, y: 190 },
    });
  const moved = updateGroupWorkbenchV3(start, {
    type: 'PointerMoved',
    pointer: 4,
    point: { x: 610, y: 190 },
    target: { node: 'b', port: 'in' },
  });
  expect(moved.gesture.type).toBe('reconnect');
  expect(
    updateGroupWorkbenchV3(
      moved,
      { type: 'PointerReleased', pointer: 4 },
      { canReconnect: () => 'Link frozen.' },
    ).editor,
  ).toBe(before.editor);
  const cancelled = updateGroupWorkbenchV3(moved, { type: 'GestureCancelled' });
  expect(cancelled.editor).toBe(before.editor);
});
test('box selection resolves visible roots with live select policy; pinch moves the camera without authored history', () => {
  const before = init(),
    start = updateGroupWorkbenchV3(before, {
      type: 'BoxSelectionStarted',
      pointer: 5,
      point: { x: 90, y: 70 },
    }),
    moved = updateGroupWorkbenchV3(start, {
      type: 'PointerMoved',
      pointer: 5,
      point: { x: 510, y: 390 },
    });
  const selected = updateGroupWorkbenchV3(moved, { type: 'PointerReleased', pointer: 5 });
  expect(selected.selectedNodeIds).toEqual(['g']);
  expect(selected.editor).toBe(before.editor);
  const protectedSelection = updateGroupWorkbenchV3(
    moved,
    { type: 'PointerReleased', pointer: 5 },
    { canSelectNode: (n) => (n.id === 'g' ? 'Boundary protected.' : null) },
  );
  expect(protectedSelection.selectedNodeIds).toEqual(['child']);
  const pinch = updateGroupWorkbenchV3(before, {
      type: 'PinchStarted',
      center: { x: 100, y: 100 },
      distance: 100,
    }),
    zoomed = updateGroupWorkbenchV3(pinch, {
      type: 'PinchMoved',
      center: { x: 120, y: 130 },
      distance: 200,
    });
  expect(zoomed.viewport).toEqual({ x: -80, y: -70, zoom: 2 });
  expect(zoomed.editor).toBe(before.editor);
  expect(updateGroupWorkbenchV3(zoomed, { type: 'GestureCancelled' }).viewport).toEqual(
    before.viewport,
  );
});

test('native geometry release rejects replaced sessions, read-only/busy/revision exhaustion and complete-document Undo veto', () => {
  const before = init(),
    drag = updateGroupWorkbenchV3(
      updateGroupWorkbenchV3(before, {
        type: 'NodeResizeStarted',
        id: 'g',
        pointer: 8,
        point: { x: 500, y: 380 },
      }),
      { type: 'PointerMoved', pointer: 8, point: { x: 550, y: 430 } },
    );
  for (const editor of [
    { ...before.editor, sessionId: 'replacement' },
    { ...before.editor, readOnly: true },
    { ...before.editor, activity: { type: 'busy' as const, reason: 'Saving.' } },
    { ...before.editor, revision: Number.MAX_SAFE_INTEGER },
  ]) {
    const result = updateGroupWorkbenchV3(
      { ...drag, editor },
      { type: 'PointerReleased', pointer: 8 },
    );
    expect(result.editor).toBe(editor);
    expect(result.gesture.type).toBe('idle');
    expect(result.statusRequired).toBe(true);
  }
  const applied = updateGroupWorkbenchV3(drag, { type: 'PointerReleased', pointer: 8 });
  expect(
    updateGroupWorkbenchV3(
      applied,
      { type: 'UndoPressed' },
      { canResizeNode: () => 'Current size policy denies Undo.' },
    ).editor,
  ).toBe(applied.editor);
});
test('native anchor attraction is opt-in, captures per-port settings, bypasses and cancels without touching history', () => {
  const before = init(),
    options = { portAnchorSnap: { distance: 20, cornerDistance: 15 } },
    policy = { portAnchorSnap: () => ({ distance: 0, cornerDistance: 0 }) };
  const start = updateGroupWorkbenchV3(
    before,
    {
      type: 'PortAnchorDragStarted',
      endpoint: { node: 'g', port: 'out' },
      pointer: 9,
      point: { x: 500, y: 230 },
    },
    policy,
    options,
  );
  const move = updateGroupWorkbenchV3(
    start,
    { type: 'PointerMoved', pointer: 9, point: { x: 491, y: 90 } },
    policy,
    options,
  );
  const port = groupWorkbenchGraphV3(move).nodes.find((n) => n.id === 'g')?.ports[0];
  expect(port?.anchor).toEqual({ x: 0.9775, y: 0.033333333333333326 });
  expect(updateGroupWorkbenchV3(move, { type: 'GestureCancelled' }).editor).toBe(before.editor);
});
