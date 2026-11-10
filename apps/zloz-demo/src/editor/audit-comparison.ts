import {
  createEventStormingPattern,
  mergeEditions,
  createHistoryReview,
  updateHistoryReview,
  updateEditor,
  resolveAuditComparisonControls,
  resolveAuditComparisonRequest,
  type ZlozAuditComparisonRequest,
  type ZlozEdition,
} from '@opsydyn/foldkit-zloz';

import type { Model } from './model';
import { modelSessionBusy, workbenchDocument } from './model-sessions';
import { pauseHistoryPlayback, playbackInspectionReason } from './playback';

function options(model: Model) {
  return {
    blockedReason:
      playbackInspectionReason(model) ??
      (!(model.historyReview?.editor.surface ?? model.editor.surface)
        ? 'Waiting for the canvas measurement.'
        : null),
  };
}
export function workbenchAuditContext(model: Model) {
  return resolveAuditComparisonControls(
    workbenchDocument(model),
    model.auditComparison,
    options(model),
  );
}
export function updateWorkbenchAudit(
  model: Model,
  request: ZlozAuditComparisonRequest,
  modelId: string,
  epoch: number,
): Model {
  if (
    modelId !== model.modelIdentity.id ||
    epoch !== model.modelEpoch ||
    model.sidebarSection !== 'history'
  )
    return model;
  const result = resolveAuditComparisonRequest(
    workbenchDocument(model),
    model.auditComparison,
    request,
    options(model),
  );
  if (result.type === 'ignored') return model;
  if (result.type === 'blocked') return { ...model, notice: result.reason };
  if (result.type === 'ready')
    return {
      ...(request.type === 'FilterToggled' ? model : pauseHistoryPlayback(model)),
      auditComparison: result.state,
    };
  const paused = pauseHistoryPlayback(model);
  const surface = model.historyReview?.editor.surface ?? model.editor.surface;
  if (result.source.kind === 'current')
    return {
      ...paused,
      modelEpoch: model.modelEpoch + (model.historyReview === null ? 0 : 1),
      historyReview: null,
      editionRestore: null,
      editor: updateEditor({ ...model.editor, surface }, result.event),
      notice: `Viewing ${result.entry.kind} finding in the current graph: ${result.entry.label}.`,
    };
  const source = result.source;
  const edition = model.editions.find((edition) => edition.id === source.id);
  if (!edition) return model;
  const review =
    model.historyReview?.editionId === source.id
      ? model.historyReview
      : createHistoryReview(edition, { ...model.editor, surface });
  return {
    ...paused,
    modelEpoch: model.modelEpoch + (model.historyReview?.editionId === source.id ? 0 : 1),
    editionRestore: null,
    historyReview: updateHistoryReview(review, result.event),
    notice: `Viewing ${result.entry.kind} finding in ${source.name}: ${result.entry.label}.`,
  };
}
/** Synthetic semantic findings; never replaces the user's working graph or Undo stack. */
export function auditExampleEditions(): readonly ZlozEdition[] {
  const graph = createEventStormingPattern({ includeAggregate: true });
  const [first, second, third] = graph.edges;
  if (!first || !second || !third) return [];
  const bad = {
    ...first,
    architecture: { family: 'event-storming' as const, role: 'emits' as const },
  };
  const before = {
    ...graph,
    edges: [
      { ...bad, id: 'audit-fixed', label: 'Submit' },
      {
        ...second,
        id: 'audit-removed',
        label: 'Legacy',
        architecture: { family: 'event-storming' as const, role: 'activates' as const },
      },
      {
        ...third,
        id: 'audit-keep',
        label: 'Outstanding submission',
        architecture: { family: 'event-storming' as const, role: 'triggers' as const },
      },
      ...graph.edges.slice(3),
    ],
  };
  const after = {
    ...graph,
    edges: [
      { ...first, id: 'audit-fixed', label: 'Submit' },
      {
        ...second,
        id: 'audit-added',
        label: 'Handles',
        architecture: { family: 'event-storming' as const, role: 'triggers' as const },
      },
      {
        ...third,
        id: 'audit-keep',
        label: 'Outstanding submission',
        architecture: { family: 'event-storming' as const, role: 'triggers' as const },
      },
      ...graph.edges.slice(3),
    ],
  };
  return [
    { id: 'audit-before', name: 'Causal review · before', snapshot: { graph: before } },
    { id: 'audit-after', name: 'Causal review · after', snapshot: { graph: after } },
  ];
}
export function loadAuditExample(model: Model): Model {
  if (modelSessionBusy(model) || playbackInspectionReason(model))
    return { ...model, notice: 'Finish active edits before loading audit examples.' };
  const merged = mergeEditions(model.editions, auditExampleEditions());
  if (merged.type === 'blocked') return { ...model, notice: merged.reason };
  const edition = merged.editions.find((edition) => edition.id === 'audit-after');
  if (!edition) return model;
  const surface = model.historyReview?.editor.surface ?? model.editor.surface;
  return {
    ...pauseHistoryPlayback(model),
    editions: merged.editions,
    nodeDesign: 'event-storming',
    modelEpoch: model.modelEpoch + 1,
    sidebarSection: 'history',
    historyReview: updateHistoryReview(createHistoryReview(edition, { ...model.editor, surface }), {
      type: 'FitViewClicked',
    }),
    auditComparison: {
      ...model.auditComparison,
      baselineId: 'audit-before',
      selectedId: 'audit-after',
    },
    notice:
      'Causal audit example loaded. Findings navigate between immutable editions; your working graph and Undo are preserved.',
  };
}
