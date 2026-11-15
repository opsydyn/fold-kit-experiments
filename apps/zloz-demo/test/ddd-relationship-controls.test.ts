import { expect, test } from 'bun:test';

import {
  createHistoryReview,
  captureEdition,
  updateEditor,
  type ZlozDddRelationshipRequest,
} from '@opsydyn/foldkit-zloz';

import { workbenchDddControls } from '../src/editor/ddd-relationship-controls';
import { workbenchPolicy } from '../src/editor/editor-policy';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';
function ready(): Model {
  const opened = update(init().model, Message.SelectedExample({ example: 'context-map' })).model;
  return update(
    { ...opened, sidebarSection: 'inspect' },
    Message.ObservedZlozInput({
      message: { type: 'EdgeSelected', id: 'orders-billing', additive: false },
    }),
  ).model;
}
function request(model: Model, change?: ZlozDddRelationshipRequest) {
  return Message.ObservedDddRelationshipInput({
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    request: change ?? {
      type: 'DownstreamRoleSelected',
      edgeId: 'orders-billing',
      revision: model.editor.revision,
      role: 'conformist',
    },
  });
}
test('public side-role edits update the canvas model once and Undo/Redo preserve prior authored meaning', () => {
  const model = ready(),
    message = request(model);
  const edited = update(model, message).model;
  expect(workbenchDddControls(edited).downstream?.value).toBe('conformist');
  expect(edited.editor.past).toEqual([model.editor.graph]);
  expect(edited.modelIdentity).toBe(model.modelIdentity);
  expect(edited.editions).toBe(model.editions);
  expect(update(edited, message).model).toBe(edited);
  const restored = update(
    edited,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(restored.editor.graph).toEqual(model.editor.graph);
  const redone = update(
    restored,
    Message.ObservedZlozInput({ message: { type: 'RedoPressed' } }),
  ).model;
  expect(redone.editor.graph).toEqual(edited.editor.graph);
});
test('owner protection is visible and covers both controls and direct editor events', () => {
  const model = ready(),
    protectedModel = update(model, Message.ClickedDddRelationshipProtection()).model;
  expect(workbenchDddControls(protectedModel).pattern.reason).toContain('managed');
  const blocked = update(protectedModel, request(protectedModel)).model;
  expect(blocked.editor).toBe(protectedModel.editor);
  expect(blocked.notice).toContain('managed');
  const direct = updateEditor(
    protectedModel.editor,
    {
      type: 'EdgeArchitectureChanged',
      id: 'orders-billing',
      architecture: { family: 'ddd', scope: 'strategic', role: 'partnership' },
    },
    workbenchPolicy(protectedModel),
  );
  expect(direct.graph).toBe(protectedModel.editor.graph);
  expect(direct.past).toBe(protectedModel.editor.past);
  expect(direct.notice).toContain('managed');
  const unlocked = update(protectedModel, Message.ClickedDddRelationshipProtection()).model;
  expect(update(unlocked, request(unlocked)).model.editor.past).toHaveLength(1);
});
test('model/epoch/hidden inspector, revision, busy import and historical review cannot replay an edit', () => {
  const model = ready(),
    message = request(model);
  for (const stale of [
    { ...model, modelEpoch: model.modelEpoch + 1 },
    { ...model, modelIdentity: { ...model.modelIdentity, id: 'other' } },
    { ...model, sidebarSection: 'diagram' as const },
  ])
    expect(update(stale, message).model).toBe(stale);
  const busy = { ...model, importing: { id: 1, revision: model.editor.revision } };
  expect(update(busy, request(busy)).model.editor).toBe(busy.editor);
  const review = createHistoryReview(
    captureEdition({ id: 'review', name: 'Review', snapshot: { graph: model.editor.graph } }),
    model.editor,
  );
  const historical = {
    ...model,
    historyReview: {
      ...review,
      editor: updateEditor(review.editor, {
        type: 'EdgeSelected',
        id: 'orders-billing',
        additive: false,
      }),
    },
  };
  const inspection = workbenchDddControls(historical);
  expect(inspection.reason).toContain('Return');
  const denied = update(historical, request(historical)).model;
  expect(denied.editor).toBe(model.editor);
  expect(denied.historyReview).toBe(historical.historyReview);
  const minimal = { ...model, minimalMode: true, diagnosticsEnabled: false };
  expect(workbenchDddControls(minimal).upstream).toHaveLength(2);
  expect(update(minimal, request(minimal)).model.editor.past).toHaveLength(1);
});
