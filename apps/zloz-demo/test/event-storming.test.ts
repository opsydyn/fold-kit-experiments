import { expect, test } from 'bun:test';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { openModelDocument, workbenchDocument } from '../src/editor/model-sessions';
import { update } from '../src/editor/update';

test('event-storming example selects package views; additive insertion preserves visual mode and Undo', () => {
  const model = update(init().model, Message.SelectedExample({ example: 'event-storming' })).model;
  expect(model.nodeDesign).toBe('event-storming');
  expect(model.editor.graph.nodes.map((node) => node.architecture?.role)).toEqual([
    'actor',
    'command',
    'domain-event',
    'policy',
    'command',
  ]);
  const inserted = update(model, Message.ClickedInsertPattern({ pattern: 'event-storming' })).model;
  expect(inserted.editor.graph.nodes).toHaveLength(10);
  expect(inserted.editor.past).toEqual([model.editor.graph]);
  const undone = update(
    inserted,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph).toEqual(model.editor.graph);
  expect(inserted.nodeDesign).toBe(model.nodeDesign);
  const fresh = init('other').model;
  const opened = openModelDocument(fresh, workbenchDocument(model));
  expect(opened.nodeDesign).toBe('event-storming');
  expect(opened.editor.graph).toEqual(model.editor.graph);
});
