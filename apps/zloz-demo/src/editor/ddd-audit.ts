import {
  createArchitectureNode,
  mergeEditions,
  createHistoryReview,
  updateHistoryReview,
  updateEditor,
  resolveDddAuditControls,
  resolveDddAuditRequest,
  type ZlozDddAuditRequest,
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
export function workbenchDddAuditContext(model: Model) {
  return resolveDddAuditControls(workbenchDocument(model), model.dddAudit, options(model));
}
export function updateWorkbenchDddAudit(
  model: Model,
  request: ZlozDddAuditRequest,
  modelId: string,
  epoch: number,
): Model {
  if (
    modelId !== model.modelIdentity.id ||
    epoch !== model.modelEpoch ||
    model.sidebarSection !== 'history'
  )
    return model;
  const result = resolveDddAuditRequest(
    workbenchDocument(model),
    model.dddAudit,
    request,
    options(model),
  );
  if (result.type === 'ignored') return model;
  if (result.type === 'blocked') return { ...model, notice: result.reason };
  if (result.type === 'ready')
    return {
      ...(request.type === 'FilterToggled' ? model : pauseHistoryPlayback(model)),
      dddAudit: result.state,
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
/** Synthetic owned editions; working source and Undo are preserved. */
export function dddAuditExampleEditions(): readonly ZlozEdition[] {
  const nodes = (
    [
      ['order', 'Order', 'aggregate-root', 40, 40],
      ['repo', 'Orders repository', 'repository', 40, 270],
      ['event', 'Order placed', 'domain-event', 470, 140],
      ['context', 'Ordering context', 'bounded-context', 470, 400],
    ] as const
  ).map(([id, label, role, x, y]) =>
    createArchitectureNode({
      id,
      label,
      position: { x, y },
      size: { width: 240, height: 140 },
      ports: [
        { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
        { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
      ],
      architecture: { family: 'ddd', role },
    }),
  );
  const bad = {
    source: { node: 'repo', port: 'out' },
    target: { node: 'event', port: 'in' },
    architecture: { family: 'ddd', scope: 'tactical', role: 'emits' },
  } as const;
  const custom = {
    source: { node: 'order', port: 'out' },
    target: { node: 'event', port: 'in' },
    architecture: { family: 'ddd', scope: 'tactical', role: 'custom', name: 'enriches' },
  } as const;
  const before = {
    nodes,
    edges: [
      { ...bad, id: 'keep', label: 'Outstanding emission' },
      { ...bad, id: 'fixed', label: 'Placed event' },
      {
        id: 'removed',
        label: 'Legacy partnership',
        source: { node: 'context', port: 'out' },
        target: { node: 'context', port: 'in' },
        architecture: { family: 'ddd', scope: 'strategic', role: 'partnership' } as const,
      },
      { ...bad, id: 'recoded', label: 'Changed convention' },
    ],
  };
  const after = {
    nodes,
    edges: [
      { ...bad, id: 'keep', label: 'Still outstanding' },
      { ...bad, id: 'fixed', label: 'Placed event', source: { node: 'order', port: 'out' } },
      {
        ...custom,
        id: 'new',
        label: 'Enrichment',
        waypoints: [
          { id: 'upper', position: { x: 340, y: 20 } },
          { id: 'entry', position: { x: 420, y: 20 } },
        ],
      },
      {
        ...custom,
        id: 'recoded',
        label: 'Changed convention',
        waypoints: [
          { id: 'lower', position: { x: 340, y: 255 } },
          { id: 'entry', position: { x: 420, y: 255 } },
        ],
      },
    ],
  };
  return [
    { id: 'ddd-before', name: 'DDD review · before', snapshot: { graph: before } },
    { id: 'ddd-after', name: 'DDD review · after', snapshot: { graph: after } },
  ];
}
export function loadDddAuditExample(model: Model): Model {
  if (modelSessionBusy(model) || playbackInspectionReason(model))
    return { ...model, notice: 'Finish active edits before loading DDD examples.' };
  const merged = mergeEditions(model.editions, dddAuditExampleEditions());
  if (merged.type === 'blocked') return { ...model, notice: merged.reason };
  const edition = merged.editions.find((e) => e.id === 'ddd-after');
  if (!edition) return model;
  const surface = model.historyReview?.editor.surface ?? model.editor.surface;
  return {
    ...pauseHistoryPlayback(model),
    editions: merged.editions,
    nodeDesign: 'ddd',
    modelEpoch: model.modelEpoch + 1,
    sidebarSection: 'history',
    historyReview: updateHistoryReview(createHistoryReview(edition, { ...model.editor, surface }), {
      type: 'FitViewClicked',
    }),
    dddAudit: { ...model.dddAudit, baselineId: 'ddd-before', selectedId: 'ddd-after' },
    notice:
      'DDD audit examples loaded. Findings navigate read-only editions; working graph and Undo are preserved.',
  };
}
