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
    'aggregate-root',
    'domain-event',
    'policy',
    'command',
  ]);
  const inserted = update(model, Message.ClickedInsertPattern({ pattern: 'event-storming' })).model;
  expect(inserted.editor.graph.nodes).toHaveLength(11);
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

test('relationship validation is opt-in, custom delegation is explicit and failed edits never add Undo', () => {
  const model = update(init().model, Message.SelectedExample({ example: 'event-storming' })).model;
  expect(model.semanticRelationships).toBe(true);
  const click = Message.ClickedDelegatedRelationship({
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
  });
  const blocked = update(model, click).model;
  expect(blocked.editor.graph).toBe(model.editor.graph);
  expect(blocked.editor.past).toHaveLength(0);
  expect(blocked.editor.notice).toContain('not available');
  const custom = update(blocked, Message.ClickedCustomStormingRelationships()).model;
  const added = update(custom, click).model;
  expect(added.editor.graph.edges.at(-1)?.architecture).toEqual({
    family: 'event-storming',
    role: 'custom',
    name: 'delegates',
  });
  expect(added.editor.past).toHaveLength(1);
  const undone = update(
    added,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph).toEqual(model.editor.graph);
  const stale = update(custom, { ...click, epoch: custom.modelEpoch - 1 }).model;
  expect(stale.editor).toBe(custom.editor);
  const relaxed = update(model, Message.ClickedSemanticRelationships()).model;
  const unresolved = update(relaxed, click).model;
  expect(unresolved.editor.graph.edges).toHaveLength(6);
  const first = model.editor.graph.edges[0];
  if (!first) throw new Error('Missing edge');
  const bad = Message.ObservedZlozInput({
    message: {
      type: 'EdgeArchitectureChanged',
      id: first.id,
      architecture: { family: 'event-storming', role: 'emits' },
    },
  });
  expect(update(model, bad).model.editor.graph).toBe(model.editor.graph);
  expect(update(relaxed, bad).model.editor.graph.edges[0]?.architecture?.role).toBe('emits');
});
