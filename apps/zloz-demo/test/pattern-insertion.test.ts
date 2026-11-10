import { expect, test } from 'bun:test';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { update } from '../src/editor/update';

test('palette adds a grouped DDD pattern without replacing identity/editions or prior graph, and Undo is atomic', () => {
  const start = init().model;
  const inserted = update(start, Message.ClickedInsertPattern({ pattern: 'ddd-aggregate' })).model;
  expect(inserted.editor.graph.nodes.slice(0, start.editor.graph.nodes.length)).toEqual([
    ...start.editor.graph.nodes,
  ]);
  expect(inserted.editor.graph.nodes.length).toBe(start.editor.graph.nodes.length + 3);
  expect(inserted.editor.past).toEqual([start.editor.graph]);
  expect(inserted.nodeDesign).toBe(start.nodeDesign);
  expect(inserted.modelIdentity).toBe(start.modelIdentity);
  expect(inserted.editions).toBe(start.editions);
  const undone = update(
    inserted,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph).toEqual(start.editor.graph);
  const redone = update(
    undone,
    Message.ObservedZlozInput({ message: { type: 'RedoPressed' } }),
  ).model;
  expect(redone.editor.graph).toEqual(inserted.editor.graph);
  const repeated = update(redone, Message.ClickedInsertPattern({ pattern: 'c4-context' })).model;
  expect(repeated.editor.past.length).toBe(2);
  expect(repeated.editor.graph.nodes.length).toBe(inserted.editor.graph.nodes.length + 2);
});

test('live protection and pending document reads cannot be bypassed by dispatching palette messages', () => {
  const start = init().model;
  const protectedModel = update(start, Message.ClickedPatternInsertionProtection()).model;
  const denied = update(
    protectedModel,
    Message.ClickedInsertPattern({ pattern: 'c4-context' }),
  ).model;
  expect(denied.editor).toBe(start.editor);
  expect(denied.notice).toContain('protected');
  const pending = update(
    start,
    Message.ChoseModelDocumentFiles({ files: [new File(['{}'], 'model.json')] }),
  ).model;
  const busy = update(pending, Message.ClickedInsertPattern({ pattern: 'ddd-aggregate' })).model;
  expect(busy.editor).toBe(start.editor);
  expect(busy.modelImport).toBe(pending.modelImport);
  expect(busy.notice).toContain('Finish');
});
