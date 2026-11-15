import {
  architectureNodePresets,
  applyEventStormingC4Conversion,
  createEventStormingC4ConversionPlan,
  resolveEventStormingC4ConversionConsent,
  type ZlozEventStormingC4MembershipChoice,
  type ZlozEventStormingC4Placement,
  serializeGraph,
  type C4NodeArchitecture,
  type ZlozEventStormingC4MappingOptions,
} from '@opsydyn/foldkit-zloz';
import { reviewReaderForScope } from '@opsydyn/foldkit-zloz-mermaid';

import { workbenchC4ConversionPolicy } from './editor-policy';
import type { Model } from './model';
import { modelSessionBusy, workbenchDocument } from './model-sessions';

export type C4MappingReviewScope = Readonly<{
  modelId: string;
  epoch: number;
  revision: number;
  sourceKey: string;
  editionId: string;
}>;
export type C4MappingReviewForm = Readonly<{
  role: string;
  name: string;
  scope: string;
  technology: string;
}>;
export type C4MappingReviewDraft = C4MappingReviewScope &
  Readonly<{
    selectedKey: string | null;
    form: C4MappingReviewForm;
    choices: ZlozEventStormingC4MappingOptions;
    memberships: readonly ZlozEventStormingC4MembershipChoice[];
    selectedMembershipId: string | null;
    placementForm: C4PlacementForm;
  }>;
export type C4PlacementForm = Readonly<{
  type: '' | 'root' | 'organization' | 'contained';
  parentId: string;
}>;
const emptyPlacement: C4PlacementForm = { type: '', parentId: '' };
export type C4MappingReviewRequest = C4MappingReviewScope &
  (
    | Readonly<{ type: 'ItemSelected'; key: string }>
    | Readonly<{
        type: 'FormChanged';
        key: string;
        field: keyof C4MappingReviewForm;
        value: string;
      }>
    | Readonly<{
        type: 'ActionClicked';
        key: string;
        action: 'preview' | 'retain' | 'clear' | 'reset';
      }>
  );
const emptyForm: C4MappingReviewForm = { role: '', name: '', scope: '', technology: '' };
const targets = architectureNodePresets.flatMap((preset) =>
  preset.architecture.family === 'c4'
    ? [{ label: preset.label, architecture: preset.architecture }]
    : [],
);
function editor(model: Model) {
  return model.historyReview?.editor ?? model.editor;
}
function scope(model: Model): C4MappingReviewScope {
  const source = editor(model);
  return {
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    revision: source.revision,
    sourceKey: serializeGraph(source.graph),
    editionId: model.historyReview?.editionId ?? '',
  };
}
function matches(a: C4MappingReviewScope, b: C4MappingReviewScope): boolean {
  return (
    a.modelId === b.modelId &&
    a.epoch === b.epoch &&
    a.revision === b.revision &&
    a.sourceKey === b.sourceKey &&
    a.editionId === b.editionId
  );
}
function draft(model: Model, current: C4MappingReviewScope): C4MappingReviewDraft {
  return model.c4MappingReview && matches(model.c4MappingReview, current)
    ? model.c4MappingReview
    : {
        ...current,
        selectedKey: null,
        form: emptyForm,
        choices: { nodes: [], edges: [] },
        memberships: [],
        selectedMembershipId: null,
        placementForm: emptyPlacement,
      };
}
function nodeDescriptor(form: C4MappingReviewForm): C4NodeArchitecture | undefined {
  const target = targets.find((entry) => entry.architecture.role === form.role)?.architecture;
  if (!target || !['', 'internal', 'external'].includes(form.scope)) return undefined;
  const scoped: C4NodeArchitecture =
    form.scope === 'internal' || form.scope === 'external'
      ? { ...target, scope: form.scope }
      : target;
  return (scoped.role === 'container' || scoped.role === 'component') && form.technology
    ? { ...scoped, technology: form.technology }
    : scoped;
}
type ReviewItem = Readonly<{ kind: 'node' | 'edge'; id: string; key: string; label: string }>;
function formFor(
  item: ReviewItem | null,
  choices: ZlozEventStormingC4MappingOptions,
): C4MappingReviewForm {
  if (!item) return emptyForm;
  if (item.kind === 'edge')
    return {
      ...emptyForm,
      name: choices.edges?.find((e) => e.edgeId === item.id)?.relationship?.label ?? '',
    };
  const choice = choices.nodes?.find((n) => n.nodeId === item.id),
    architecture = choice?.architecture;
  return {
    role: architecture?.role ?? '',
    name: choice && 'label' in choice ? (choice.label ?? item.label) : item.label,
    scope: architecture?.scope ?? '',
    technology: architecture && 'technology' in architecture ? (architecture.technology ?? '') : '',
  };
}
function reviewSource(model: Model) {
  const source = editor(model);
  return {
    document: workbenchDocument({ ...model, editor: source }),
    sessionId: `${model.modelNamespace}:${model.modelEpoch}:${model.historyReview?.editionId ?? 'working'}`,
    revision: source.revision,
  };
}
export function c4ReviewProtectionReason(model: Model): string | null {
  return model.historyReview
    ? 'Return to the working model before choosing C4 mappings. Historical findings remain available to inspect.'
    : model.receiptReview
      ? 'Close the receipt comparison before choosing C4 mappings.'
      : model.alchemyReview.review || model.alchemyReview.pending
        ? 'Close Domain review before choosing C4 mappings.'
        : reviewReaderForScope(model.packetReader, `${model.modelIdentity.id}/${model.modelEpoch}`)
              .review !== null
          ? 'Close the review packet preview before choosing C4 mappings.'
          : modelSessionBusy(model)
            ? 'Finish active edits, imports or layout before choosing C4 mappings.'
            : null;
}
export function workbenchC4MappingReview(model: Model) {
  const current = scope(model),
    stored = draft(model, current),
    source = editor(model);
  const conversion = resolveEventStormingC4ConversionConsent(
    reviewSource(model),
    { mappings: stored.choices, memberships: stored.memberships },
    model.c4PlanConsent,
  );
  const plan = conversion.plan,
    preview = plan.preview;
  const items = [
    ...preview.nodes.map((decision) => ({
      kind: 'node' as const,
      id: decision.nodeId,
      key: `node:${decision.nodeId}`,
      label: source.graph.nodes.find((n) => n.id === decision.nodeId)?.label ?? decision.nodeId,
      decision,
    })),
    ...preview.edges.map((decision) => ({
      kind: 'edge' as const,
      id: decision.edgeId,
      key: `edge:${decision.edgeId}`,
      label: source.graph.edges.find((e) => e.id === decision.edgeId)?.label ?? decision.edgeId,
      decision,
    })),
  ];
  const selected =
    items.find((item) => item.key === stored.selectedKey) ??
    items.find((item) => item.decision.type === 'ambiguous') ??
    items[0] ??
    null;
  const selectedNode =
    selected?.kind === 'node' ? source.graph.nodes.find((n) => n.id === selected.id) : undefined;
  const form =
    stored.selectedKey === selected?.key ? stored.form : formFor(selected, stored.choices);
  const reason = c4ReviewProtectionReason(model);
  const roles = targets.map((entry) => ({
    value: entry.architecture.role,
    label: entry.label,
    disabled:
      selectedNode?.kind === 'group' &&
      !['software-system', 'container'].includes(entry.architecture.role),
  }));
  const previewReason =
    reason ??
    (!selected
      ? 'Open a workshop model to review C4 mappings.'
      : !form.name.trim()
        ? 'Enter an explicit structural name or communication label.'
        : selected.kind === 'node' &&
            (!nodeDescriptor(form) || roles.find((role) => role.value === form.role)?.disabled)
          ? 'Choose a C4 role compatible with this node kind.'
          : null);
  const member =
    plan.memberships.find((m) => m.nodeId === stored.selectedMembershipId) ??
    plan.memberships.find((m) => m.type !== 'resolved') ??
    plan.memberships[0] ??
    null;
  const chosen = stored.memberships.find((m) => m.nodeId === member?.nodeId)?.placement;
  const initialPlacement: C4PlacementForm = {
    type: chosen?.type ?? '',
    parentId: chosen?.type === 'contained' ? chosen.parentId : '',
  };
  const placementForm =
    member?.nodeId === stored.selectedMembershipId ? stored.placementForm : initialPlacement;
  const parents = source.graph.nodes.filter((node) => node.kind === 'group');
  const placementReason =
    reason ??
    (!member
      ? 'No placement decisions are required for this plan.'
      : placementForm.type === ''
        ? 'Choose a placement explicitly.'
        : placementForm.type === 'contained' &&
            !parents.some((node) => node.id === placementForm.parentId)
          ? 'Choose an existing group; compatibility is checked by the package.'
          : null);
  const acknowledgementReason =
    reason ??
    (conversion.type === 'blocked'
      ? 'Resolve all mapping and placement blockers before acknowledging losses.'
      : conversion.type === 'unchanged'
        ? 'This plan has no conversion changes to acknowledge.'
        : null);
  const application = applyEventStormingC4Conversion(model.editor, reviewSource(model), {
    conversion: { mappings: stored.choices, memberships: stored.memberships },
    consent: model.c4PlanConsent,
    blockedReason: reason,
    policy: workbenchC4ConversionPolicy(model),
  });
  const applyReason =
    reason ??
    (model.protectC4Apply
      ? 'C4 conversion Apply is protected in this workbench.'
      : application.type === 'blocked'
        ? application.reason
        : application.type === 'unchanged'
          ? 'No conversion changes are available.'
          : null);
  return {
    scope: current,
    application,
    applyReason,
    conversion,
    plan,
    member,
    placementForm,
    parents,
    placementReason,
    acknowledgementReason,
    acknowledged: conversion.type === 'consented' && reason === null,
    stored,
    preview,
    items,
    selected,
    form,
    reason,
    previewReason,
    roles,
    sourceLabel: current.editionId
      ? `Edition · ${model.editions.find((e) => e.id === current.editionId)?.name ?? current.editionId}`
      : 'Working model',
  };
}
function withoutChoice(
  choices: ZlozEventStormingC4MappingOptions,
  kind: 'node' | 'edge',
  id: string,
): ZlozEventStormingC4MappingOptions {
  return {
    nodes: (choices.nodes ?? []).filter((n) => kind !== 'node' || n.nodeId !== id),
    edges: (choices.edges ?? []).filter((e) => kind !== 'edge' || e.edgeId !== id),
  };
}
function updateMapping(model: Model, request: C4MappingReviewRequest): Model {
  if (
    model.sidebarCollapsed ||
    model.sidebarSection !== 'c4mapping' ||
    !matches(scope(model), request)
  )
    return model;
  const context = workbenchC4MappingReview(model),
    selected = context.items.find((item) => item.key === request.key);
  if (!selected) return model;
  if (request.type === 'ItemSelected') {
    const form = formFor(selected, context.stored.choices);
    return { ...model, c4MappingReview: { ...context.stored, selectedKey: request.key, form } };
  }
  if (context.reason || context.selected?.key !== request.key) return model;
  const base = { ...context.stored, selectedKey: request.key, form: context.form };
  if (request.type === 'FormChanged') {
    if (!['role', 'name', 'scope', 'technology'].includes(request.field)) return model;
    if (selected.kind === 'edge' && request.field !== 'name') return model;
    if (request.field === 'technology' && !['container', 'component'].includes(context.form.role))
      return model;
    if (
      request.field === 'role' &&
      !context.roles.some((role) => role.value === request.value && !role.disabled) &&
      request.value !== ''
    )
      return model;
    if (request.field === 'scope' && !['', 'internal', 'external'].includes(request.value))
      return model;
    return {
      ...model,
      c4MappingReview: {
        ...base,
        form: { ...base.form, [request.field]: request.value },
        choices: withoutChoice(base.choices, selected.kind, selected.id),
      },
    };
  }
  if (request.action === 'reset')
    return {
      ...model,
      c4MappingReview: {
        ...base,
        form: { ...emptyForm, name: selected.kind === 'node' ? selected.label : '' },
        choices: { nodes: [], edges: [] },
        memberships: [],
        selectedMembershipId: null,
        placementForm: emptyPlacement,
      },
    };
  const remaining = withoutChoice(base.choices, selected.kind, selected.id);
  if (request.action === 'clear')
    return {
      ...model,
      c4MappingReview: {
        ...base,
        choices: remaining,
        form: { ...emptyForm, name: selected.kind === 'node' ? selected.label : '' },
      },
    };
  if (
    request.action !== 'retain' &&
    (request.action !== 'preview' || context.previewReason !== null)
  )
    return model;
  let choices: ZlozEventStormingC4MappingOptions;
  if (selected.kind === 'node') {
    const architecture = request.action === 'retain' ? null : nodeDescriptor(base.form);
    if (architecture === undefined) return model;
    const choice =
      architecture === null
        ? { nodeId: selected.id, architecture: null }
        : { nodeId: selected.id, architecture, label: base.form.name };
    choices = { ...remaining, nodes: [...(remaining.nodes ?? []), choice] };
  } else
    choices = {
      ...remaining,
      edges: [
        ...(remaining.edges ?? []),
        {
          edgeId: selected.id,
          relationship: request.action === 'retain' ? null : { label: base.form.name },
        },
      ],
    };
  return {
    ...model,
    c4MappingReview: {
      ...base,
      choices,
      form:
        request.action === 'retain'
          ? { ...emptyForm, name: selected.kind === 'node' ? selected.label : '' }
          : base.form,
    },
  };
}
function publish(model: Model, next: C4MappingReviewDraft): Model {
  const probe = createEventStormingC4ConversionPlan(reviewSource(model), {
    mappings: next.choices,
  });
  const ids = new Set(probe.memberships.map((member) => member.nodeId));
  const memberships = next.memberships.filter((member) => ids.has(member.nodeId));
  const selectedMembershipId =
    next.selectedMembershipId && ids.has(next.selectedMembershipId)
      ? next.selectedMembershipId
      : null;
  return {
    ...model,
    c4MappingReview: {
      ...next,
      memberships,
      selectedMembershipId,
      placementForm: selectedMembershipId ? next.placementForm : emptyPlacement,
    },
    c4PlanConsent: null,
    c4PlanRun: model.c4PlanRun + 1,
  };
}
export function updateC4MappingReview(model: Model, request: C4MappingReviewRequest): Model {
  const next = updateMapping(model, request);
  return next === model || request.type === 'ItemSelected' || !next.c4MappingReview
    ? next
    : publish(next, next.c4MappingReview);
}
export type C4PlacementRequest = C4MappingReviewScope &
  (
    | Readonly<{ type: 'MemberSelected'; nodeId: string }>
    | Readonly<{ type: 'FormChanged'; nodeId: string; field: 'type' | 'parentId'; value: string }>
    | Readonly<{ type: 'Reviewed' | 'Cleared'; nodeId: string }>
  );
export function updateC4Placement(model: Model, request: C4PlacementRequest): Model {
  if (
    model.sidebarCollapsed ||
    model.sidebarSection !== 'c4mapping' ||
    !matches(scope(model), request)
  )
    return model;
  const context = workbenchC4MappingReview(model),
    member = context.plan.memberships.find((m) => m.nodeId === request.nodeId);
  if (!member) return model;
  if (request.type === 'MemberSelected') {
    const placement = context.stored.memberships.find(
      (m) => m.nodeId === request.nodeId,
    )?.placement;
    return {
      ...model,
      c4MappingReview: {
        ...context.stored,
        selectedMembershipId: request.nodeId,
        placementForm: {
          type: placement?.type ?? '',
          parentId: placement?.type === 'contained' ? placement.parentId : '',
        },
      },
    };
  }
  if (context.reason || context.member?.nodeId !== request.nodeId) return model;
  const remaining = context.stored.memberships.filter((m) => m.nodeId !== request.nodeId);
  const base = {
    ...context.stored,
    selectedMembershipId: request.nodeId,
    placementForm: context.placementForm,
    memberships: remaining,
  };
  if (request.type === 'FormChanged') {
    if (request.field === 'type') {
      if (
        request.value !== '' &&
        request.value !== 'root' &&
        request.value !== 'organization' &&
        request.value !== 'contained'
      )
        return model;
      return publish(model, { ...base, placementForm: { type: request.value, parentId: '' } });
    }
    if (
      request.field !== 'parentId' ||
      context.placementForm.type !== 'contained' ||
      (request.value !== '' && !context.parents.some((node) => node.id === request.value))
    )
      return model;
    return publish(model, {
      ...base,
      placementForm: { ...base.placementForm, parentId: request.value },
    });
  }
  if (request.type === 'Cleared') return publish(model, { ...base, placementForm: emptyPlacement });
  if (context.placementReason !== null) return model;
  let placement: ZlozEventStormingC4Placement;
  switch (context.placementForm.type) {
    case 'root':
      placement = { type: 'root' };
      break;
    case 'organization':
      placement = { type: 'organization' };
      break;
    case 'contained':
      placement = { type: 'contained', parentId: context.placementForm.parentId };
      break;
    default:
      return model;
  }
  return publish(model, {
    ...base,
    memberships: [...remaining, { nodeId: request.nodeId, placement }],
  });
}
export function updateC4PlanAcknowledgement(
  model: Model,
  request: C4MappingReviewScope &
    Readonly<{ planKey: string; generation: number; accepted: boolean }>,
): Model {
  if (
    model.sidebarCollapsed ||
    model.sidebarSection !== 'c4mapping' ||
    !matches(scope(model), request) ||
    request.generation !== model.c4PlanRun
  )
    return model;
  const context = workbenchC4MappingReview(model);
  if (context.acknowledgementReason || context.plan.key !== request.planKey) return model;
  return {
    ...model,
    c4PlanConsent: request.accepted ? { planKey: context.plan.key, accepted: true } : null,
    c4PlanRun: request.accepted ? model.c4PlanRun : model.c4PlanRun + 1,
  };
}
export function reconcileC4MappingReview(previous: Model, model: Model): Model {
  const invalid = model.c4MappingReview !== null && !matches(model.c4MappingReview, scope(model));
  const next = invalid ? { ...model, c4MappingReview: null } : model;
  const beforeSource = editor(previous),
    afterSource = editor(next);
  const sourceChanged =
    previous.modelNamespace !== next.modelNamespace ||
    previous.modelEpoch !== next.modelEpoch ||
    previous.modelIdentity !== next.modelIdentity ||
    previous.editions !== next.editions ||
    previous.historyReview?.editionId !== next.historyReview?.editionId ||
    beforeSource.graph !== afterSource.graph ||
    beforeSource.viewport !== afterSource.viewport ||
    beforeSource.revision !== afterSource.revision;
  const choicesChanged =
    previous.c4MappingReview?.choices !== next.c4MappingReview?.choices ||
    previous.c4MappingReview?.memberships !== next.c4MappingReview?.memberships;
  const protectionChanged =
    c4ReviewProtectionReason(previous) !== c4ReviewProtectionReason(next) ||
    previous.protectC4Apply !== next.protectC4Apply ||
    previous.protectWorkshopMeaning !== next.protectWorkshopMeaning ||
    previous.protectDddRelationships !== next.protectDddRelationships ||
    previous.semanticRelationships !== next.semanticRelationships ||
    previous.customStormingRelationships !== next.customStormingRelationships ||
    previous.workshopConventions !== next.workshopConventions ||
    previous.editor.readOnly !== next.editor.readOnly ||
    previous.editor.historyLimit !== next.editor.historyLimit ||
    previous.editor.connection !== next.editor.connection ||
    previous.editor.fitViewTransition !== next.editor.fitViewTransition;
  const visibilityChanged =
    (previous.sidebarSection === 'c4mapping' && !previous.sidebarCollapsed) !==
    (next.sidebarSection === 'c4mapping' && !next.sidebarCollapsed);
  const staleConsent =
    next.c4PlanConsent !== null && workbenchC4MappingReview(next).conversion.type !== 'consented';
  if (
    !invalid &&
    !sourceChanged &&
    !choicesChanged &&
    !protectionChanged &&
    !visibilityChanged &&
    !staleConsent
  )
    return next;
  return {
    ...next,
    c4PlanConsent:
      invalid || sourceChanged || choicesChanged || protectionChanged || staleConsent
        ? null
        : next.c4PlanConsent,
    c4PlanRun: previous.c4PlanRun === next.c4PlanRun ? next.c4PlanRun + 1 : next.c4PlanRun,
  };
}

/** The package result and record are published in the same synchronous host update. */
export function applyWorkbenchC4Conversion(
  model: Model,
  request: C4MappingReviewScope & Readonly<{ planKey: string; generation: number }>,
): Model {
  if (
    model.sidebarCollapsed ||
    model.sidebarSection !== 'c4mapping' ||
    !matches(scope(model), request) ||
    request.generation !== model.c4PlanRun
  )
    return model;
  const context = workbenchC4MappingReview(model);
  if (context.plan.key !== request.planKey) return model;
  const result = context.application;
  if (context.applyReason !== null || result.type !== 'applied')
    return {
      ...model,
      c4ApplyNotice: context.applyReason ?? 'No conversion changes are available.',
    };
  return {
    ...model,
    editor: result.editor,
    c4Conversions: [...model.c4Conversions, result.conversion],
    c4MappingReview: null,
    c4PlanConsent: null,
    c4PlanRun: model.c4PlanRun + 1,
    c4ApplyNotice:
      'C4 conversion applied. One Undo restores the source; provenance retained in this tab.',
    notice: 'C4 conversion applied. One Undo restores the source; provenance retained.',
  };
}
