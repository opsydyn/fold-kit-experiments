import { expect, test } from 'bun:test';

import {
  createEditor,
  captureModelDocument,
  captureEdition,
  serializeModelDocument,
  updateEditor,
} from '@opsydyn/foldkit-zloz';
import { Effect } from 'effect';

import { ImportZlozModel } from '../src/editor/command';
import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { openModelDocument, workbenchDocument } from '../src/editor/model-sessions';
import { update } from '../src/editor/update';
const snapshot = { graph: { nodes: [], edges: [] }, viewport: { x: 4, y: 5, zoom: 1 } };
const edition = captureEdition({ id: 'original', name: 'Original', snapshot });
const document = captureModelDocument({
  id: 'imported',
  name: 'Portable alternative',
  snapshot,
  editions: [edition],
  origin: { modelId: 'parent', modelName: 'Parent', edition },
});
const file = () => new File([serializeModelDocument(document)], 'alternative.model.json');
test('model import opens a separate session with exact identity/origin/editions and preserves current Undo', async () => {
  const start = init().model;
  const source = {
    ...start,
    editor: updateEditor(start.editor, {
      type: 'NodeLabelChanged',
      id: 'source',
      label: 'Working edit',
    }),
  };
  const pending = update(source, Message.ChoseModelDocumentFiles({ files: [file()] })).model;
  expect(pending.editor).toBe(source.editor);
  const result = await Effect.runPromise(
    ImportZlozModel({ id: pending.modelImport!.id, file: file() }).effect,
  );
  const imported = update(pending, result).model;
  expect(workbenchDocument(imported)).toEqual(document);
  expect(imported.editor.past).toEqual([]);
  expect(imported.savedModels[0]!.editor).toBe(source.editor);
  const duplicate = update(imported, Message.ChoseModelDocumentFiles({ files: [file()] })).model;
  const rejected = update(
    duplicate,
    Message.SucceededModelDocumentImport({ id: duplicate.modelImport!.id, document }),
  ).model;
  expect(rejected.editor).toBe(imported.editor);
  expect(rejected.notice).toContain('already open');
});
test('cancelled, stale, malformed and newly protected reads do not publish imported models', async () => {
  const source = init().model;
  const pending = update(source, Message.ChoseModelDocumentFiles({ files: [file()] })).model;
  const id = pending.modelImport!.id;
  const cancelled = update(pending, Message.ClickedCancelModelImport()).model;
  expect(
    update(cancelled, Message.SucceededModelDocumentImport({ id, document: null })).model,
  ).toBe(cancelled);
  const changed = {
    ...pending,
    editor: updateEditor(pending.editor, {
      type: 'NodeLabelChanged',
      id: 'source',
      label: 'Changed',
    }),
  };
  expect(
    update(changed, Message.SucceededModelDocumentImport({ id, document })).model.modelIdentity,
  ).toBe(source.modelIdentity);
  const protectedModel = update(
    { ...pending, protectModelImport: true },
    Message.SucceededModelDocumentImport({ id, document }),
  ).model;
  expect(protectedModel.modelIdentity).toBe(source.modelIdentity);
  for (const bad of [
    new File(['{invalid'], 'bad'),
    new File([new Uint8Array([255])], 'bad'),
    new File([' '.repeat(5 * 1024 * 1024), serializeModelDocument(document)], 'large'),
  ]) {
    expect((await Effect.runPromise(ImportZlozModel({ id, file: bad }).effect))._tag).toBe(
      'FailedModelDocumentImport',
    );
  }
});

test('graph replacement with a reset revision invalidates a pending read', () => {
  const source = init().model;
  const pending = update(source, Message.ChoseModelDocumentFiles({ files: [file()] })).model;
  const replaced = { ...pending, editor: createEditor({ nodes: [], edges: [] }) };
  const stale = update(
    replaced,
    Message.SucceededModelDocumentImport({ id: pending.modelImport!.id, document }),
  ).model;
  expect(stale.modelIdentity).toBe(source.modelIdentity);
  expect(stale.editor).toBe(replaced.editor);
});

test('import preserves a camera outside the source zoom limits without changing the source', () => {
  const source = init().model;
  const portable = captureModelDocument({
    ...document,
    snapshot: { ...snapshot, viewport: { x: 40, y: -20, zoom: 12 } },
  });
  const opened = openModelDocument(source, portable);
  expect(opened.editor.viewport).toEqual(portable.snapshot.viewport!);
  expect(opened.savedModels[0]!.editor).toBe(source.editor);
  expect(opened.editor.zoomLimits.maxZoom).toBeGreaterThanOrEqual(12);
  expect(source.editor.zoomLimits.maxZoom).toBeLessThan(12);
});
