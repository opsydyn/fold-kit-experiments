import {
  createModelEditorV2,
  captureConnectionDocument,
  parseModelDocumentV2,
  serializeModelDocumentV2,
} from '@opsydyn/foldkit-zloz';
import { expect, test } from 'vitest';

import {
  init,
  update,
  initialDocument,
  documentFor,
  Message,
  type Model,
} from '../src/history-workbench/state';
const send = (model: Model, message: Message) => update(model, message).model;
const chooseLoose = (model: Model) => send(model, Message.SelectedEdition({ id: 'loose-evolved' }));

test('v2 workspace review, ghosts, change navigation and minimal/theme preferences retain chosen side and working history', () => {
  const initial = init().model;
  const edited = send(
    initial,
    Message.ObservedEditor({
      epoch: initial.epoch,
      event: { type: 'NodeLabelChanged', id: 'a', label: 'Working' },
    }),
  );
  let model = chooseLoose(edited);
  expect(model.review?.editor.connectionMode).toBe('loose');
  const working = model.editor;
  model = send(model, Message.SelectedSide({ side: 'baseline' }));
  model = send(model, Message.ClickedChangeStep({ direction: 'next' }));
  expect(model.side).toBe('baseline');
  expect(model.notice).toContain('baseline connection mode: strict');
  model = send(model, Message.ClickedChangeStep({ direction: 'next' }));
  expect(model.side).toBe('baseline');
  model = send(model, Message.ClickedMinimal());
  model = send(model, Message.SelectedTheme({ theme: 'dark' }));
  expect(model.editor).toBe(working);
  expect(model.editor.past).toHaveLength(1);
  expect(model.ghosts.enabled).toBe(true);
  expect(model.review?.editor.past).toHaveLength(0);
});

test('restore preview invalidates on protection round trips and cross-mode confirmation is exactly one working Undo', () => {
  let model = chooseLoose(init().model);
  const source = model.editor;
  model = send(model, Message.ClickedRestorePreview());
  expect(model.preview).not.toBeNull();
  model = send(model, Message.ClickedProtection());
  model = send(model, Message.ClickedProtection());
  expect(model.preview).toBeNull();
  model = send(model, Message.ClickedRestoreConfirm());
  expect(model.editor).toBe(source);
  model = send(model, Message.ClickedRestorePreview());
  model = send(model, Message.ClickedRestoreConfirm());
  expect(model.editor.connectionMode).toBe('loose');
  expect(model.editor.past).toHaveLength(1);
  expect(model.review).toBeNull();
  model = send(
    model,
    Message.ObservedEditor({ epoch: model.epoch, event: { type: 'UndoPressed' } }),
  );
  expect(model.editor.connectionMode).toBe('strict');
  expect(model.editor.graph).toEqual(source.graph);
  model = send(
    model,
    Message.ObservedEditor({ epoch: model.epoch, event: { type: 'RedoPressed' } }),
  );
  expect(model.editor.connectionMode).toBe('loose');
});

test('capture and archive imports use immutable package transactions, conflicts and stale/cancelled results preserve working state', () => {
  let model = init().model;
  model = send(model, Message.ChangedName({ name: 'Captured' }));
  model = send(model, Message.ClickedCapture());
  expect(model.editions).toHaveLength(3);
  const editor = model.editor;
  const file = new File(['{}'], 'editions.json');
  const reading = update(model, Message.ChoseFile({ kind: 'archive', files: [file] }));
  expect(reading.commands).toHaveLength(1);
  const token = reading.model.reading!.token;
  const duplicate = send(
    reading.model,
    Message.SucceededArchiveRead({ token, editions: model.editions }),
  );
  expect(duplicate.editions).toHaveLength(3);
  expect(duplicate.editor).toBe(editor);
  const conflict = send(
    reading.model,
    Message.SucceededArchiveRead({
      token,
      editions: [{ ...model.editions[0]!, name: 'Conflict' }],
    }),
  );
  expect(conflict.editions).toBe(model.editions);
  expect(conflict.conflict).not.toBeNull();
  const cancellation = update(reading.model, Message.ClickedCancelRead());
  expect(cancellation.commands?.[0]).toMatchObject({
    _tag: 'Interrupt',
    name: 'ReadHistoryFile',
    groupKey: JSON.stringify({ token }),
  });
  const cancelled = cancellation.model;
  expect(send(cancelled, Message.SucceededArchiveRead({ token, editions: [] }))).toBe(cancelled);
  expect(send(reading.model, Message.FailedRead({ token: token + 1 }))).toBe(reading.model);
  const stale = send(
    { ...reading.model, editor: { ...editor, revision: editor.revision + 1 } },
    Message.SucceededArchiveRead({ token, editions: [] }),
  );
  expect(stale.reading).toBeNull();
  expect(stale.editions).toBe(model.editions);
  expect(stale.editor.revision).toBe(editor.revision + 1);
});

test('model import starts fresh mode-aware history and retains the previous working session and Undo for return', () => {
  let model = init().model;
  model = send(
    model,
    Message.ObservedEditor({
      epoch: model.epoch,
      event: { type: 'NodeLabelChanged', id: 'a', label: 'Local' },
    }),
  );
  const editor = model.editor;
  const imported = {
    ...initialDocument(),
    id: 'imported',
    snapshot: initialDocument().editions[1]!.snapshot,
  };
  model = send(
    model,
    Message.ChoseFile({ kind: 'model', files: [new File(['{}'], 'model.json')] }),
  );
  model = send(
    model,
    Message.SucceededModelRead({ token: model.reading!.token, document: imported }),
  );
  expect(model.editor.connectionMode).toBe('loose');
  expect(model.editor.past).toHaveLength(0);
  expect(model.editor.connectionHistory).toBeDefined();
  expect(
    parseModelDocumentV2(serializeModelDocumentV2(documentFor(model))).snapshot.connectionMode,
  ).toBe('loose');
  model = send(model, Message.ClickedPreviousSession());
  expect(model.editor).toBe(editor);
  expect(model.editor.past).toHaveLength(1);
  expect(model.editor.graph.nodes[0]?.label).toBe('Local');
});

test('playback retains working state, ignores stale clocks, pauses for visibility/reduced motion and allows manual rewind', () => {
  const initial = init().model;
  let model = send(initial, Message.ChangedReducedMotion({ reduced: false }));
  model = send(model, Message.ClickedTransport({ action: 'PlayClicked' }));
  const run = model.run;
  expect(model.playback.cursor.status).toBe('playing');
  model = send(model, Message.AdvancedPlayback({ run }));
  expect(model.review?.editor.connectionMode).toBe('loose');
  expect(model.editor).toBe(initial.editor);
  expect(send(model, Message.AdvancedPlayback({ run }))).toBe(model);
  model = send(model, Message.ChangedVisibility({ visible: false }));
  expect(model.playback.cursor.status).toBe('paused');
  model = send(model, Message.ChangedVisibility({ visible: true }));
  model = send(model, Message.ChangedReducedMotion({ reduced: true }));
  model = send(model, Message.ClickedTransport({ action: 'RewindClicked' }));
  expect(model.review?.editor.connectionMode).toBe('strict');
  expect(model.editor).toBe(initial.editor);
  const stale = send(
    model,
    Message.ObservedEditor({
      epoch: model.epoch - 1,
      event: { type: 'NodeLabelChanged', id: 'a', label: 'Bad' },
    }),
  );
  expect(stale).toBe(model);
});

test('mode inspection from the working canvas never creates a review or moves its camera', () => {
  const initial = init().model;
  const model = send(initial, Message.ClickedChangeStep({ direction: 'next' }));
  expect(model.review).toBeNull();
  expect(model.editor).toBe(initial.editor);
  expect(model.notice).toContain('Camera unchanged');
});

test('passive node measurement does not interrupt read-only playback', () => {
  let model = send(init().model, Message.ChangedReducedMotion({ reduced: false }));
  model = send(model, Message.ClickedTransport({ action: 'PlayClicked' }));
  const next = send(
    model,
    Message.ObservedEditor({
      epoch: model.epoch,
      event: { type: 'NodeMeasured', id: 'a', size: { width: 220, height: 130 } },
    }),
  );
  expect(next.playback.cursor.status).toBe('playing');
  expect(next.run).toBe(model.run);
  const cancelled = send(
    next,
    Message.ObservedEditor({ epoch: next.epoch, event: { type: 'GestureCancelled' } }),
  );
  expect(cancelled.playback.cursor.status).toBe('playing');
  expect(cancelled.run).toBe(model.run);
});
