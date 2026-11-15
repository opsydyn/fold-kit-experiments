import { expect, test } from 'bun:test';

import {
  mergeEditionsV2,
  createModelEditorV2,
  parseModelDocumentV2,
  parseConnectionDocument,
  restoreEditionV2,
  resolveEditionRestoreV2,
  updateEditor,
  createEditor,
  createEditionPlaybackV2,
  updateEditionPlaybackV2,
  reviewEditionPlaybackV2,
  type ZlozEditionV2,
} from '../src';
import looseWire from './fixtures/connection-v2-loose.json';
import wire from './fixtures/model-v2-modes.json';
const model = () => parseModelDocumentV2(JSON.stringify(wire));
const strict = (): ZlozEditionV2 => ({ id: 'strict', name: 'Strict', snapshot: model().snapshot });
const loose = (): ZlozEditionV2 => ({
  id: 'loose',
  name: 'Loose',
  snapshot: parseConnectionDocument(JSON.stringify(looseWire)),
});

test('v2 merge validates and detaches mixed modes, is idempotent and rejects the complete conflicting import', () => {
  const current = [strict()];
  const merged = mergeEditionsV2(current, [strict(), loose()]);
  if (merged.type !== 'merged') throw new Error('Merge unavailable');
  expect(merged.editions.map((item) => item.snapshot.connectionMode)).toEqual(['strict', 'loose']);
  expect(Object.isFrozen(merged.editions[1]?.snapshot.graph)).toBe(true);
  expect(merged.editions[0]).not.toBe(current[0]);
  expect(mergeEditionsV2(merged.editions, [loose()]).type).toBe('unchanged');
  const blocked = mergeEditionsV2(current, [loose(), { ...strict(), name: 'Conflict' }]);
  expect(blocked.type).toBe('blocked');
  expect('editions' in blocked).toBe(false);
  expect(current).toHaveLength(1);
  expect(() => mergeEditionsV2(current, [loose(), loose()])).toThrow();
});

test('cross-mode restore is one graph+mode Undo transaction, retains camera and supports ordinary edits between mode transitions', () => {
  const initial = createModelEditorV2(model());
  const edited = updateEditor(initial, { type: 'NodeLabelChanged', id: 'a', label: 'Working' });
  const restored = restoreEditionV2(edited, loose(), { expectedRevision: edited.revision });
  if (restored.type !== 'restored') throw new Error('Restore unavailable');
  expect(restored.editor.connectionMode).toBe('loose');
  expect(restored.editor.past).toHaveLength(2);
  expect(restored.editor.viewport).toEqual(edited.viewport);
  expect(restored.editor.graph.edges[0]?.id).toBe('orders-billing');
  const undo = updateEditor(restored.editor, { type: 'UndoPressed' });
  expect(undo.connectionMode).toBe('strict');
  expect(undo.graph).toEqual(edited.graph);
  const redo = updateEditor(undo, { type: 'RedoPressed' });
  expect(redo.connectionMode).toBe('loose');
  expect(redo.graph).toEqual(restored.editor.graph);
  const changed = updateEditor(redo, { type: 'NodeLabelChanged', id: 'a', label: 'Loose edit' });
  const undoEdit = updateEditor(changed, { type: 'UndoPressed' });
  expect(undoEdit.connectionMode).toBe('loose');
  const undoRestore = updateEditor(undoEdit, { type: 'UndoPressed' });
  expect(undoRestore.connectionMode).toBe('strict');
  expect(undoRestore.graph.nodes[0]?.label).toBe('Working');
  expect(
    updateEditor(undoRestore, { type: 'NodeLabelChanged', id: 'a', label: 'Branch' }).future,
  ).toHaveLength(0);
  expect(initial.past).toHaveLength(0);
});

test('mode-only restore records one step while exact repeats do not; limits and measurement keep frame projections aligned', () => {
  const initial = createModelEditorV2(model(), { historyLimit: 1 });
  const checkpoint = {
    ...strict(),
    snapshot: { ...strict().snapshot, connectionMode: 'loose' as const },
  };
  const result = restoreEditionV2(initial, checkpoint, { expectedRevision: initial.revision });
  if (result.type !== 'restored') throw new Error('Mode-only restore unavailable');
  expect(result.editor.past).toHaveLength(1);
  expect(
    resolveEditionRestoreV2(result.editor, checkpoint, { expectedRevision: result.editor.revision })
      .type,
  ).toBe('unchanged');
  const measured = updateEditor(result.editor, {
    type: 'NodeMeasured',
    id: 'a',
    size: { width: 200, height: 180 },
  });
  const undone = updateEditor(measured, { type: 'UndoPressed' });
  expect(undone.connectionMode).toBe('strict');
  expect(undone.graph.nodes[0]?.size.height).toBe(180);
  expect(undone.connectionHistory?.future[0]?.graph).toBe(undone.future[0]);
  const noUndo = createModelEditorV2(model(), { historyLimit: 0 });
  expect(restoreEditionV2(noUndo, loose(), { expectedRevision: 0 }).type).toBe('blocked');
});

test('restore rechecks revisions, live policy, busy/read-only state and legacy boundary without partial publication', () => {
  const current = createModelEditorV2(model());
  let locked = false;
  const options = {
    expectedRevision: current.revision,
    policy: { canRestoreEdition: () => (locked ? 'Protected restore' : null) },
  };
  expect(resolveEditionRestoreV2(current, loose(), options).type).toBe('ready');
  locked = true;
  const blocked = restoreEditionV2(current, loose(), options);
  expect(blocked.type).toBe('blocked');
  expect(blocked.editor).toBe(current);
  expect(restoreEditionV2(current, loose(), { expectedRevision: -1 }).type).toBe('blocked');
  expect(
    restoreEditionV2({ ...current, readOnly: true }, loose(), { expectedRevision: 0 }).type,
  ).toBe('blocked');
  expect(
    restoreEditionV2(current, loose(), { expectedRevision: 0, busyReason: 'Import active' }).type,
  ).toBe('blocked');
  expect(restoreEditionV2(createEditor(current.graph), loose(), { expectedRevision: 0 }).type).toBe(
    'blocked',
  );
  expect(
    restoreEditionV2(current, loose(), {
      expectedRevision: 0,
      policy: { canDelete: () => 'No deletion', canEditPort: () => 'Ports protected' },
    }).type,
  ).toBe('blocked');
  expect(() =>
    restoreEditionV2(current, loose(), {
      expectedRevision: 0,
      policy: {
        canRestoreEdition: () => {
          throw new Error('Policy failed');
        },
      },
    }),
  ).toThrow('Policy failed');
  expect(current.past).toHaveLength(0);
});

test('v2 playback pins mixed-mode editions and reviews checkpoints independently with reduced-motion pause and rewind', () => {
  const working = createModelEditorV2(model());
  const input = [strict(), loose()];
  const playback = createEditionPlaybackV2(input);
  expect(updateEditionPlaybackV2(playback, { type: 'PlayClicked' }).cursor.status).toBe('paused');
  const next = updateEditionPlaybackV2(playback, { type: 'NextClicked' });
  const review = reviewEditionPlaybackV2(next, working);
  expect(review?.editor.connectionMode).toBe('loose');
  expect(review?.editor.readOnly).toBe(true);
  expect(review?.editor.past).toHaveLength(0);
  expect(review?.edition).not.toBe(input[1]);
  expect(working.connectionMode).toBe('strict');
  expect(working.past).toHaveLength(0);
  const rewind = updateEditionPlaybackV2(next, { type: 'RewindClicked' });
  expect(reviewEditionPlaybackV2(rewind, working)?.editor.connectionMode).toBe('strict');
  let playing = createEditionPlaybackV2(input, { reducedMotion: false, intervalMs: 100 });
  playing = updateEditionPlaybackV2(playing, { type: 'PlayClicked' });
  playing = updateEditionPlaybackV2(playing, { type: 'Elapsed', milliseconds: 100 });
  expect(reviewEditionPlaybackV2(playing, working)?.editor.connectionMode).toBe('loose');
  expect(
    updateEditionPlaybackV2(playing, { type: 'ReducedMotionChanged', reducedMotion: true }).cursor
      .status,
  ).toBe('paused');
  expect(reviewEditionPlaybackV2(createEditionPlaybackV2([]), working)).toBeNull();
});

test('native drag commits and measurement preserve mixed-mode history projections', () => {
  const source = createModelEditorV2(model());
  const restored = restoreEditionV2(source, loose(), { expectedRevision: 0 });
  if (restored.type !== 'restored') throw new Error('Restore unavailable');
  let state = updateEditor(restored.editor, {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 1,
    point: { x: 20, y: 40 },
  });
  state = updateEditor(state, { type: 'PointerMoved', pointer: 1, point: { x: 90, y: 80 } });
  state = updateEditor(state, { type: 'PointerReleased', pointer: 1 });
  expect(state.past).toHaveLength(2);
  expect(state.connectionHistory?.past.map((frame) => frame.connectionMode)).toEqual([
    'strict',
    'loose',
  ]);
  state = updateEditor(state, { type: 'NodeMeasured', id: 'a', size: { width: 200, height: 180 } });
  state = updateEditor(state, { type: 'UndoPressed' });
  expect(state.connectionMode).toBe('loose');
  state = updateEditor(state, { type: 'UndoPressed' });
  expect(state.connectionMode).toBe('strict');
  expect(state.graph.nodes[0]?.size.height).toBe(180);
});

test('cross-mode Undo retains clipboard data but incompatible paste blocks visibly without losing Redo', () => {
  const restored = restoreEditionV2(createModelEditorV2(model()), loose(), { expectedRevision: 0 });
  if (restored.type !== 'restored') throw new Error('Restore unavailable');
  let state = updateEditor(restored.editor, { type: 'NodeSelected', id: 'a', additive: false });
  state = updateEditor(state, { type: 'NodeSelected', id: 'b', additive: true });
  state = updateEditor(state, { type: 'CopyPressed' });
  const clipboard = state.clipboard;
  state = updateEditor(state, { type: 'UndoPressed' });
  const past = state.past;
  const rejected = updateEditor(state, { type: 'PastePressed' });
  expect(rejected.graph).toBe(state.graph);
  expect(rejected.past).toBe(past);
  expect(rejected.clipboard).toBe(clipboard);
  expect(rejected.notice).toContain('Clipboard');
  expect(rejected.future).toHaveLength(1);
  const redone = updateEditor(rejected, { type: 'RedoPressed' });
  const pasted = updateEditor(redone, { type: 'PastePressed' });
  expect(pasted.connectionMode).toBe('loose');
  expect(pasted.graph.nodes).toHaveLength(4);
});
