import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  ZlozError,
  captureConnectionDocument,
  captureEditionV2,
  captureModelDocumentV2,
  parseConnectionDocument,
  parseModelDocumentV2,
  serializeModelDocumentV2,
  createModelEditorV2,
  createHistoryReviewV2,
  updateHistoryReviewV2,
  createModelEditor,
  createHistoryReview,
  updateEditor,
  parseModelDocument,
  type EditorEvent,
  type ZlozConnectionMode,
  type ZlozEditionV2,
} from '../src/index';
import looseWire from './fixtures/connection-v2-loose.json';
import legacyWire from './fixtures/model-v1-strict.json';
import wire from './fixtures/model-v2-modes.json';

const source = () => parseModelDocumentV2(JSON.stringify(wire));
const loose = () => parseConnectionDocument(JSON.stringify(looseWire));
const modelFor = (mode: ZlozConnectionMode) =>
  captureModelDocumentV2({
    ...source(),
    snapshot: mode === 'strict' ? source().snapshot : loose(),
  });
const checkpointFor = (mode: ZlozConnectionMode): ZlozEditionV2 =>
  captureEditionV2({
    id: 'checkpoint',
    name: 'Checkpoint',
    snapshot: mode === 'strict' ? source().snapshot : loose(),
  });

for (const mode of ['strict', 'loose'] as const) {
  test(`v2 model initializes ${mode} source with a detached graph and independent editable Undo`, () => {
    const document = modelFor(mode);
    const before = serializeModelDocumentV2(document);
    const first = createModelEditorV2(document);
    const second = createModelEditorV2(document);
    expect(first.connectionMode).toBe(mode);
    expect(first.graph).toEqual(document.snapshot.graph);
    expect(first.graph).not.toBe(document.snapshot.graph);
    expect(first.graph.nodes[0]!.ports).not.toBe(document.snapshot.graph.nodes[0]!.ports);
    expect(first.graph).not.toBe(second.graph);
    expect(first.viewport).toEqual(document.snapshot.viewport!);
    expect(first.readOnly).toBe(false);
    expect(first.past).toEqual([]);
    expect(first.future).toEqual([]);
    expect(first.revision).toBe(0);
    const edited = updateEditor(first, { type: 'NodeLabelChanged', id: 'a', label: 'Working' });
    expect(edited.past).toEqual([first.graph]);
    expect(edited.revision).toBe(1);
    expect(edited.connectionMode).toBe(mode);
    expect(updateEditor(edited, { type: 'UndoPressed' }).graph).toBe(first.graph);
    expect(updateEditor(edited, { type: 'UndoPressed' }).connectionMode).toBe(mode);
    expect(second.past).toEqual([]);
    expect(second.graph).toEqual(document.snapshot.graph);
    expect(serializeModelDocumentV2(document)).toBe(before);
    expect(() => createModelEditor(document)).toThrow(ZlozError);
  });
}

test('v2 model initialization validates every checkpoint and origin, never just the chosen current snapshot', () => {
  const document = source();
  const legacy = parseModelDocument(JSON.stringify(legacyWire));
  // @ts-expect-error V1 snapshots must be explicitly upgraded before v2 initialization.
  expect(() => createModelEditorV2(legacy)).toThrow(ZlozError);
  expect(() =>
    createModelEditorV2({ ...document, editions: [...document.editions, document.editions[0]!] }),
  ).toThrow(ZlozError);
  const future = {
    ...document.editions[0]!,
    snapshot: { ...document.editions[0]!.snapshot, connectionMode: 'future' },
  };
  const badEditions = { ...document, editions: [future] };
  // @ts-expect-error Unknown checkpoint mode is invalid even when the current snapshot is strict.
  const initializeBadEditions = () => createModelEditorV2(badEditions);
  expect(initializeBadEditions).toThrow(ZlozError);
  const badOrigin = { ...document, origin: { ...document.origin!, edition: future } };
  // @ts-expect-error Pinned-origin mode must validate as well.
  const initializeBadOrigin = () => createModelEditorV2(badOrigin);
  expect(initializeBadOrigin).toThrow(ZlozError);
});

test('preferences may override camera/read-only/history limits but cannot inherit history or override document mode', () => {
  const document = modelFor('loose');
  let previous = createModelEditorV2(source());
  previous = updateEditor(previous, { type: 'NodeLabelChanged', id: 'a', label: 'Other session' });
  const preferences = {
    ...previous,
    connectionMode: 'strict' as const,
    viewport: { x: 30, y: 40, zoom: 2 },
    readOnly: true,
    historyLimit: 0,
  };
  const editor = createModelEditorV2(document, preferences);
  expect(editor.connectionMode).toBe('loose');
  expect(editor.viewport).toEqual(preferences.viewport);
  expect(editor.viewport).not.toBe(preferences.viewport);
  expect(editor.past).toEqual([]);
  expect(editor.future).toEqual([]);
  expect(editor.revision).toBe(0);
  expect(editor.readOnly).toBe(true);
  expect(editor.historyLimit).toBe(0);
  expect(createModelEditorV2(document, { viewport: undefined }).viewport).toEqual(
    document.snapshot.viewport!,
  );
  expect(() => createModelEditorV2(document, { zoomLimits: { minZoom: 2, maxZoom: 4 } })).toThrow(
    ZlozError,
  );
});

for (const presentMode of ['strict', 'loose'] as const)
  for (const checkpointMode of ['strict', 'loose'] as const) {
    test(`${checkpointMode} review retains checkpoint mode independently of ${presentMode} working mode and active history`, () => {
      const document = modelFor(presentMode);
      let present = createModelEditorV2(document);
      present = updateEditor(present, { type: 'NodeLabelChanged', id: 'a', label: 'Working' });
      present = updateEditor(present, { type: 'NodeLabelChanged', id: 'a', label: 'Later' });
      present = updateEditor(present, { type: 'UndoPressed' });
      present = updateEditor(present, { type: 'NodeSelected', id: 'a', additive: false });
      present = updateEditor(present, { type: 'CopyPressed' });
      present = updateEditor(present, {
        type: 'SurfaceMeasured',
        size: { width: 900, height: 600 },
      });
      present = updateEditor(present, {
        type: 'NodeDragStarted',
        id: 'a',
        pointer: 1,
        point: { x: 0, y: 0 },
      });
      const checkpoint = checkpointFor(checkpointMode);
      const before = JSON.stringify(present);
      const review = createHistoryReviewV2(checkpoint, present);
      const pinnedReadOnly: true = review.editor.readOnly;
      expect(pinnedReadOnly).toBe(true);
      expect(review.editionId).toBe(checkpoint.id);
      expect(review.edition).toEqual(checkpoint);
      expect(review.edition).not.toBe(checkpoint);
      expect(Object.isFrozen(review.edition.snapshot.graph.nodes)).toBe(true);
      expect(review.editor.connectionMode).toBe(checkpointMode);
      expect(review.editor.graph).toEqual(checkpoint.snapshot.graph);
      expect(review.editor.graph).not.toBe(checkpoint.snapshot.graph);
      expect(review.editor.graph).not.toBe(review.edition.snapshot.graph);
      expect(review.editor.viewport).toEqual(checkpoint.snapshot.viewport!);
      expect(review.editor.viewport).not.toBe(checkpoint.snapshot.viewport);
      expect(review.editor.surface).toEqual(present.surface!);
      expect(review.editor.surface).not.toBe(present.surface);
      expect(review.editor.historyLimit).toBe(0);
      expect(review.editor.past).toEqual([]);
      expect(review.editor.future).toEqual([]);
      expect(review.editor.revision).toBe(0);
      expect(review.editor.clipboard).toBeNull();
      expect(review.editor.selectedNodes).toEqual([]);
      expect(review.editor.gesture).toEqual({ type: 'idle' });
      expect(review.editor.connection).toBeNull();
      expect(review.editor.notice).toBeNull();
      expect(JSON.stringify(present)).toBe(before);
      expect(present.past).toHaveLength(1);
      expect(present.future).toHaveLength(1);
      expect(() => createHistoryReview(checkpoint, present)).toThrow(ZlozError);
    });
  }

test('review navigation is independent, uses current selection policies and keeps its original pin', () => {
  const present = createModelEditorV2(source());
  const review = createHistoryReviewV2(checkpointFor('loose'), present);
  const blocked = updateHistoryReviewV2(
    review,
    { type: 'NodeSelected', id: 'a', additive: false },
    {
      canSelectNode: (_node, graph) => {
        expect(graph).toBe(review.editor.graph);
        return 'Protected selection';
      },
    },
  );
  expect(blocked.editor.selectedNodes).toEqual([]);
  const selected = updateHistoryReviewV2(review, {
    type: 'NodeSelected',
    id: 'a',
    additive: false,
  });
  expect(selected.editor.selectedNodes).toEqual(['a']);
  const measured = updateHistoryReviewV2(selected, {
    type: 'SurfaceMeasured',
    size: { width: 800, height: 500 },
  });
  const moved = updateHistoryReviewV2(measured, {
    type: 'ViewportNudged',
    delta: { x: 50, y: -20 },
  });
  expect(moved.editor.viewport).toEqual({
    ...review.editor.viewport,
    x: review.editor.viewport.x + 50,
    y: review.editor.viewport.y - 20,
  });
  const fitted = updateHistoryReviewV2(moved, { type: 'FitViewClicked' });
  expect(fitted.editor.graph).toBe(review.editor.graph);
  expect(fitted.edition).toBe(review.edition);
  expect(fitted.edition.snapshot.viewport).toEqual(loose().viewport!);
  expect(fitted.editor.connectionMode).toBe('loose');
  expect(fitted.editor.past).toEqual([]);
  expect(fitted.editor.future).toEqual([]);
  expect(fitted.editor.readOnly).toBe(true);
  expect(fitted.editor.revision).toBe(0);
  expect(review.editor.selectedNodes).toEqual([]);
  expect(present.selectedNodes).toEqual([]);
  expect(updateHistoryReviewV2(review, { type: 'NodeFocusChanged', id: null })).toBe(review);
});

test('read-only review rejects authored edits, measurements, connection gestures and Undo/Redo before updating', () => {
  const review = createHistoryReviewV2(checkpointFor('loose'), createModelEditorV2(source()));
  const before = JSON.stringify(review);
  const forbidden: EditorEvent[] = [
    { type: 'NodeLabelChanged', id: 'a', label: 'Changed' },
    { type: 'NodeMeasured', id: 'a', size: { width: 999, height: 999 } },
    { type: 'NodeDragStarted', id: 'a', pointer: 1, point: { x: 0, y: 0 } },
    {
      type: 'ConnectionDragStarted',
      endpoint: { node: 'a', port: 'shared' },
      pointer: 1,
      point: { x: 0, y: 0 },
    },
    { type: 'PortActivated', endpoint: { node: 'a', port: 'shared' } },
    {
      type: 'ConnectionCreated',
      edge: {
        id: 'new',
        source: { node: 'b', port: 'shared' },
        target: { node: 'a', port: 'shared' },
      },
    },
    {
      type: 'EdgeReconnected',
      id: 'orders-billing',
      end: 'source',
      endpoint: { node: 'b', port: 'shared' },
    },
    { type: 'PortRemoved', endpoint: { node: 'a', port: 'shared' } },
    { type: 'DeletePressed' },
    { type: 'CopyPressed' },
    { type: 'PastePressed' },
    { type: 'UndoPressed' },
    { type: 'RedoPressed' },
  ];
  for (const event of forbidden) expect(updateHistoryReviewV2(review, event)).toBe(review);
  expect(JSON.stringify(review)).toBe(before);
});

test('camera-less checkpoints use a detached working camera while pinned snapshots stay camera-less; review sessions do not share navigation', () => {
  const present = createModelEditorV2(source(), {
    viewport: { x: 50, y: 60, zoom: 2 },
    fitViewPadding: 40,
  });
  const checkpoint = captureEditionV2({
    id: 'no-camera',
    name: 'No camera',
    snapshot: captureConnectionDocument({ graph: loose().graph, connectionMode: 'loose' }),
  });
  const first = createHistoryReviewV2(checkpoint, present);
  const second = createHistoryReviewV2(checkpoint, present);
  expect(first.editor.viewport).toEqual(present.viewport);
  expect(first.editor.viewport).not.toBe(present.viewport);
  expect(first.editor.fitViewPadding).toBe(40);
  expect(first.editor.zoomLimits).not.toBe(present.zoomLimits);
  expect('viewport' in first.edition.snapshot).toBe(false);
  const next = updateHistoryReviewV2(first, { type: 'ViewportNudged', delta: { x: 20, y: 0 } });
  expect(next.editor.viewport.x).toBe(70);
  expect(second.editor.viewport.x).toBe(50);
  expect(present.viewport.x).toBe(50);
  expect(first.editor.surface).toBeNull();
  const originReview = createHistoryReviewV2(source().origin!.edition, present);
  expect(originReview.editor.connectionMode).toBe('loose');
  expect(originReview.editor.viewport).toEqual({ x: 3, y: 4, zoom: 2 });
});

test('review validates checkpoint data and camera/zoom compatibility without mutating the working editor', () => {
  const present = createModelEditorV2(source(), { zoomLimits: { minZoom: 0.1, maxZoom: 1 } });
  const checkpoint = checkpointFor('strict');
  const before = JSON.stringify(present);
  const camera = captureEditionV2({
    ...checkpoint,
    snapshot: { ...checkpoint.snapshot, viewport: { x: 0, y: 0, zoom: 2 } },
  });
  expect(() => createHistoryReviewV2(camera, present)).toThrow(ZlozError);
  const legacy = parseModelDocument(JSON.stringify(legacyWire)).editions[0]!;
  // @ts-expect-error A legacy edition requires explicit v2 upgrade before v2 review.
  expect(() => createHistoryReviewV2(legacy, present)).toThrow(ZlozError);
  const unknownMode = {
    ...checkpoint,
    snapshot: { ...checkpoint.snapshot, connectionMode: 'future' },
  };
  // @ts-expect-error Unsupported checkpoint mode cannot default to the working mode.
  const reviewUnknownMode = () => createHistoryReviewV2(unknownMode, present);
  expect(reviewUnknownMode).toThrow(ZlozError);
  expect(JSON.stringify(present)).toBe(before);
  assert.deepEqual(present.graph, source().snapshot.graph);
});
