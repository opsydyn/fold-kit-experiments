import {
  architectureNodePresets,
  previewEventStormingC4Mapping,
  serializeGraph,
  type C4NodeArchitecture,
  type ZlozEventStormingC4MappingOptions,
} from '@opsydyn/foldkit-zloz';
import { reviewReaderForScope } from '@opsydyn/foldkit-zloz-mermaid';

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
  }>;
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
    : { ...current, selectedKey: null, form: emptyForm, choices: { nodes: [], edges: [] } };
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
export function workbenchC4MappingReview(model: Model) {
  const current = scope(model),
    stored = draft(model, current),
    source = editor(model);
  const preview = previewEventStormingC4Mapping(
    {
      document: workbenchDocument({ ...model, editor: source }),
      sessionId: `${model.modelNamespace}:${model.modelEpoch}:${current.editionId || 'working'}`,
      revision: source.revision,
    },
    stored.choices,
  );
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
  const reason = model.historyReview
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
  return {
    scope: current,
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
export function updateC4MappingReview(model: Model, request: C4MappingReviewRequest): Model {
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
export function reconcileC4MappingReview(model: Model): Model {
  return model.c4MappingReview && !matches(model.c4MappingReview, scope(model))
    ? { ...model, c4MappingReview: null }
    : model;
}
