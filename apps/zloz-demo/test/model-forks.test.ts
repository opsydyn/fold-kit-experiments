import { expect, test } from 'bun:test';

import {
  layoutRequest,
  updateEditor,
  serializeModelDocument,
  parseModelDocument,
} from '@opsydyn/foldkit-zloz';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { workbenchDocument } from '../src/editor/model-sessions';
import { update } from '../src/editor/update';
const prepared = () => {
  const start = init().model;
  const source = {
    ...start,
    editor: updateEditor(start.editor, {
      type: 'NodeLabelChanged',
      id: 'source',
      label: 'Working draft',
    }),
  };
  const loaded = update(source, Message.ClickedOrderHistory()).model;
  return update(loaded, Message.SelectedHistoryEdition({ id: 'order-start' })).model;
};
test('fork and switching preserve both independent editors and their Undo histories', () => {
  const source = prepared();
  const fork = update(
    { ...source, forkName: 'Alternative ordering' },
    Message.ClickedForkEdition(),
  ).model;
  expect(fork.modelIdentity.id).not.toBe(source.modelIdentity.id);
  expect(fork.modelIdentity.origin!.modelId).toBe(source.modelIdentity.id);
  expect(fork.editor.past).toEqual([]);
  expect(fork.editions).toEqual([]);
  expect(fork.historyReview).toBeNull();
  expect(fork.editor.readOnly).toBe(false);
  expect(fork.savedModels[0]!.editor).toBe(source.editor);
  const edited = update(
    fork,
    Message.ObservedZlozInput({
      message: { type: 'NodeLabelChanged', id: 'order', label: 'Fork only' },
    }),
  ).model;
  expect(edited.editor.past).toHaveLength(1);
  const returned = update(
    edited,
    Message.SelectedWorkingModel({ id: source.modelIdentity.id }),
  ).model;
  expect(returned.editor).toBe(source.editor);
  expect(returned.editions).toBe(source.editions);
  const revisited = update(
    returned,
    Message.SelectedWorkingModel({ id: fork.modelIdentity.id }),
  ).model;
  expect(revisited.editor.graph.nodes.find((n) => n.id === 'order')!.label).toBe('Fork only');
  const undone = update(
    revisited,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph.nodes.find((n) => n.id === 'order')!.label).toBe('Order');
  expect(parseModelDocument(serializeModelDocument(workbenchDocument(edited))).origin).toEqual(
    fork.modelIdentity.origin,
  );
});
test('busy sessions and policy veto cannot fork or switch; late imports cannot cross models', () => {
  const source = { ...prepared(), forkName: 'Fork' };
  const blocked = update(
    { ...source, protectEditionFork: true },
    Message.ClickedForkEdition(),
  ).model;
  expect(blocked.modelIdentity).toBe(source.modelIdentity);
  expect(blocked.notice).toContain('protected');
  for (const extra of [
    { importing: { id: 12, revision: source.editor.revision } },
    { active: layoutRequest(source.editor, 'busy') },
    { editionImport: { id: 12, editions: source.editions } },
  ]) {
    const busy = { ...source, ...extra };
    expect(update(busy, Message.ClickedForkEdition()).model.modelIdentity).toBe(
      source.modelIdentity,
    );
  }
  const fork = update(source, Message.ClickedForkEdition()).model;
  expect(
    update(fork, Message.SucceededImport({ id: source.sequence, json: 'stale invalid JSON' }))
      .model,
  ).toBe(fork);
  const loading = update(fork, Message.ClickedLoad()).model;
  expect(
    update(loading, Message.SelectedWorkingModel({ id: source.modelIdentity.id })).model
      .modelIdentity,
  ).toBe(fork.modelIdentity);
});

test('rewind cannot strand pending layout or graph-load completions', () => {
  const source = update(init().model, Message.ClickedOrderHistory()).model;
  for (const busy of [
    { ...source, active: layoutRequest(source.editor, 'pending') },
    { ...source, importing: { id: 42, revision: source.editor.revision } },
  ]) {
    expect(update(busy, Message.SelectedHistoryEdition({ id: 'order-start' })).model).toBe(busy);
  }
});

test('late canvas events are scoped to a model and a specific active session, including return trips', () => {
  const original = { ...prepared(), forkName: 'Alternative' };
  const fork = update(original, Message.ClickedForkEdition()).model;
  const late = Message.ObservedModelInput({
    modelId: original.modelIdentity.id,
    epoch: original.modelEpoch,
    message: { type: 'NodeLabelChanged', id: 'source', label: 'Stale' },
  });
  expect(update(fork, late).model).toBe(fork);
  const returned = update(
    fork,
    Message.SelectedWorkingModel({ id: original.modelIdentity.id }),
  ).model;
  expect(update(returned, late).model).toBe(returned);
  const current = Message.ObservedModelInput({
    modelId: returned.modelIdentity.id,
    epoch: returned.modelEpoch,
    message: { type: 'NodeLabelChanged', id: 'source', label: 'Current' },
  });
  expect(update(returned, current).model.editor.graph.nodes[0]!.label).toBe('Current');
});

test('history projection transitions also reject callbacks from the previous editor instance', () => {
  const base = update(init().model, Message.ClickedOrderHistory()).model;
  const review = update(base, Message.SelectedHistoryEdition({ id: 'order-start' })).model;
  const returned = update(review, Message.ClickedHistoryPresent()).model;
  const lateReview = Message.ObservedModelInput({
    modelId: review.modelIdentity.id,
    epoch: review.modelEpoch,
    message: { type: 'ViewportChanged', viewport: { x: 999, y: 999, zoom: 2 } },
  });
  expect(update(returned, lateReview).model).toBe(returned);
});

test('stale model scopes reject before inspecting a historical canvas payload', () => {
  const review = prepared();
  expect(
    update(
      review,
      Message.ObservedModelInput({
        modelId: review.modelIdentity.id,
        epoch: review.modelEpoch + 1,
        message: null,
      }),
    ).model,
  ).toBe(review);
});
