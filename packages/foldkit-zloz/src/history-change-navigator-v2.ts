import type { ZlozConnectionMode } from './connection-mode';
import type {
  ZlozHistoryChangeFilters,
  ZlozHistoryChangeFilter,
  ZlozHistoryChangeKind,
  ZlozHistoryChangeItem,
  ZlozHistoryChangeStepDirection,
} from './history-change-navigator';
import type { ZlozHistoryComparisonV2, ZlozHistoryModeChangeV2 } from './history-comparison-v2';
import type { EditorEvent } from './types';

export type ZlozHistoryComparisonSideV2 = 'baseline' | 'selected';
export type ZlozHistoryChangeItemV2 =
  | ZlozHistoryChangeItem
  | Readonly<{
      entity: 'mode';
      change: Extract<ZlozHistoryModeChangeV2, { kind: 'changed' }>;
    }>;
type Scope = Readonly<{ baselineId: string; selectedId: string }>;
/** Stable scoped identity. Mode changes never borrow an authored node/edge ID. */
export type ZlozHistoryChangeFocusRequestV2 = Readonly<
  Scope & ({ entity: 'mode' } | { entity: 'node' | 'edge'; id: string })
>;
export type ZlozHistoryChangeCursorV2 = ZlozHistoryChangeFocusRequestV2;
export type ZlozHistoryChangeEntryV2 = Readonly<
  {
    kind: ZlozHistoryChangeKind;
    label: string;
    summary: string;
    reason: string | null;
  } & (
    | {
        entity: 'mode';
        kind: 'changed';
        modeChange: Extract<ZlozHistoryModeChangeV2, { kind: 'changed' }>;
        semanticChanged: true;
        layoutChanged: false;
        request: Extract<ZlozHistoryChangeFocusRequestV2, { entity: 'mode' }>;
      }
    | {
        entity: 'node' | 'edge';
        id: string;
        semanticChanged: boolean;
        layoutChanged: boolean;
        request: Extract<ZlozHistoryChangeFocusRequestV2, { id: string }>;
      }
  )
>;
export type ZlozHistoryChangeNavigatorOptionsV2 = Readonly<{
  filters?: Partial<ZlozHistoryChangeFilters>;
  blockedReason?: string | null;
  focusReason?: (item: ZlozHistoryChangeItemV2, side: ZlozHistoryComparisonSideV2) => string | null;
  labelChange?: (item: ZlozHistoryChangeItemV2) => string;
  filterLabels?: Partial<Record<ZlozHistoryChangeKind, string>>;
}>;
export type ZlozHistoryChangeNavigatorContextV2 = Readonly<{
  side: ZlozHistoryComparisonSideV2;
  entries: readonly ZlozHistoryChangeEntryV2[];
  filters: Readonly<Record<ZlozHistoryChangeKind, ZlozHistoryChangeFilter>>;
  total: number;
  statusText: string;
  reason: string | null;
}>;
type TargetScope = Readonly<{
  side: ZlozHistoryComparisonSideV2;
  editionId: string;
  connectionMode: ZlozConnectionMode;
}>;
/** Mode targets describe a checkpoint; only graph targets can request camera reveal. */
export type ZlozHistoryChangeFocusTargetV2 = Readonly<
  TargetScope &
    (
      | { type: 'mode' }
      | {
          type: 'graph';
          event: Extract<EditorEvent, { type: 'NodeRevealRequested' | 'EdgeRevealRequested' }>;
        }
    )
>;
export type ZlozHistoryChangeFocusDecisionV2 =
  | Readonly<{
      type: 'ready';
      entry: ZlozHistoryChangeEntryV2;
      target: ZlozHistoryChangeFocusTargetV2;
    }>
  | Readonly<{ type: 'ignored' }>
  | Readonly<{ type: 'blocked'; reason: string }>;

const denial = (reason: string | null | undefined): string | null =>
  reason == null ? null : reason.trim() || 'Change navigation is unavailable.';
function sameScope(comparison: ZlozHistoryComparisonV2, request: Scope): boolean {
  return (
    request.baselineId === comparison.baseline.id && request.selectedId === comparison.selected.id
  );
}
function sameEntry(
  entry: ZlozHistoryChangeEntryV2,
  request: ZlozHistoryChangeFocusRequestV2,
): boolean {
  return (
    entry.entity === request.entity &&
    (entry.entity === 'mode' || (request.entity !== 'mode' && entry.id === request.id))
  );
}
/** Consume a validated compareEditionsV2 result. Re-resolve live filters, side membership and host reasons. */
export function resolveHistoryChangeNavigatorV2(
  comparison: ZlozHistoryComparisonV2 | null,
  side: ZlozHistoryComparisonSideV2,
  options: ZlozHistoryChangeNavigatorOptionsV2 = {},
): ZlozHistoryChangeNavigatorContextV2 {
  const items: readonly ZlozHistoryChangeItemV2[] = comparison
    ? [
        ...(comparison.modeChange.kind === 'changed'
          ? [{ entity: 'mode' as const, change: comparison.modeChange }]
          : []),
        ...comparison.nodes.map((change) => ({ entity: 'node' as const, change })),
        ...comparison.edges.map((change) => ({ entity: 'edge' as const, change })),
      ]
    : [];
  const names = {
    added: 'Added changes',
    removed: 'Removed changes',
    changed: 'Changed changes',
  } as const;
  const filter = (kind: ZlozHistoryChangeKind): ZlozHistoryChangeFilter =>
    Object.freeze({
      kind,
      label: options.filterLabels?.[kind]?.trim() || names[kind],
      checked: options.filters?.[kind] ?? true,
      count: items.filter((item) => item.change.kind === kind).length,
    });
  const filters = Object.freeze({
    added: filter('added'),
    removed: filter('removed'),
    changed: filter('changed'),
  });
  const reason =
    denial(options.blockedReason) ??
    (comparison ? null : 'Choose two editions to inspect changes.');
  function entry(
    item: ZlozHistoryChangeItemV2,
    current: ZlozHistoryComparisonV2,
  ): ZlozHistoryChangeEntryV2 {
    const scope = { baselineId: current.baseline.id, selectedId: current.selected.id };
    const graph = current[side].snapshot.graph;
    const absent =
      item.entity === 'mode'
        ? false
        : !(item.entity === 'node' ? graph.nodes : graph.edges).some(
            (value) => value.id === item.change.id,
          );
    const unavailable =
      denial(options.blockedReason) ??
      denial(options.focusReason?.(item, side)) ??
      (absent
        ? `This ${item.entity} is absent from the ${side} edition. Choose the other comparison side to view it.`
        : null);
    if (item.entity === 'mode') {
      const label = options.labelChange?.(item).trim() || 'Connection mode';
      return Object.freeze({
        entity: 'mode',
        kind: 'changed',
        label,
        summary: `${label} changed from ${item.change.before} to ${item.change.after}.`,
        modeChange: item.change,
        semanticChanged: true,
        layoutChanged: false,
        request: Object.freeze({ ...scope, entity: 'mode' }),
        reason: unavailable,
      });
    }
    const value = item.change.after ?? item.change.before;
    const label = options.labelChange?.(item).trim() || value.label?.trim() || item.change.id;
    return Object.freeze({
      entity: item.entity,
      id: item.change.id,
      kind: item.change.kind,
      label,
      summary: `${item.change.kind} ${item.entity}: ${label}`,
      semanticChanged: item.change.semanticChanged,
      layoutChanged: item.change.layoutChanged,
      request: Object.freeze({ ...scope, entity: item.entity, id: item.change.id }),
      reason: unavailable,
    });
  }
  const entries = Object.freeze(
    comparison
      ? items
          .filter((item) => filters[item.change.kind].checked)
          .map((item) => entry(item, comparison))
      : [],
  );
  return Object.freeze({
    side,
    entries,
    filters,
    total: items.length,
    reason,
    statusText: !comparison
      ? 'No comparison selected.'
      : items.length === 0
        ? 'No changes between these editions.'
        : entries.length === 0
          ? 'No changes match these filters.'
          : `${entries.length} of ${items.length} changes shown.`,
  });
}

/** Never switch sides or change mode. Mode focus has no reveal event or camera geometry. */
export function resolveHistoryChangeFocusV2(
  comparison: ZlozHistoryComparisonV2 | null,
  side: ZlozHistoryComparisonSideV2,
  request: ZlozHistoryChangeFocusRequestV2,
  options: ZlozHistoryChangeNavigatorOptionsV2 = {},
): ZlozHistoryChangeFocusDecisionV2 {
  if (!comparison || !sameScope(comparison, request)) return { type: 'ignored' };
  const entry = resolveHistoryChangeNavigatorV2(comparison, side, options).entries.find((item) =>
    sameEntry(item, request),
  );
  if (!entry) return { type: 'ignored' };
  if (entry.reason) return { type: 'blocked', reason: entry.reason };
  const edition = comparison[side];
  const scope = { side, editionId: edition.id, connectionMode: edition.snapshot.connectionMode };
  return {
    type: 'ready',
    entry,
    target:
      entry.entity === 'mode'
        ? { ...scope, type: 'mode' }
        : {
            ...scope,
            type: 'graph',
            event: {
              type: entry.entity === 'node' ? 'NodeRevealRequested' : 'EdgeRevealRequested',
              id: entry.id,
            },
          },
  };
}

/** Scoped cursor, no wrap and no skipping vetoed or absent candidates; the current side stays authoritative. */
export function resolveHistoryChangeStepV2(
  comparison: ZlozHistoryComparisonV2 | null,
  side: ZlozHistoryComparisonSideV2,
  current: ZlozHistoryChangeCursorV2 | null,
  direction: ZlozHistoryChangeStepDirection,
  options: ZlozHistoryChangeNavigatorOptionsV2 = {},
): ZlozHistoryChangeFocusDecisionV2 {
  if (!comparison || (current && !sameScope(comparison, current))) return { type: 'ignored' };
  const context = resolveHistoryChangeNavigatorV2(comparison, side, options);
  if (context.reason) return { type: 'blocked', reason: context.reason };
  const index = current ? context.entries.findIndex((entry) => sameEntry(entry, current)) : -1;
  if (current && index < 0) return { type: 'ignored' };
  if (!context.entries.length) return { type: 'blocked', reason: 'No changes available.' };
  if (!current && direction === 'previous')
    return { type: 'blocked', reason: 'Choose a change before moving backwards.' };
  const target = context.entries[index + (direction === 'next' ? 1 : -1)];
  if (!target)
    return {
      type: 'blocked',
      reason: direction === 'next' ? 'Last change reached.' : 'First change reached.',
    };
  return resolveHistoryChangeFocusV2(comparison, side, target.request, options);
}
