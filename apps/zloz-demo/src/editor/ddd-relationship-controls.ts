import {
  resolveDddRelationshipControls,
  resolveDddRelationshipRequest,
  updateEditor,
  type ZlozDddRelationshipRequest,
} from '@opsydyn/foldkit-zloz';

import { workbenchPolicy } from './editor-policy';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { inspectedRelationshipId } from './relationship-controls';
function options(model: Model) {
  return {
    policy: workbenchPolicy(model),
    blockedReason: model.historyReview
      ? 'Return to the working model before editing DDD meaning.'
      : modelSessionBusy(model)
        ? 'Finish active edits, imports or layout before editing DDD meaning.'
        : null,
  };
}
export function workbenchDddControls(model: Model) {
  const editor = model.historyReview?.editor ?? model.editor;
  return resolveDddRelationshipControls(editor, inspectedRelationshipId(editor), options(model));
}
export function editWorkbenchDddRelationship(
  model: Model,
  request: ZlozDddRelationshipRequest,
  modelId: string,
  epoch: number,
): Model {
  if (
    modelId !== model.modelIdentity.id ||
    epoch !== model.modelEpoch ||
    model.sidebarSection !== 'inspect'
  )
    return model;
  const editor = model.historyReview?.editor ?? model.editor;
  const currentOptions = options(model);
  const result = resolveDddRelationshipRequest(
    editor,
    inspectedRelationshipId(editor),
    request,
    currentOptions,
  );
  if (result.type === 'blocked') return { ...model, notice: result.reason };
  if (result.type !== 'ready') return model;
  const next = updateEditor(model.editor, result.event, currentOptions.policy);
  return {
    ...model,
    editor: next,
    notice:
      next.graph === model.editor.graph
        ? (next.notice ?? model.notice)
        : 'DDD meaning updated. Undo is available.',
  };
}
