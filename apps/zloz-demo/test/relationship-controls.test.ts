import { expect, test } from 'bun:test';

import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { relationshipControlsContext } from '../src/editor/relationship-controls';
import { update } from '../src/editor/update';
function ready(): Model {
  const model = update(init().model, Message.SelectedExample({ example: 'event-storming' })).model;
  return update(
    model,
    Message.ObservedZlozInput({ message: { type: 'EdgeSelected', id: 'step:0', additive: false } }),
  ).model;
}
const selected = (model: Model, key: string | null) =>
  Message.SelectedCausalRelationship({
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    edgeId: 'step:0',
    key,
  });
const inferred = (model: Model) =>
  Message.ClickedRelationshipInference({
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    edgeId: 'step:0',
  });
test('package requests apply ordinary semantic edits with explicit inference and single-step Undo', () => {
  const model = ready();
  const cleared = update(model, selected(model, null)).model;
  expect(cleared.editor.graph.edges[0]?.architecture).toBeUndefined();
  expect(cleared.editor.past).toHaveLength(1);
  const typed = update(cleared, inferred(cleared)).model;
  expect(typed.editor.graph.edges[0]?.architecture?.role).toBe('issues');
  expect(typed.editor.past).toHaveLength(2);
  expect(update(typed, inferred(typed)).model.editor.past).toHaveLength(2);
  const undone = update(
    typed,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph).toEqual(cleared.editor.graph);
});
test('changed inspector target and stale model/projection scope cannot edit an earlier selection', () => {
  const model = ready(),
    request = selected(model, null);
  for (const stale of [
    { ...request, modelId: 'another' },
    { ...request, epoch: model.modelEpoch - 1 },
    { ...request, key: 'missing' },
  ])
    expect(update(model, stale).model).toBe(model);
  const moved = update(
    model,
    Message.ObservedZlozInput({ message: { type: 'EdgeSelected', id: 'step:1', additive: false } }),
  ).model;
  expect(update(moved, request).model).toBe(moved);
  expect(relationshipControlsContext(moved).edge?.id).toBe('step:1');
});
test('current enforcement, busy and read-only policies are shared by context and update', () => {
  const model = ready();
  const free = update(model, Message.ClickedSemanticRelationships()).model;
  const request = selected(free, 'emits');
  expect(
    relationshipControlsContext(free).choices.find((choice) => choice.key === 'emits')?.reason,
  ).toBeNull();
  const protectedModel = update(free, Message.ClickedSemanticRelationships()).model;
  const rejected = update(protectedModel, request).model;
  expect(rejected.editor.graph).toBe(model.editor.graph);
  expect(rejected.editor.past).toHaveLength(0);
  expect(rejected.editor.notice).toContain('does not allow');
  const busy = { ...model, importing: { id: 1, revision: model.editor.revision } };
  expect(relationshipControlsContext(busy).reason).toContain('Finish active edits');
  expect(update(busy, selected(model, null)).model.editor.graph).toBe(model.editor.graph);
  const readonly = { ...model, editor: { ...model.editor, readOnly: true } };
  expect(update(readonly, selected(model, null)).model.editor.graph).toBe(model.editor.graph);
});
