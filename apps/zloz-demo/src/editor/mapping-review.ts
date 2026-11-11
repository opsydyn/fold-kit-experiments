import {
  architectureNodePresets,
  applyEventStormingDddConversion,
  serializeEventStormingDddConversion,
  dddRelationshipKey,
  dddRelationshipRules,
  resolveEventStormingDddConversionConsent,
  serializeGraph,
  type DddNodeArchitecture,
  type ZlozEventStormingDddMappingOptions,
} from '@opsydyn/foldkit-zloz';
import type { Return } from 'foldkit/update';

import { DownloadConversionReceipt } from './command';
import { workbenchConversionPolicy } from './editor-policy';
import type { Message } from './message';
import type { Model, MappingReviewDraft } from './model';
import { modelSessionBusy, workbenchDocument } from './model-sessions';

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
  const conversion = resolveEventStormingDddConversionConsent(
    {
      document: workbenchDocument({ ...model, editor: source(model) }),
      sessionId: `${model.modelNamespace}:${model.modelEpoch}:${model.historyReview?.editionId ?? 'working'}`,
      revision: current.revision,
    },
    mappingOptions(stored),
    model.mappingLossConsent,
  );
  const preview = conversion.plan.preview;
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
  const application =
    conversion.type === 'consented' && reason === null
      ? applyEventStormingDddConversion(model.editor, conversion.plan.provenance, {
          mappings: conversion.plan.mappings,
          consent: model.mappingLossConsent,
          policy: workbenchConversionPolicy(model),
          blockedReason: reason,
        })
      : null;
  const applyReason =
    reason ??
    (conversion.type === 'blocked'
      ? 'Resolve every uncertain mapping before Apply.'
      : conversion.type === 'unchanged'
        ? 'This plan has no semantic replacements.'
        : conversion.type !== 'consented'
          ? 'Acknowledge all listed losses for this exact plan before Apply.'
          : application?.type === 'blocked'
            ? application.reason
            : null);
  return {
    conversion,
    application,
    applyReason,
    receipts: model.mappingReceipts.filter(
      (receipt) => receipt.conversion.source.document.id === model.modelIdentity.id,
    ),
    sourceLabel: model.historyReview
      ? `Edition · ${model.editions.find((edition) => edition.id === model.historyReview?.editionId)?.name ?? model.historyReview.editionId}`
      : 'Working model',
    acknowledged: reason === null && conversion.type === 'consented',
    acknowledgementReason:
      reason ??
      (conversion.type === 'blocked'
        ? 'Resolve or explicitly retain every uncertain mapping and incompatible relationship before acknowledging losses.'
        : conversion.type === 'unchanged'
          ? 'This plan has no semantic replacements; loss acknowledgement is unnecessary.'
          : null),
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
      mappingLossConsent: null,
      mappingConsentRun: model.mappingConsentRun + 1,
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
    mappingLossConsent: null,
    mappingConsentRun: model.mappingConsentRun + 1,
    mappingReviewNotice:
      'Preview choice recorded. The source graph and Undo history are unchanged.',
  };
}
export function updateMappingLossAcknowledgement(
  model: Model,
  request: MappingReviewScope &
    Readonly<{ planKey: string; generation: number; accepted: boolean }>,
): Model {
  if (
    model.sidebarSection !== 'mapping' ||
    model.sidebarCollapsed ||
    request.generation !== model.mappingConsentRun ||
    !matches(scope(model), request)
  )
    return model;
  const context = workbenchMappingReview(model);
  if (context.acknowledgementReason !== null || context.conversion.plan.key !== request.planKey)
    return model;
  return {
    ...model,
    mappingLossConsent: request.accepted ? { planKey: request.planKey, accepted: true } : null,
    mappingConsentRun: request.accepted ? model.mappingConsentRun : model.mappingConsentRun + 1,
    mappingReviewNotice: request.accepted
      ? 'Losses acknowledged for this exact plan. The source model is unchanged.'
      : 'Loss acknowledgement cleared. The source model is unchanged.',
  };
}
export function applyWorkbenchMapping(
  model: Model,
  request: MappingReviewScope & Readonly<{ planKey: string; generation: number }>,
): Model {
  if (
    model.sidebarSection !== 'mapping' ||
    model.sidebarCollapsed ||
    request.generation !== model.mappingConsentRun ||
    !matches(scope(model), request)
  )
    return model;
  const context = workbenchMappingReview(model);
  if (context.conversion.plan.key !== request.planKey) return model;
  const result = context.application;
  if (context.applyReason !== null || result?.type !== 'applied')
    return {
      ...model,
      mappingReviewNotice: context.applyReason ?? 'No conversion changes are available.',
    };
  const sequence = model.mappingReceiptSequence + 1;
  return {
    ...model,
    editor: result.editor,
    mappingReceipts: [
      ...model.mappingReceipts,
      {
        id: `conversion:${model.modelNamespace}:${sequence}`,
        sequence,
        conversion: result.conversion,
      },
    ],
    mappingReceiptSequence: sequence,
    notice: 'DDD conversion applied. One Undo restores the source; receipt retained.',
    mappingReview: null,
    mappingLossConsent: null,
    mappingConsentRun: model.mappingConsentRun + 1,
    mappingReviewNotice:
      'Conversion applied as one Undo step. Provenance receipt retained in this tab.',
  };
}
export function downloadWorkbenchConversion(
  model: Model,
  input: Readonly<{ modelId: string; epoch: number; receiptId: string }>,
): Return<Model, Message> {
  if (
    model.sidebarSection !== 'mapping' ||
    model.sidebarCollapsed ||
    input.modelId !== model.modelIdentity.id ||
    input.epoch !== model.modelEpoch
  )
    return { model };
  const receipt = model.mappingReceipts.find(
    (receipt) =>
      receipt.id === input.receiptId && receipt.conversion.source.document.id === input.modelId,
  );
  if (!receipt) return { model };
  return {
    model,
    commands: [
      DownloadConversionReceipt({
        ...input,
        sequence: receipt.sequence,
        json: serializeEventStormingDddConversion(receipt.conversion),
      }),
    ],
  };
}
export function conversionDownloadFeedback(
  model: Model,
  input: Readonly<{ modelId: string; epoch: number; receiptId: string }>,
  succeeded: boolean,
): Model {
  if (
    input.modelId !== model.modelIdentity.id ||
    input.epoch !== model.modelEpoch ||
    !model.mappingReceipts.some(
      (receipt) =>
        receipt.id === input.receiptId && receipt.conversion.source.document.id === input.modelId,
    )
  )
    return model;
  return {
    ...model,
    notice: succeeded
      ? 'Receipt download started; provenance remains retained in this tab.'
      : 'Receipt download failed; provenance is still retained. Try again.',
    mappingReviewNotice: succeeded
      ? 'Receipt download started. Provenance remains retained in this tab.'
      : 'Receipt download failed; provenance is still retained in this tab. Try downloading again.',
  };
}
/** Source/provenance changes never revive old choices or old checkbox callbacks after a revert. */
export function reconcileMappingReview(previous: Model, next: Model): Model {
  const before = source(previous),
    after = source(next);
  const sourceChanged =
    previous.modelEpoch !== next.modelEpoch ||
    previous.modelIdentity !== next.modelIdentity ||
    previous.editions !== next.editions ||
    before.graph !== after.graph ||
    before.viewport !== after.viewport ||
    before.revision !== after.revision ||
    previous.historyReview?.editionId !== next.historyReview?.editionId;
  const protectionChanged = modelSessionBusy(previous) !== modelSessionBusy(next);
  const invalidDraft = next.mappingReview !== null && !matches(next.mappingReview, scope(next));
  const invalidConsent =
    next.mappingLossConsent !== null &&
    (sourceChanged ||
      next.historyReview !== null ||
      modelSessionBusy(next) ||
      workbenchMappingReview(next).conversion.type !== 'consented');
  if (!invalidDraft && !sourceChanged && !protectionChanged && !invalidConsent) return next;
  return {
    ...next,
    mappingReview: invalidDraft ? null : next.mappingReview,
    mappingLossConsent:
      invalidConsent || sourceChanged || protectionChanged ? null : next.mappingLossConsent,
    mappingConsentRun: Math.max(previous.mappingConsentRun, next.mappingConsentRun) + 1,
    mappingReviewNotice: invalidDraft
      ? 'Source changed; temporary mapping choices and loss acknowledgement reset. Review the current proposals.'
      : previous.mappingLossConsent !== null &&
          next.mappingReviewNotice === previous.mappingReviewNotice
        ? 'Plan changed or became unavailable; loss acknowledgement cleared. Review the current plan.'
        : next.mappingReviewNotice,
  };
}
