import { expect, test } from 'bun:test';

import { captureEdition, serializeEditions, updateEditor } from '@opsydyn/foldkit-zloz';
import { Effect } from 'effect';

import { ImportZlozEditions } from '../src/editor/command';
import { editionArchiveByteLimit, orderEditions } from '../src/editor/history';
import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { update } from '../src/editor/update';

const file = () => new File([serializeEditions(orderEditions())], 'orders.editions.json');
test('strict bounded file decoding accepts canonical archives and rejects invalid UTF-8, JSON and oversized valid input', async () => {
  const success = await Effect.runPromise(ImportZlozEditions({ id: 1, file: file() }).effect);
  expect(success._tag).toBe('SucceededEditionArchiveImport');
  for (const source of [
    new File([new Uint8Array([0xff])], 'bad.json'),
    new File(['{broken'], 'bad.json'),
    new File([' '.repeat(editionArchiveByteLimit), serializeEditions([])], 'huge.json'),
  ]) {
    const result = await Effect.runPromise(ImportZlozEditions({ id: 2, file: source }).effect);
    expect(result._tag).toBe('FailedEditionArchiveImport');
  }
});
test('import preserves working state, skips exact editions and rejects whole conflicts and stale/cancelled results', () => {
  const working = init().model;
  const started = update(working, Message.ChoseEditionArchiveFiles({ files: [file()] })).model;
  const imported = update(
    started,
    Message.SucceededEditionArchiveImport({
      id: started.editionImport!.id,
      editions: orderEditions(),
    }),
  ).model;
  expect(imported.editor).toBe(working.editor);
  expect(imported.editions).toHaveLength(2);
  const again = update(imported, Message.ChoseEditionArchiveFiles({ files: [file()] })).model;
  const identical = update(
    again,
    Message.SucceededEditionArchiveImport({
      id: again.editionImport!.id,
      editions: orderEditions(),
    }),
  ).model;
  expect(identical.editions).toBe(imported.editions);
  const conflict = update(imported, Message.ChoseEditionArchiveFiles({ files: [file()] })).model;
  const rejected = update(
    conflict,
    Message.SucceededEditionArchiveImport({
      id: conflict.editionImport!.id,
      editions: [{ ...orderEditions()[0]!, name: 'Conflict' }],
    }),
  ).model;
  expect(rejected.editions).toBe(imported.editions);
  const cancelled = update(started, Message.ClickedCancelEditionImport()).model;
  expect(
    update(
      cancelled,
      Message.SucceededEditionArchiveImport({
        id: started.editionImport!.id,
        editions: orderEditions(),
      }),
    ).model,
  ).toBe(cancelled);
  const changed = { ...started, editions: [orderEditions()[0]!] };
  const stale = update(
    changed,
    Message.SucceededEditionArchiveImport({
      id: started.editionImport!.id,
      editions: orderEditions(),
    }),
  ).model;
  expect(stale.editions).toBe(changed.editions);
  expect(stale.editor).toBe(working.editor);
});
test('restore is explicit, cancellable, policy-aware and undoable; stale previews cannot commit', () => {
  const examples = update(init().model, Message.ClickedOrderHistory()).model;
  const reviewing = update(examples, Message.SelectedHistoryEdition({ id: 'order-evolved' })).model;
  const preview = update(reviewing, Message.ClickedPreviewEditionRestore()).model;
  expect(preview.editionRestore?.edition.id).toBe('order-evolved');
  expect(preview.editor).toBe(examples.editor);
  expect(update(preview, Message.CompletedColorSchemeSave()).model).toBe(preview);
  expect(
    update(
      preview,
      Message.ObservedZlozInput({
        message: { type: 'NodeMeasured', id: 'order', size: { width: 999, height: 999 } },
      }),
    ).model,
  ).toBe(preview);
  const cancelled = update(preview, Message.ClickedCancelEditionRestore()).model;
  expect(cancelled.editor).toBe(examples.editor);
  expect(update(cancelled, Message.ClickedConfirmEditionRestore()).model.editor).toBe(
    examples.editor,
  );
  const protectedModel = update(preview, Message.ClickedEditionRestoreProtection()).model;
  const protectedAttempt = update(protectedModel, Message.ClickedConfirmEditionRestore()).model;
  expect(protectedAttempt.editor).toBe(examples.editor);
  expect(protectedAttempt.notice).toContain('protected');
  const changed = {
    ...preview,
    editor: updateEditor(preview.editor, {
      type: 'NodeLabelChanged',
      id: 'source',
      label: 'New work',
    }),
  };
  expect(update(changed, Message.ClickedConfirmEditionRestore()).model.editor).toBe(changed.editor);
  const restored = update(preview, Message.ClickedConfirmEditionRestore()).model;
  expect(restored.historyReview).toBeNull();
  expect(restored.editor.graph).toEqual(orderEditions()[1]!.snapshot.graph);
  expect(restored.editor.viewport).toBe(examples.editor.viewport);
  expect(updateEditor(restored.editor, { type: 'UndoPressed' }).graph).toEqual(
    examples.editor.graph,
  );
});
test('capturing after import avoids an already imported generated ID', () => {
  const model = init().model;
  const imported = {
    ...model,
    editions: [
      captureEdition({
        id: 'edition-1',
        name: 'Imported',
        snapshot: { graph: model.editor.graph },
      }),
    ],
    editionName: 'Next',
  };
  const captured = update(imported, Message.ClickedCaptureEdition()).model;
  expect(captured.editions.map((edition) => edition.id)).toEqual(['edition-1', 'edition-2']);
});

test('cancellation interrupts only the addressed archive read', async () => {
  const started = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<ArrayBuffer>();
  const slow = new File([], 'slow.json');
  Object.defineProperty(slow, 'arrayBuffer', {
    value: () => {
      started.resolve();
      return pending.promise;
    },
  });
  Effect.runFork(ImportZlozEditions({ id: 41, file: slow }).effect);
  await started.promise;
  const other = await Effect.runPromise(
    ImportZlozEditions.Interrupt({ id: 42 }, (outcome) => outcome).effect,
  );
  expect(other._tag).toBe('NotFound');
  const cancelled = await Effect.runPromise(
    ImportZlozEditions.Interrupt({ id: 41 }, (outcome) => outcome).effect,
  );
  expect(cancelled._tag).toBe('Interrupted');
  pending.resolve(new ArrayBuffer(0));
});
