import type { ZlozHistoryChange, ZlozHistoryComparison } from './history';
import type { EditorEvent, ZlozNode, ZlozEdge } from './types';

export type ZlozHistoryChangeKind = ZlozHistoryChange<ZlozNode>['kind'];
export type ZlozHistoryChangeFilters = Readonly<Record<ZlozHistoryChangeKind, boolean>>;
export type ZlozHistoryChangeItem =
  | Readonly<{ entity: 'node'; change: ZlozHistoryChange<ZlozNode> }>
  | Readonly<{ entity: 'edge'; change: ZlozHistoryChange<ZlozEdge> }>;
/** A scoped identity, never an ordinal or a captured camera position. */
export type ZlozHistoryChangeFocusRequest = Readonly<{
  baselineId: string;
  selectedId: string;
  entity: 'node' | 'edge';
  id: string;
}>;
export type ZlozHistoryChangeEntry = Readonly<{
  entity: 'node' | 'edge';
  id: string;
  kind: ZlozHistoryChangeKind;
  label: string;
  summary: string;
  semanticChanged: boolean;
  layoutChanged: boolean;
  request: ZlozHistoryChangeFocusRequest;
  reason: string | null;
}>;
export type ZlozHistoryChangeFilter = Readonly<{
  kind: ZlozHistoryChangeKind;
  label: string;
  checked: boolean;
  count: number;
}>;
export type ZlozHistoryChangeNavigatorOptions = Readonly<{
  filters?: Partial<ZlozHistoryChangeFilters>;
  blockedReason?: string | null;
  focusReason?: (item: ZlozHistoryChangeItem) => string | null;
  labelChange?: (item: ZlozHistoryChangeItem) => string;
  filterLabels?: Partial<Record<ZlozHistoryChangeKind, string>>;
}>;
export type ZlozHistoryChangeNavigatorContext = Readonly<{
  entries: readonly ZlozHistoryChangeEntry[];
  filters: Readonly<Record<ZlozHistoryChangeKind, ZlozHistoryChangeFilter>>;
  total: number;
  statusText: string;
  reason: string | null;
}>;
export type ZlozHistoryChangeFocusTarget =
  | Readonly<{
      side: 'selected';
      editionId: string;
      event: Extract<EditorEvent, { type: 'NodeRevealRequested' | 'EdgeRevealRequested' }>;
    }>
  | Readonly<{
      side: 'baseline';
      editionId: string;
      /** Earlier node or endpoint geometry, for camera fitting only. Never insert it into the editor. */
      nodes: readonly ZlozNode[];
    }>;
export type ZlozHistoryChangeFocusDecision =
  | Readonly<{ type: 'ready'; entry: ZlozHistoryChangeEntry; target: ZlozHistoryChangeFocusTarget }>
  | Readonly<{ type: 'ignored' }>
  | Readonly<{ type: 'blocked'; reason: string }>;
const names = {
  added: 'Added changes',
  removed: 'Removed changes',
  changed: 'Changed changes',
} as const;
const denial = (reason: string | null | undefined): string | null =>
  reason == null ? null : reason.trim() || 'Change navigation is unavailable.';
function items(comparison: ZlozHistoryComparison | null): readonly ZlozHistoryChangeItem[] {
  return comparison
    ? [
        ...comparison.nodes.map((change) => ({ entity: 'node' as const, change })),
        ...comparison.edges.map((change) => ({ entity: 'edge' as const, change })),
      ]
    : [];
}
/** Derive filters and accessible entries without owning selection, camera, playback or persistence. */
export function resolveHistoryChangeNavigator(
  comparison: ZlozHistoryComparison | null,
  options: ZlozHistoryChangeNavigatorOptions = {},
): ZlozHistoryChangeNavigatorContext {
  const changes = items(comparison);
  const reason =
    denial(options.blockedReason) ??
    (comparison ? null : 'Choose two editions to inspect changes.');
  const filter = (kind: ZlozHistoryChangeKind): ZlozHistoryChangeFilter => ({
    kind,
    label: options.filterLabels?.[kind]?.trim() || names[kind],
    checked: options.filters?.[kind] ?? true,
    count: changes.filter((item) => item.change.kind === kind).length,
  });
  const filters = {
    added: filter('added'),
    removed: filter('removed'),
    changed: filter('changed'),
  };
  function entry(
    item: ZlozHistoryChangeItem,
    scope: Pick<ZlozHistoryChangeFocusRequest, 'baselineId' | 'selectedId'>,
  ): ZlozHistoryChangeEntry {
    const change = item.change;
    const value = change.after ?? change.before;
    const label = options.labelChange?.(item).trim() || value.label?.trim() || change.id;
    return {
      entity: item.entity,
      id: change.id,
      kind: change.kind,
      label,
      summary: `${change.kind} ${item.entity}: ${label}`,
      semanticChanged: change.semanticChanged,
      layoutChanged: change.layoutChanged,
      request: {
        ...scope,
        entity: item.entity,
        id: change.id,
      },
      reason: denial(options.blockedReason) ?? denial(options.focusReason?.(item)),
    };
  }
  const entries = comparison
    ? changes
        .filter((item) => filters[item.change.kind].checked)
        .map((item) =>
          entry(item, { baselineId: comparison.baseline.id, selectedId: comparison.selected.id }),
        )
    : [];
  return {
    entries,
    filters,
    total: changes.length,
    reason,
    statusText: !comparison
      ? 'No comparison selected.'
      : changes.length === 0
        ? 'No changes between these editions.'
        : entries.length === 0
          ? 'No changes match these filters.'
          : `${entries.length} of ${changes.length} changes shown.`,
  };
}
/** Revalidate scope, filter membership and host policy before returning a camera-only target. */
export function resolveHistoryChangeFocus(
  comparison: ZlozHistoryComparison | null,
  request: ZlozHistoryChangeFocusRequest,
  options: ZlozHistoryChangeNavigatorOptions = {},
): ZlozHistoryChangeFocusDecision {
  if (
    !comparison ||
    request.baselineId !== comparison.baseline.id ||
    request.selectedId !== comparison.selected.id
  )
    return { type: 'ignored' };
  const entry = resolveHistoryChangeNavigator(comparison, options).entries.find(
    (item) => item.entity === request.entity && item.id === request.id,
  );
  if (!entry) return { type: 'ignored' };
  if (entry.reason) return { type: 'blocked', reason: entry.reason };
  if (entry.kind !== 'removed')
    return {
      type: 'ready',
      entry,
      target: {
        side: 'selected',
        editionId: comparison.selected.id,
        event: {
          type: entry.entity === 'node' ? 'NodeRevealRequested' : 'EdgeRevealRequested',
          id: entry.id,
        },
      },
    };
  const graph = comparison.baseline.snapshot.graph;
  const edge = graph.edges.find((item) => item.id === entry.id);
  const ids =
    entry.entity === 'node'
      ? [entry.id]
      : edge
        ? [...new Set([edge.source.node, edge.target.node])]
        : [];
  const nodes = graph.nodes.filter((node) => ids.includes(node.id));
  return nodes.length !== ids.length || nodes.length === 0
    ? { type: 'ignored' }
    : {
        type: 'ready',
        entry,
        target: { side: 'baseline', editionId: comparison.baseline.id, nodes },
      };
}
