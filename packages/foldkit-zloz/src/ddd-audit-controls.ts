import {
  compareModelDddRelationships,
  type ZlozDddRelationshipAuditComparison,
  type ZlozDddRelationshipAuditFinding,
  type ZlozDddRelationshipAuditSource,
} from './ddd-audit-comparison';
import { auditDddRelationships, type ZlozDddRelationshipAudit } from './ddd-relationship-audit';
import { checkedDddRelationshipRules, type ZlozDddRelationshipOptions } from './ddd-relationships';
import { captureModelDocument, type ZlozModelDocument } from './model-document';
import type { EditorEvent } from './types';

export type ZlozDddAuditFindingKind = 'introduced' | 'resolved' | 'persisting';
export type ZlozDddAuditState = Readonly<{
  baselineId: string | null;
  /** Null explicitly targets the current graph, independently of the displayed history camera. */
  selectedId: string | null;
  filters: Readonly<Record<ZlozDddAuditFindingKind, boolean>>;
}>;
export type ZlozDddAuditFindingFocusRequest = Readonly<{
  type: 'FindingFocused';
  modelId: string;
  baselineId: string | null;
  selectedId: string | null;
  kind: ZlozDddAuditFindingKind | 'current';
  subject: 'edge' | 'source' | 'target';
  /** Exact detached finding data; live changes invalidate this navigation request. */
  token: string;
  edgeId: string;
  code: ZlozDddRelationshipAuditFinding['code'];
}>;
export type ZlozDddAuditRequest =
  | Readonly<{ type: 'BaselineSelected'; editionId: string | null }>
  | Readonly<{ type: 'TargetSelected'; editionId: string | null }>
  | Readonly<{ type: 'FilterToggled'; kind: ZlozDddAuditFindingKind }>
  | ZlozDddAuditFindingFocusRequest;
export type ZlozDddAuditFindingItem = Readonly<{
  kind: ZlozDddAuditFindingKind | 'current';
  finding: ZlozDddRelationshipAuditFinding;
  previous: ZlozDddRelationshipAuditFinding | null;
  source: ZlozDddRelationshipAuditSource;
}>;
export type ZlozDddAuditFindingEntry = ZlozDddAuditFindingItem &
  Readonly<{
    label: string;
    reason: string | null;
    request: ZlozDddAuditFindingFocusRequest;
  }>;
export type ZlozDddAuditEditionControl = Readonly<{
  part: 'baseline' | 'target';
  label: string;
  value: string | null;
  noneLabel: string;
  choices: readonly Readonly<{ id: string; label: string }>[];
  reason: string | null;
}>;
export type ZlozDddAuditFindingFilter = Readonly<{
  kind: ZlozDddAuditFindingKind;
  label: string;
  checked: boolean;
  count: number;
}>;
export type ZlozDddAuditControlsOptions = ZlozDddRelationshipOptions &
  Readonly<{
    blockedReason?: string | null;
    focusReason?: (item: ZlozDddAuditFindingItem) => string | null;
    labelFinding?: (item: ZlozDddAuditFindingItem) => string;
    labelEdition?: (edition: Readonly<{ id: string; name: string }>) => string;
    filterLabels?: Partial<Record<ZlozDddAuditFindingKind, string>>;
    baselineLabel?: string;
    targetLabel?: string;
    baselinePlaceholder?: string;
    currentLabel?: string;
  }>;
export type ZlozDddAuditControlsContext = Readonly<{
  baseline: ZlozDddAuditEditionControl;
  target: ZlozDddAuditEditionControl;
  filters: Readonly<Record<ZlozDddAuditFindingKind, ZlozDddAuditFindingFilter>>;
  entries: readonly ZlozDddAuditFindingEntry[];
  audit: ZlozDddRelationshipAudit | null;
  comparison: ZlozDddRelationshipAuditComparison | null;
  reason: string | null;
  statusText: string;
}>;
export type ZlozDddAuditDecision =
  | Readonly<{ type: 'ready'; state: ZlozDddAuditState }>
  | Readonly<{
      type: 'focus';
      source: ZlozDddRelationshipAuditSource;
      event: Extract<EditorEvent, { type: 'EdgeRevealRequested' | 'NodeRevealRequested' }>;
      entry: ZlozDddAuditFindingEntry;
    }>
  | Readonly<{ type: 'blocked'; reason: string }>
  | Readonly<{ type: 'ignored' }>;
const names = {
  introduced: 'Introduced findings',
  resolved: 'Resolved findings',
  persisting: 'Persisting findings',
} as const;
const denial = (reason: string | null | undefined): string | null =>
  reason == null ? null : reason.trim() || 'Audit comparison is unavailable.';

/** ADR 0080: Pure controls compose the existing audit; source selection never follows the displayed camera. */
export function resolveDddAuditControls(
  document: ZlozModelDocument,
  state: ZlozDddAuditState,
  options: ZlozDddAuditControlsOptions = {},
): ZlozDddAuditControlsContext {
  checkedDddRelationshipRules(options);
  const model = captureModelDocument(document);
  const selection =
    state.selectedId === null
      ? { baselineId: state.baselineId ?? '' }
      : { baselineId: state.baselineId ?? '', selectedId: state.selectedId };
  const decision =
    state.baselineId === null ? null : compareModelDddRelationships(model, selection, options);
  const comparison = decision?.type === 'compared' ? decision.comparison : null;
  const selectedEdition =
    state.selectedId === null ? null : model.editions.find((e) => e.id === state.selectedId);
  const missingTarget = state.selectedId !== null && !selectedEdition;
  const audit =
    comparison?.selected.audit ??
    (state.baselineId === null && !missingTarget
      ? auditDddRelationships((selectedEdition?.snapshot ?? model.snapshot).graph, options)
      : null);
  const source: ZlozDddRelationshipAuditSource = selectedEdition
    ? { kind: 'edition', id: selectedEdition.id, name: selectedEdition.name }
    : { kind: 'current' };
  const reason =
    denial(options.blockedReason) ??
    (missingTarget
      ? 'The selected edition is unavailable in this model.'
      : decision?.type === 'blocked'
        ? decision.reason
        : null);
  const choices = model.editions.map((edition) => ({
    id: edition.id,
    label: options.labelEdition?.(edition).trim() || edition.name,
  }));
  const baseline: ZlozDddAuditEditionControl = {
    part: 'baseline',
    value: state.baselineId,
    label: options.baselineLabel?.trim() || 'DDD baseline',
    noneLabel: options.baselinePlaceholder?.trim() || 'Single-target review',
    choices,
    reason: denial(options.blockedReason),
  };
  const target: ZlozDddAuditEditionControl = {
    part: 'target',
    value: state.selectedId,
    label: options.targetLabel?.trim() || 'DDD target',
    noneLabel: options.currentLabel?.trim() || 'Current graph',
    choices,
    reason: denial(options.blockedReason),
  };
  function filter(kind: ZlozDddAuditFindingKind): ZlozDddAuditFindingFilter {
    return {
      kind,
      label: options.filterLabels?.[kind]?.trim() || names[kind],
      checked: state.filters[kind],
      count: comparison?.summary[kind] ?? 0,
    };
  }
  const filters = {
    introduced: filter('introduced'),
    resolved: filter('resolved'),
    persisting: filter('persisting'),
  };
  const items: readonly ZlozDddAuditFindingItem[] = comparison
    ? [
        ...comparison.introduced.map((finding) => ({
          kind: 'introduced' as const,
          finding,
          previous: null,
          source: comparison.selected.source,
        })),
        ...comparison.resolved.map((finding) => ({
          kind: 'resolved' as const,
          finding,
          previous: null,
          source: comparison.baseline.source,
        })),
        ...comparison.persisting.map(({ before, after }) => ({
          kind: 'persisting' as const,
          finding: after,
          previous: before,
          source: comparison.selected.source,
        })),
      ]
    : (audit?.entries
        .filter(
          (finding): finding is ZlozDddRelationshipAuditFinding => finding.status === 'blocked',
        )
        .map((finding) => ({ kind: 'current' as const, finding, previous: null, source })) ?? []);
  function entry(item: ZlozDddAuditFindingItem): ZlozDddAuditFindingEntry {
    return {
      ...item,
      label:
        options.labelFinding?.(item).trim() ||
        item.finding.edgeLabel?.trim() ||
        item.finding.edgeId,
      reason: reason ?? denial(options.focusReason?.(item)),
      request: {
        type: 'FindingFocused',
        modelId: model.id,
        baselineId: state.baselineId,
        selectedId: state.selectedId,
        kind: item.kind,
        subject: 'edge',
        token: JSON.stringify([item.source, item.finding, item.previous]),
        edgeId: item.finding.edgeId,
        code: item.finding.code,
      },
    };
  }
  const entries = items
    .filter((item) => item.kind === 'current' || filters[item.kind].checked)
    .map(entry);
  return {
    baseline,
    target,
    filters,
    entries,
    audit,
    comparison,
    reason,
    statusText: !comparison
      ? audit
        ? `${audit.summary.blocked} blocked DDD findings; ${audit.summary.typed} typed, ${audit.summary.unrelated} unrelated.`
        : 'DDD audit unavailable.'
      : items.length === 0
        ? 'No blocked findings in either snapshot.'
        : entries.length === 0
          ? 'No findings match these filters.'
          : `${comparison.summary.introduced} introduced, ${comparison.summary.resolved} resolved, ${comparison.summary.persisting} persisting.`,
  };
}
/** Recheck identity, code, category, filter and current host policy before returning a navigation-only action. */
export function resolveDddAuditRequest(
  document: ZlozModelDocument,
  state: ZlozDddAuditState,
  request: ZlozDddAuditRequest,
  options: ZlozDddAuditControlsOptions = {},
): ZlozDddAuditDecision {
  if (request.type === 'FilterToggled')
    return {
      type: 'ready',
      state: {
        ...state,
        filters: { ...state.filters, [request.kind]: !state.filters[request.kind] },
      },
    };
  if (request.type === 'BaselineSelected' || request.type === 'TargetSelected') {
    if (
      request.editionId !== null &&
      !document.editions.some((edition) => edition.id === request.editionId)
    )
      return { type: 'ignored' };
    const reason = denial(options.blockedReason);
    if (reason) return { type: 'blocked', reason };
    const key = request.type === 'BaselineSelected' ? 'baselineId' : 'selectedId';
    return state[key] === request.editionId
      ? { type: 'ignored' }
      : { type: 'ready', state: { ...state, [key]: request.editionId } };
  }
  if (
    request.modelId !== document.id ||
    request.baselineId !== state.baselineId ||
    request.selectedId !== state.selectedId
  )
    return { type: 'ignored' };
  const entry = resolveDddAuditControls(document, state, options).entries.find(
    (entry) =>
      entry.kind === request.kind &&
      entry.finding.edgeId === request.edgeId &&
      entry.finding.code === request.code &&
      entry.request.token === request.token,
  );
  if (!entry) return { type: 'ignored' };
  return entry.reason
    ? { type: 'blocked', reason: entry.reason }
    : {
        type: 'focus',
        entry,
        source: entry.source,
        event:
          request.subject === 'edge'
            ? { type: 'EdgeRevealRequested', id: entry.finding.edgeId }
            : { type: 'NodeRevealRequested', id: entry.finding[request.subject].node },
      };
}
