import {
  resolveEventStormingWorkshopControls,
  resolveEventStormingWorkshopRequest,
  updateEditor,
  type ZlozWorkshopRequest,
} from '@opsydyn/foldkit-zloz';

import { workbenchPolicy } from './editor-policy';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
export function workshopNodeId(model: Model) {
  const editor = model.historyReview?.editor ?? model.editor;
  return (
    editor.graph.nodes.find(
      (n) => n.architecture?.family === 'event-storming' && editor.selectedNodes.includes(n.id),
    )?.id ?? null
  );
}
function options(model: Model) {
  return {
    policy: workbenchPolicy(model),
    blockedReason: modelSessionBusy(model)
      ? 'Finish active edits, imports or layout before editing workshop meaning.'
      : null,
  };
}
export function workbenchWorkshopContext(model: Model) {
  return resolveEventStormingWorkshopControls(
    model.historyReview?.editor ?? model.editor,
    workshopNodeId(model),
    options(model),
  );
}
export function editWorkbenchWorkshop(
  model: Model,
  request: ZlozWorkshopRequest,
  modelId: string,
  epoch: number,
): Model {
  if (
    modelId !== model.modelIdentity.id ||
    epoch !== model.modelEpoch ||
    model.sidebarSection !== 'inspect'
  )
    return model;
  const result = resolveEventStormingWorkshopRequest(
    model.historyReview?.editor ?? model.editor,
    workshopNodeId(model),
    request,
    options(model),
  );
  if (result.type === 'blocked') return { ...model, notice: result.reason };
  if (result.type !== 'ready' || model.historyReview) return model;
  const editor = updateEditor(model.editor, result.event, options(model).policy);
  return {
    ...model,
    editor,
    notice:
      editor.graph === model.editor.graph ? (editor.notice ?? '') : 'Workshop meaning updated.',
  };
}
