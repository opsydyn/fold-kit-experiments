import {
  architectureNodePresets,
  dddRelationshipKey,
  dddRelationshipRules,
  previewEventStormingDddMapping,
  serializeGraph,
  type DddNodeArchitecture,
  type ZlozEventStormingDddMappingOptions,
} from '@opsydyn/foldkit-zloz';

import type { Model, MappingReviewDraft } from './model';
import { modelSessionBusy } from './model-sessions';

export type MappingReviewScope = Pick<
  MappingReviewDraft,
  'modelId' | 'epoch' | 'revision' | 'sourceKey'
>;
const nodeTargets = architectureNodePresets.filter(
  (preset): preset is typeof preset & { architecture: DddNodeArchitecture } =>
    preset.architecture.family === 'ddd' && preset.kind !== 'group',
);
function source(model: Model) {
  return model.historyReview?.editor ?? model.editor;
}
function scope(model: Model): MappingReviewScope {
  const editor = source(model);
  return {
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    revision: editor.revision,
    sourceKey: serializeGraph(editor.graph),
  };
}
function matches(left: MappingReviewScope, right: MappingReviewScope) {
  return (
    left.modelId === right.modelId &&
    left.epoch === right.epoch &&
    left.revision === right.revision &&
    left.sourceKey === right.sourceKey
  );
}
function draft(model: Model, current: MappingReviewScope): MappingReviewDraft {
  return model.mappingReview && matches(model.mappingReview, current)
    ? model.mappingReview
    : { ...current, selectedKey: null, choices: [] };
}
function mappingOptions(current: MappingReviewDraft): ZlozEventStormingDddMappingOptions {
  return {
    nodes: current.choices
      .filter((choice) => choice.kind === 'node')
      .map((choice) => ({
        nodeId: choice.id,
        architecture:
          nodeTargets.find((preset) => preset.architecture.role === choice.value)?.architecture ??
          null,
      })),
    edges: current.choices
      .filter((choice) => choice.kind === 'edge')
      .map((choice) => ({
        edgeId: choice.id,
        architecture:
          dddRelationshipRules.find(
            (rule) => dddRelationshipKey(rule.architecture) === choice.value,
          )?.architecture ?? null,
      })),
  };
}
export function workbenchMappingReview(model: Model) {
  const current = scope(model),
    stored = draft(model, current),
    graph = source(model).graph;
  const preview = previewEventStormingDddMapping(graph, mappingOptions(stored));
  const items = [
    ...preview.nodes.map((decision) => ({
      kind: 'node' as const,
      id: decision.nodeId,
      key: `node:${decision.nodeId}`,
      label: graph.nodes.find((node) => node.id === decision.nodeId)?.label || decision.nodeId,
      decision,
    })),
    ...preview.edges.map((decision) => ({
      kind: 'edge' as const,
      id: decision.edgeId,
      key: `edge:${decision.edgeId}`,
      label: graph.edges.find((edge) => edge.id === decision.edgeId)?.label || decision.edgeId,
      decision,
    })),
  ];
  const selected =
    items.find((item) => item.key === stored.selectedKey) ??
    items.find((item) => item.decision.type === 'ambiguous') ??
    items[0] ??
    null;
  const choices = [
    { value: '', label: 'Use convention proposal' },
    { value: 'retain', label: 'Keep workshop meaning' },
    ...(selected?.kind === 'node'
      ? nodeTargets.map((preset) => ({ value: preset.architecture.role, label: preset.label }))
      : dddRelationshipRules.map((rule) => ({
          value: dddRelationshipKey(rule.architecture),
          label: `${rule.label} · ${rule.architecture.scope}`,
        }))),
  ];
  const reason = model.historyReview
    ? 'Return to the working model before choosing mappings. Historical proposals remain available to inspect.'
    : modelSessionBusy(model)
      ? 'Finish active edits, imports or layout before choosing mappings.'
      : null;
  return {
    scope: current,
    stored,
    preview,
    items,
    selected,
    choices,
    reason,
    value:
      stored.choices.find((choice) => choice.kind === selected?.kind && choice.id === selected?.id)
        ?.value ?? '',
  };
}
export type MappingReviewRequest = MappingReviewScope &
  (
    | Readonly<{ type: 'ItemSelected'; key: string }>
    | Readonly<{ type: 'ChoiceSelected'; key: string; value: string }>
    | Readonly<{ type: 'ResetClicked' }>
  );
export function updateMappingReview(model: Model, request: MappingReviewRequest): Model {
  if (
    model.sidebarSection !== 'mapping' ||
    model.sidebarCollapsed ||
    !matches(scope(model), request)
  )
    return model;
  const context = workbenchMappingReview(model),
    current = context.stored;
  if (request.type === 'ResetClicked') {
    if (context.reason) return model;
    return {
      ...model,
      mappingReview: { ...current, choices: [] },
      mappingReviewNotice: 'Using convention proposals. The source graph is unchanged.',
    };
  }
  const item = context.items.find((item) => item.key === request.key);
  if (!item) return model;
  if (request.type === 'ItemSelected')
    return { ...model, mappingReview: { ...current, selectedKey: item.key } };
  if (context.reason) return model;
  const allowed =
    request.value === '' ||
    request.value === 'retain' ||
    (item.kind === 'node'
      ? nodeTargets.some((preset) => preset.architecture.role === request.value)
      : dddRelationshipRules.some(
          (rule) => dddRelationshipKey(rule.architecture) === request.value,
        ));
  if (!allowed || (item.kind === 'edge' && item.decision.sourceArchitecture?.family === 'ddd'))
    return model;
  const previous = current.choices.filter(
    (choice) => !(choice.kind === item.kind && choice.id === item.id),
  );
  const choices =
    request.value === ''
      ? previous
      : [...previous, { kind: item.kind, id: item.id, value: request.value }];
  return {
    ...model,
    mappingReview: { ...current, selectedKey: item.key, choices },
    mappingReviewNotice:
      'Preview choice recorded. The source graph and Undo history are unchanged.',
  };
}
/** A changed source never revives old choices, including after Undo returns the same graph values. */
export function reconcileMappingReview(next: Model): Model {
  if (!next.mappingReview || matches(next.mappingReview, scope(next))) return next;
  return {
    ...next,
    mappingReview: null,
    mappingReviewNotice:
      'Source changed; temporary mapping choices reset. Review the current proposals.',
  };
}
