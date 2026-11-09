import {
  checkedEventStormingRelationshipRules,
  type ZlozEventStormingRelationshipOptions,
} from './event-storming-relationships';
import { captureModelDocument, type ZlozModelDocument } from './model-document';
import {
  compareModelEventStormingRelationships,
  type ZlozRelationshipAuditComparison,
  type ZlozRelationshipAuditFinding,
  type ZlozRelationshipAuditSource,
} from './relationship-audit-comparison';
import type { EditorEvent } from './types';

export type ZlozAuditFindingKind = 'introduced' | 'resolved' | 'persisting';
export type ZlozAuditComparisonState = Readonly<{
  baselineId: string | null;
  /** Null explicitly targets the current graph, independently of the displayed history camera. */
  selectedId: string | null;
  filters: Readonly<Record<ZlozAuditFindingKind, boolean>>;
}>;
export type ZlozAuditFindingFocusRequest = Readonly<{
  type: 'FindingFocused';
  modelId: string;
  baselineId: string;
  selectedId: string | null;
  kind: ZlozAuditFindingKind;
  edgeId: string;
  code: ZlozRelationshipAuditFinding['code'];
}>;
export type ZlozAuditComparisonRequest =
  | Readonly<{ type: 'BaselineSelected'; editionId: string | null }>
  | Readonly<{ type: 'TargetSelected'; editionId: string | null }>
  | Readonly<{ type: 'FilterToggled'; kind: ZlozAuditFindingKind }>
  | ZlozAuditFindingFocusRequest;
export type ZlozAuditFindingItem = Readonly<{
  kind: ZlozAuditFindingKind;
  finding: ZlozRelationshipAuditFinding;
  previous: ZlozRelationshipAuditFinding | null;
  source: ZlozRelationshipAuditSource;
}>;
export type ZlozAuditFindingEntry = ZlozAuditFindingItem &
  Readonly<{
    label: string;
    reason: string | null;
    request: ZlozAuditFindingFocusRequest;
  }>;
export type ZlozAuditEditionControl = Readonly<{
  part: 'baseline' | 'target';
  label: string;
  value: string | null;
  noneLabel: string;
  choices: readonly Readonly<{ id: string; label: string }>[];
  reason: string | null;
}>;
export type ZlozAuditFindingFilter = Readonly<{
  kind: ZlozAuditFindingKind;
  label: string;
  checked: boolean;
  count: number;
}>;
export type ZlozAuditComparisonControlsOptions = ZlozEventStormingRelationshipOptions &
  Readonly<{
    blockedReason?: string | null;
    focusReason?: (item: ZlozAuditFindingItem) => string | null;
    labelFinding?: (item: ZlozAuditFindingItem) => string;
    labelEdition?: (edition: Readonly<{ id: string; name: string }>) => string;
    filterLabels?: Partial<Record<ZlozAuditFindingKind, string>>;
    baselineLabel?: string;
    targetLabel?: string;
    baselinePlaceholder?: string;
    currentLabel?: string;
  }>;
export type ZlozAuditComparisonControlsContext = Readonly<{
  baseline: ZlozAuditEditionControl;
  target: ZlozAuditEditionControl;
  filters: Readonly<Record<ZlozAuditFindingKind, ZlozAuditFindingFilter>>;
  entries: readonly ZlozAuditFindingEntry[];
  comparison: ZlozRelationshipAuditComparison | null;
  reason: string | null;
  statusText: string;
}>;
export type ZlozAuditComparisonDecision =
  | Readonly<{ type: 'ready'; state: ZlozAuditComparisonState }>
  | Readonly<{
      type: 'focus';
      source: ZlozRelationshipAuditSource;
      event: Extract<EditorEvent, { type: 'EdgeRevealRequested' }>;
      entry: ZlozAuditFindingEntry;
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

/** ADR-0034: Pure controls compose the existing audit; source selection never follows the displayed camera. */
export function resolveAuditComparisonControls(
  document: ZlozModelDocument,
  state: ZlozAuditComparisonState,
  options: ZlozAuditComparisonControlsOptions = {},
): ZlozAuditComparisonControlsContext {
  checkedEventStormingRelationshipRules(options);
  const model = captureModelDocument(document);
  const selection =
    state.selectedId === null
      ? { baselineId: state.baselineId ?? '' }
      : { baselineId: state.baselineId ?? '', selectedId: state.selectedId };
  const decision =
    state.baselineId === null
      ? null
      : compareModelEventStormingRelationships(model, selection, options);
  const comparison = decision?.type === 'compared' ? decision.comparison : null;
  const reason =
    denial(options.blockedReason) ??
    (decision?.type === 'blocked'
      ? decision.reason
      : state.baselineId === null
        ? 'Choose a baseline edition to compare causal findings.'
        : null);
  const choices = model.editions.map((edition) => ({
    id: edition.id,
    label: options.labelEdition?.(edition).trim() || edition.name,
  }));
  const baseline: ZlozAuditEditionControl = {
    part: 'baseline',
    value: state.baselineId,
    label: options.baselineLabel?.trim() || 'Audit baseline',
    noneLabel: options.baselinePlaceholder?.trim() || 'Choose a baseline',
    choices,
    reason:
      denial(options.blockedReason) ??
      (choices.length ? null : 'Capture an edition to choose a baseline.'),
  };
  const target: ZlozAuditEditionControl = {
    part: 'target',
    value: state.selectedId,
    label: options.targetLabel?.trim() || 'Audit target',
    noneLabel: options.currentLabel?.trim() || 'Current graph',
    choices,
    reason: denial(options.blockedReason),
  };
  function filter(kind: ZlozAuditFindingKind): ZlozAuditFindingFilter {
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
  const items: readonly ZlozAuditFindingItem[] = comparison
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
    : [];
  function entry(item: ZlozAuditFindingItem): ZlozAuditFindingEntry {
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
        baselineId: state.baselineId ?? '',
        selectedId: state.selectedId,
        kind: item.kind,
        edgeId: item.finding.edgeId,
        code: item.finding.code,
      },
    };
  }
  const entries = items.filter((item) => filters[item.kind].checked).map(entry);
  return {
    baseline,
    target,
    filters,
    entries,
    comparison,
    reason,
    statusText: !comparison
      ? 'No audit comparison selected.'
      : items.length === 0
        ? 'No blocked findings in either snapshot.'
        : entries.length === 0
          ? 'No findings match these filters.'
          : `${comparison.summary.introduced} introduced, ${comparison.summary.resolved} resolved, ${comparison.summary.persisting} persisting.`,
  };
}
/** Recheck identity, code, category, filter and current host policy before returning a navigation-only action. */
export function resolveAuditComparisonRequest(
  document: ZlozModelDocument,
  state: ZlozAuditComparisonState,
  request: ZlozAuditComparisonRequest,
  options: ZlozAuditComparisonControlsOptions = {},
): ZlozAuditComparisonDecision {
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
  const entry = resolveAuditComparisonControls(document, state, options).entries.find(
    (entry) =>
      entry.kind === request.kind &&
      entry.finding.edgeId === request.edgeId &&
      entry.finding.code === request.code,
  );
  if (!entry) return { type: 'ignored' };
  return entry.reason
    ? { type: 'blocked', reason: entry.reason }
    : {
        type: 'focus',
        entry,
        source: entry.source,
        event: { type: 'EdgeRevealRequested', id: entry.finding.edgeId },
      };
}
