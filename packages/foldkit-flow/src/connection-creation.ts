import { connectionReason, portKind, proposedEdge } from './connection-validation';
import { presentEditorGroups } from './group-presentation';
import type { EdgeEnd, EditorEvent, EditorPolicy, EditorState, Endpoint } from './types';

export type FlowConnectionCreationAction = Readonly<{
  event: Extract<EditorEvent, { type: 'GestureCancelled' }>;
  reason: string | null;
}>;

/** Choosing a source stages it; choosing a target proposes creation through the reducer. */
export type FlowConnectionCreationChoice = Readonly<{
  value: string;
  endpoint: Endpoint;
  label: string;
  current: boolean;
  hidden: boolean;
  reason: string | null;
  event: Extract<EditorEvent, { type: 'PortActivated' }>;
}>;

export type FlowConnectionCreationFieldContext = Readonly<{
  end: EdgeEnd;
  label: string;
  placeholder: string;
  value: string;
  reason: string | null;
  /** Informational; a field with no eligible choices stays focusable after creation/cancellation. */
  hint: string | null;
  entries: readonly FlowConnectionCreationChoice[];
  cancel: FlowConnectionCreationAction;
}>;

/** Derived from EditorState.connection, with no parallel draft or preallocated edge identity. */
export type FlowConnectionCreationContext = Readonly<{
  source: FlowConnectionCreationFieldContext;
  target: FlowConnectionCreationFieldContext;
  cancel: FlowConnectionCreationAction;
}>;

export type FlowConnectionCreationOptions = Readonly<{
  /** Hidden/collapsed alternatives are excluded by default; a staged source is always retained. */
  scope?: 'visible' | 'all';
}>;

const endpointValue = ({ node, port }: Endpoint) => JSON.stringify([node, port]);

/**
 * ADR 0004: creation reuses the existing pending source, port activation and commit path.
 * Recompute per view and use the same pure policy in updateEditor; choices are not permission grants.
 */
export function resolveConnectionCreation(
  state: EditorState,
  policy: EditorPolicy = {},
  options: FlowConnectionCreationOptions = {},
): FlowConnectionCreationContext {
  const source = state.connection;
  const visible = new Set(presentEditorGroups(state).nodes.map(({ id }) => id));
  const guard = state.readOnly
    ? 'This diagram is read-only.'
    : state.gesture.type !== 'idle'
      ? 'Finish the current gesture before choosing ports.'
      : null;
  const sourceReason = !source
    ? null
    : portKind(state.graph, source) !== 'output'
      ? 'Choose a compatible output port.'
      : (policy.canConnectPort?.(source, state.graph) ?? null);
  const cancel: FlowConnectionCreationAction = {
    event: { type: 'GestureCancelled' },
    reason:
      state.gesture.type !== 'idle'
        ? 'Finish the current gesture before cancelling this choice.'
        : !source
          ? 'No connection in progress.'
          : null,
  };
  const field = (end: EdgeEnd): FlowConnectionCreationFieldContext => {
    const value = end === 'source' && source ? endpointValue(source) : '';
    const reason = guard ?? (end === 'target' ? sourceReason : null);
    const entries: FlowConnectionCreationChoice[] = [];
    for (const node of state.graph.nodes) {
      for (const port of node.ports) {
        if (port.kind !== (end === 'source' ? 'output' : 'input')) continue;
        const endpoint = { node: node.id, port: port.id };
        const entryValue = endpointValue(endpoint);
        const current = entryValue === value;
        const hidden = !visible.has(node.id);
        if (hidden && !current && options.scope !== 'all') continue;
        entries.push({
          value: entryValue,
          endpoint,
          current,
          hidden,
          label: `${node.label}: ${port.label ?? port.id}`,
          reason:
            reason ??
            (end === 'source'
              ? (policy.canConnectPort?.(endpoint, state.graph) ?? null)
              : !source
                ? 'Choose an output port first.'
                : connectionReason(
                    state.graph,
                    proposedEdge(state.graph, source, endpoint),
                    policy,
                  )),
          event: { type: 'PortActivated', endpoint },
        });
      }
    }
    if (end === 'source' && source && !entries.some(({ current }) => current)) {
      entries.unshift({
        value,
        endpoint: source,
        label: `${source.node}: ${source.port} (unavailable)`,
        current: true,
        hidden: true,
        reason: 'Current output port is no longer available.',
        event: { type: 'PortActivated', endpoint: source },
      });
    }
    return {
      end,
      value,
      entries,
      reason,
      cancel,
      label: end === 'source' ? 'New connection source' : 'New connection target',
      placeholder: end === 'source' ? 'Choose an output port' : 'Choose an input port',
      hint:
        reason !== null
          ? null
          : end === 'target' && !source
            ? 'Choose an output port first.'
            : entries.some(({ reason }) => reason === null)
              ? null
              : end === 'source'
                ? 'No eligible output ports.'
                : 'No eligible input ports.',
    };
  };
  return { source: field('source'), target: field('target'), cancel };
}
