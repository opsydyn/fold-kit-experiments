import type { Endpoint } from './types';

/** Minimal projection contract; creation and reconnection keep their own typed events. */
export type ZlozSearchableEndpoint = Readonly<{
  endpoint: Endpoint;
  label: string;
  current: boolean;
  /** Older/custom entries can omit this and use the node ID as their group label. */
  nodeLabel?: string;
}>;

export type ZlozEndpointSearchOptions = Readonly<{ query?: string }>;
export type ZlozEndpointSearchContext = Readonly<{ query: string; emptyReason: string | null }>;
export type ZlozEndpointChoiceGroup<T> = Readonly<{
  id: string;
  label: string;
  entries: readonly T[];
}>;
export type ZlozEndpointChoices<T> = ZlozEndpointSearchContext &
  Readonly<{
    entries: readonly T[];
    groups: readonly ZlozEndpointChoiceGroup<T>[];
    /** Matching entries only; a retained nonmatching current selection is not counted. */
    matchCount: number;
  }>;

/**
 * Presentation only: stable document order, literal case-insensitive token matching,
 * and retention of current entries. Does not evaluate or change permissions/events.
 */
export function resolveEndpointChoices<T extends ZlozSearchableEndpoint>(
  entries: readonly T[],
  options: ZlozEndpointSearchOptions = {},
): ZlozEndpointChoices<T> {
  const query = options.query ?? '';
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible: T[] = [];
  const groups = new Map<string, { id: string; label: string; entries: T[] }>();
  let matchCount = 0;
  for (const entry of entries) {
    const text =
      `${entry.label} ${entry.nodeLabel ?? ''} ${entry.endpoint.node} ${entry.endpoint.port}`.toLowerCase();
    const matches = tokens.every((token) => text.includes(token));
    if (matches) matchCount++;
    if (!matches && !entry.current) continue;
    visible.push(entry);
    const id = entry.endpoint.node;
    const group = groups.get(id);
    if (group) group.entries.push(entry);
    else groups.set(id, { id, label: entry.nodeLabel ?? id, entries: [entry] });
  }
  return {
    query,
    entries: visible,
    groups: [...groups.values()],
    matchCount,
    emptyReason:
      tokens.length > 0 && matchCount === 0
        ? visible.length > 0
          ? 'No ports match this search. Current selection is retained.'
          : 'No ports match this search.'
        : null,
  };
}
