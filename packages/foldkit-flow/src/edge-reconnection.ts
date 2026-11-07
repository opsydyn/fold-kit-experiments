import { connectionValidation } from './connection-validation';
import { presentEditorGroups } from './group-presentation';
import type { EdgeEnd, EditorEvent, EditorPolicy, EditorState, Endpoint, FlowEdge } from './types';

/** A stable endpoint identity and the freshly evaluated reason it cannot be chosen. */
export type FlowEdgeEndpointChoice = Readonly<{
  value: string;
  endpoint: Endpoint;
  label: string;
  /** Node label for native grouping; optional for custom/older constructed entries. */
  nodeLabel?: string;
  current: boolean;
  hidden: boolean;
  reason: string | null;
  event: Extract<EditorEvent, { type: 'EdgeReconnected' }>;
}>;

/** Pure, model-derived context shared by native and host-authored endpoint choosers. */
export type FlowEdgeReconnectionContext = Readonly<{
  edge: FlowEdge;
  end: EdgeEnd;
  label: string;
  value: string;
  /** Null enables the control; a non-null reason must remain available to users. */
  reason: string | null;
  /** Informational, not a disabled state: keeping the current choice focusable preserves focus. */
  emptyReason: string | null;
  entries: readonly FlowEdgeEndpointChoice[];
}>;

export type FlowEdgeReconnectionOptions = Readonly<{
  /** Visible alternatives by default. The current endpoint is always retained. */
  scope?: 'visible' | 'all';
}>;

const endpointValue = ({ node, port }: Endpoint) => JSON.stringify([node, port]);

/**
 * ADR 0004: policy belongs to the pure core; native controls consume this context.
 * Recompute on every view and pass the same policy to updateEditor. Events are
 * proposals, not permission grants: the reducer validates the current graph again.
 */
export function resolveEdgeReconnection(
  state: EditorState,
  id: string,
  end: EdgeEnd,
  policy: EditorPolicy = {},
  options: FlowEdgeReconnectionOptions = {},
): FlowEdgeReconnectionContext | null {
  const edge = state.graph.edges.find((edge) => edge.id === id);
  if (!edge) return null;
  const validation = connectionValidation(state.graph, policy, { id, end });
  const value = endpointValue(edge[end]);
  const visible = new Set(presentEditorGroups(state).nodes.map(({ id }) => id));
  const guard = state.readOnly
    ? 'This diagram is read-only.'
    : state.gesture.type !== 'idle'
      ? 'Finish the current gesture before reconnecting.'
      : (policy.canReconnect?.(edge, end, state.graph) ?? null);
  const entries: FlowEdgeEndpointChoice[] = [];
  for (const node of state.graph.nodes) {
    for (const port of node.ports) {
      const endpoint = { node: node.id, port: port.id };
      const candidateValue = endpointValue(endpoint);
      const current = candidateValue === value;
      const hidden = !visible.has(node.id);
      if (
        !current &&
        (port.kind !== (end === 'source' ? 'output' : 'input') ||
          (hidden && options.scope !== 'all'))
      )
        continue;
      entries.push({
        value: candidateValue,
        endpoint,
        current,
        hidden,
        nodeLabel: node.label,
        label: `${node.label}: ${port.label ?? port.id}`,
        reason: guard ?? (current ? null : validation.reason({ ...edge, [end]: endpoint })),
        event: { type: 'EdgeReconnected', id, end, endpoint },
      });
    }
  }
  // Retain an intelligible selection even if a host renders a stale/invalid graph.
  if (!entries.some(({ current }) => current)) {
    entries.unshift({
      value,
      endpoint: edge[end],
      nodeLabel: edge[end].node,
      label: `${edge[end].node}: ${edge[end].port} (unavailable)`,
      current: true,
      hidden: true,
      reason: 'Current port is no longer available.',
      event: { type: 'EdgeReconnected', id, end, endpoint: edge[end] },
    });
  }
  return {
    edge,
    end,
    label: end === 'source' ? 'Source port' : 'Target port',
    value,
    entries,
    reason: guard,
    emptyReason:
      guard === null && !entries.some(({ current, reason }) => !current && reason === null)
        ? 'No other eligible ports.'
        : null,
  };
}
