import { Option } from 'effect';

import { portEditReason } from './port-edit';
import { resolvePortRemoval } from './port-removal';
import type { EditorPolicy, EditorState, Endpoint, ZlozNode, Port } from './types';

/** Null reason enables the control. Render the reason with its ID when present. */
export type ZlozPortControlContext = Readonly<{ reason: string | null; reasonId: string }>;
/** Current authored port plus operation-specific capabilities; no inspector selection is required. */
export type ZlozPortInspectorEntry = Readonly<{
  node: ZlozNode;
  port: Port;
  endpoint: Endpoint;
  labelControl: ZlozPortControlContext;
  positionControl: ZlozPortControlContext;
  removeControl: ZlozPortControlContext;
  /** Render each unique reason once; operation controls reference these IDs. */
  reasons: readonly ZlozPortControlContext[];
}>;
/** Hosts arrange or omit entries and controls freely. */
export type ZlozPortInspectorContext = Readonly<{
  node: ZlozNode;
  entries: readonly ZlozPortInspectorEntry[];
}>;
/** An authored proposal for a host-controlled add action. The reducer validates the actual addition. */
export type ZlozPortAdditionContext = Readonly<{
  node: ZlozNode;
  port: Port;
  control: ZlozPortControlContext;
}>;

/** Per-inspector identity and guard copy; custom policy reasons remain host-owned. */
export type ZlozPortInspectorOptions = Readonly<{
  idPrefix?: string;
  readOnlyReason?: string;
  busyReason?: string;
}>;

function control(
  state: EditorState,
  reasonId: string,
  resolve: () => string | null,
  options: ZlozPortInspectorOptions,
): ZlozPortControlContext {
  return {
    reasonId,
    reason: state.readOnly
      ? (options.readOnlyReason ?? 'This diagram is read-only.')
      : state.gesture.type !== 'idle'
        ? (options.busyReason ?? 'Finish the current gesture before editing ports.')
        : resolve(),
  };
}

/** Resolve fresh capabilities on each view. Supply distinct prefixes for simultaneous inspectors. */
export function portInspectorContext(
  state: EditorState,
  nodeId: string,
  policy: EditorPolicy = {},
  options: ZlozPortInspectorOptions = {},
): Option.Option<ZlozPortInspectorContext> {
  const idPrefix = options.idPrefix ?? 'flow-port-inspector-' + encodeURIComponent(nodeId);
  const node = state.graph.nodes.find(({ id }) => id === nodeId);
  if (!node || node.kind === 'group') return Option.none();
  return Option.some({
    node,
    entries: node.ports.map((port) => {
      const endpoint = { node: node.id, port: port.id };
      const prefix = idPrefix + '-' + encodeURIComponent(port.id);
      const labelControl = control(
        state,
        prefix + '-label',
        () => portEditReason({ operation: 'label', node, port }, state.graph, policy.canEditPort),
        options,
      );
      const positionControl = control(
        state,
        prefix + '-position',
        () =>
          portEditReason({ operation: 'position', node, port }, state.graph, policy.canEditPort),
        options,
      );
      const removeControl = control(
        state,
        prefix + '-remove',
        () => {
          const decision = resolvePortRemoval(
            state.graph,
            endpoint,
            policy.canDelete,
            policy.canEditPort,
          );
          return decision.type === 'blocked' ? decision.reason : null;
        },
        options,
      );
      const controls = [labelControl, positionControl, removeControl];
      const reasons = controls.filter(
        (item, index) =>
          item.reason !== null &&
          controls.findIndex((other) => other.reason === item.reason) === index,
      );
      const shared = (item: ZlozPortControlContext) =>
        reasons.find((reason) => reason.reason === item.reason) ?? item;
      return {
        node,
        port,
        endpoint,
        reasons,
        labelControl: shared(labelControl),
        positionControl: shared(positionControl),
        removeControl: shared(removeControl),
      };
    }),
  });
}

/** Preflight a proposed port without allocating identity or changing the document. */
export function portAdditionContext(
  state: EditorState,
  nodeId: string,
  port: Port,
  policy: EditorPolicy = {},
  options: ZlozPortInspectorOptions = {},
): Option.Option<ZlozPortAdditionContext> {
  const idPrefix = options.idPrefix ?? 'flow-port-inspector-' + encodeURIComponent(nodeId);
  const node = state.graph.nodes.find(({ id }) => id === nodeId);
  if (!node || node.kind === 'group') return Option.none();
  return Option.some({
    node,
    port,
    control: control(
      state,
      idPrefix + '-' + encodeURIComponent(port.id) + '-add',
      () => portEditReason({ operation: 'add', node, port }, state.graph, policy.canEditPort),
      options,
    ),
  });
}
