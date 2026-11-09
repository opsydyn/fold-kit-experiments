import {
  captureModelDocument,
  createModelEditor,
  forkEdition,
  type EditorState,
  type ZlozEdition,
  type ZlozModelDocument,
} from '@opsydyn/foldkit-zloz';

import type { Model } from './model';

export type WorkbenchModelIdentity = Pick<ZlozModelDocument, 'id' | 'name' | 'origin'>;
export type WorkbenchModelSession = Readonly<{
  identity: WorkbenchModelIdentity;
  nodeDesign: Model['nodeDesign'];
  editor: EditorState;
  editions: readonly ZlozEdition[];
}>;
export function workbenchDocument(model: Model): ZlozModelDocument {
  return captureModelDocument({
    ...model.modelIdentity,
    snapshot: { graph: model.editor.graph, viewport: model.editor.viewport },
    editions: model.editions,
  });
}
export function modelSessionBusy(model: Model): boolean {
  return (
    model.editor.gesture.type !== 'idle' ||
    model.active !== null ||
    model.importing !== null ||
    model.editionImport !== null ||
    model.modelImport !== null ||
    model.editor.edgeLabelDraft !== null ||
    model.portLabelDraft !== null ||
    model.portPositionDraft !== null
  );
}
function session(model: Model): WorkbenchModelSession {
  return {
    identity: model.modelIdentity,
    nodeDesign: model.nodeDesign,
    editor: model.editor,
    editions: model.editions,
  };
}
function activate(
  model: Model,
  next: WorkbenchModelSession,
  savedModels: readonly WorkbenchModelSession[],
): Model {
  const surface = model.historyReview?.editor.surface ?? model.editor.surface;
  const editor =
    surface?.width === next.editor.surface?.width && surface?.height === next.editor.surface?.height
      ? next.editor
      : { ...next.editor, surface };
  return {
    ...model,
    modelIdentity: next.identity,
    modelEpoch: model.modelEpoch + 1,
    nodeDesign: next.nodeDesign,
    editor,
    editions: next.editions,
    savedModels,
    historyReview: null,
    historyPlayback: null,
    playbackRun: model.playbackRun + 1,
    historyBaselineId: null,
    auditComparison: { ...model.auditComparison, baselineId: null, selectedId: null },
    editionRestore: null,
    editionName: '',
    forkName: '',
    active: null,
    importing: null,
    editionImport: null,
    modelImport: null,
    portLabelDraft: null,
    portPositionDraft: null,
    mermaidLossConsentRevision: null,
    searchQuery: '',
    sequence: model.sequence + 1,
  };
}
export function forkWorkingEdition(model: Model): Model {
  if (modelSessionBusy(model))
    return { ...model, notice: 'Finish active edits, imports or layout before creating a model.' };
  const editionId = model.historyReview?.editionId;
  if (!editionId) return model;
  let sequence = model.sequence + 1;
  const ids = new Set([
    model.modelIdentity.id,
    ...model.savedModels.map((item) => item.identity.id),
  ]);
  while (ids.has(`model:${model.modelNamespace}:${sequence}`)) sequence++;
  const result = forkEdition(
    workbenchDocument(model),
    editionId,
    { id: `model:${model.modelNamespace}:${sequence}`, name: model.forkName },
    {
      canForkEdition: () =>
        model.protectEditionFork ? 'Edition forking is protected in this workspace.' : null,
    },
  );
  if (result.type === 'blocked') return { ...model, notice: result.reason };
  const document = result.document;
  // The public initializer copies only EditorOptions preferences; no transient state or Undo is inherited.
  const { visibility: _visibility, ...preferences } = model.editor;
  const editor = createModelEditor(document, {
    ...preferences,
    readOnly: false,
    viewport: model.historyReview!.editor.viewport,
  });
  return {
    ...activate(
      { ...model, sequence },
      {
        identity: { id: document.id, name: document.name, origin: document.origin },
        nodeDesign: documentDesign(document, model.nodeDesign),
        editor,
        editions: document.editions,
      },
      [...model.savedModels, session(model)],
    ),
    notice: `Fork created: ${document.name}. The source model and its Undo history are preserved.`,
  };
}
export function selectWorkingModel(model: Model, id: string): Model {
  if (id === model.modelIdentity.id) return model;
  const target = model.savedModels.find((item) => item.identity.id === id);
  if (!target) return model;
  if (modelSessionBusy(model))
    return { ...model, notice: 'Finish active edits, imports or layout before switching models.' };
  return {
    ...activate(model, target, [
      ...model.savedModels.filter((item) => item.identity.id !== id),
      session(model),
    ]),
    notice: `Working model: ${target.identity.name}. Its own Undo history is preserved.`,
  };
}

/** Import is additive at the session registry boundary; no identity is renamed or overwritten. */
export function openModelDocument(model: Model, input: ZlozModelDocument): Model {
  if (modelSessionBusy(model))
    return { ...model, notice: 'Finish active edits, imports or layout before opening a model.' };
  if (model.protectModelImport)
    return { ...model, notice: 'Model import is protected in this workspace.' };
  const document = captureModelDocument(input);
  if (
    document.id === model.modelIdentity.id ||
    model.savedModels.some((item) => item.identity.id === document.id)
  )
    return {
      ...model,
      notice:
        'This model ID is already open. Switch to that model; import will not overwrite or rename it.',
    };
  const { visibility: _visibility, viewport: _viewport, ...preferences } = model.editor;
  const cameraZoom = document.snapshot.viewport?.zoom ?? 1;
  const zoomLimits = {
    minZoom: Math.min(model.editor.zoomLimits.minZoom, cameraZoom),
    maxZoom: Math.max(model.editor.zoomLimits.maxZoom, cameraZoom),
  };
  const editor = createModelEditor(document, { ...preferences, zoomLimits, readOnly: false });
  return {
    ...activate(
      model,
      {
        identity: { id: document.id, name: document.name, origin: document.origin },
        nodeDesign: documentDesign(document, model.nodeDesign),
        editor,
        editions: document.editions,
      },
      [...model.savedModels, session(model)],
    ),
    notice: `Opened model: ${document.name}. Existing models and Undo histories are preserved.`,
  };
}

function documentDesign(
  document: ZlozModelDocument,
  fallback: Model['nodeDesign'],
): Model['nodeDesign'] {
  const nodes = document.snapshot.graph.nodes;
  if (nodes.some((node) => node.architecture?.family === 'event-storming')) return 'event-storming';
  if (nodes.some((node) => node.architecture?.family === 'ddd')) return 'ddd';
  return nodes.some((node) => node.architecture?.family === 'c4') ? 'c4' : fallback;
}
