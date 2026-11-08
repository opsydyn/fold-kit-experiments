import { Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { portEditReason } from './port-edit';
import { resolvePortRemoval } from './port-removal';
import type { EditorEvent, EditorPolicy, EditorState, Endpoint, FlowNode, Port } from './types';

/** Null reason enables the control. Render the reason with its ID when present. */
export type FlowPortControlContext = Readonly<{ reason: string | null; reasonId: string }>;
/** Current authored port plus operation-specific capabilities; no inspector selection is required. */
export type FlowPortInspectorEntry = Readonly<{
  node: FlowNode;
  port: Port;
  endpoint: Endpoint;
  labelControl: FlowPortControlContext;
  positionControl: FlowPortControlContext;
  removeControl: FlowPortControlContext;
  /** Render each unique reason once; operation controls reference these IDs. */
  reasons: readonly FlowPortControlContext[];
}>;
/** Hosts arrange or omit entries and controls freely. */
export type FlowPortInspectorContext = Readonly<{
  node: FlowNode;
  entries: readonly FlowPortInspectorEntry[];
}>;
/** An authored proposal for a host-controlled add action. The reducer validates the actual addition. */
export type FlowPortAdditionContext = Readonly<{
  node: FlowNode;
  port: Port;
  control: FlowPortControlContext;
}>;
/** Host Model-owned draft interaction; committing a label still uses PortLabelChanged. */
export type FlowPortLabelFormMessages<M> = Readonly<{
  saved: M;
  cancelled: M;
}>;

/** Per-inspector identity and guard copy; custom policy reasons remain host-owned. */
export type FlowPortInspectorOptions = Readonly<{
  idPrefix?: string;
  readOnlyReason?: string;
  busyReason?: string;
}>;

type Attributes<M> = Parameters<HtmlBuilder<M>['button']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['button']>[1];

function control(
  state: EditorState,
  reasonId: string,
  resolve: () => string | null,
  options: FlowPortInspectorOptions,
): FlowPortControlContext {
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
  options: FlowPortInspectorOptions = {},
): Option.Option<FlowPortInspectorContext> {
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
      const shared = (item: FlowPortControlContext) =>
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
  options: FlowPortInspectorOptions = {},
): Option.Option<FlowPortAdditionContext> {
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

function protectionAttributes<M>(
  h: HtmlBuilder<M>,
  context: FlowPortControlContext,
): Attributes<M> {
  return [
    h.Disabled(context.reason !== null),
    ...(context.reason !== null ? [h.AriaDescribedBy(context.reasonId)] : []),
  ];
}

/** Host add message keeps identity allocation in update, including rapid repeated clicks. */
export function flowPortAddButton<M>(
  h: HtmlBuilder<M>,
  context: FlowPortAdditionContext,
  added: M,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      ...protectionAttributes(h, context.control),
      h.OnClick(added),
    ],
    children,
  );
}

/** Removes this endpoint through the normal atomic reducer event. */
export function flowPortRemoveButton<M>(
  h: HtmlBuilder<M>,
  context: FlowPortInspectorEntry,
  onEvent: (event: EditorEvent) => M,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.button(
    [
      h.AriaLabel(
        `Remove ${context.port.label ?? context.port.id} port from ${context.node.label}`,
      ),
      ...attributes,
      h.Type('button'),
      ...protectionAttributes(h, context.removeControl),
      h.OnClick(onEvent({ type: 'PortRemoved', endpoint: context.endpoint })),
    ],
    children,
  );
}

/** Opens a host-owned draft; the default native name can be customized through attributes. */
export function flowPortLabelEditButton<M>(
  h: HtmlBuilder<M>,
  context: FlowPortInspectorEntry,
  edited: M,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.button(
    [
      h.AriaLabel(`Edit label for ${context.port.id} port on ${context.node.label}`),
      ...attributes,
      h.Type('button'),
      ...protectionAttributes(h, context.labelControl),
      h.OnClick(edited),
    ],
    children,
  );
}

/** Submit commits the host draft; Escape discards it even when policy disables editing. */
export function flowPortLabelForm<M>(
  h: HtmlBuilder<M>,
  messages: FlowPortLabelFormMessages<M>,
  attributes: Parameters<HtmlBuilder<M>['form']>[0],
  children: Children<M>,
): Html {
  return h.form(
    [
      ...attributes,
      h.OnSubmit(messages.saved),
      h.OnKeyDownPreventDefault((key) =>
        key === 'Escape' ? Option.some(messages.cancelled) : Option.none(),
      ),
    ],
    children,
  );
}

/** Text and events come from the host Model. Attributes can override naming and autofocus. */
export function flowPortLabelInput<M>(
  h: HtmlBuilder<M>,
  context: FlowPortInspectorEntry,
  draft: string,
  changed: (text: string) => M,
  attributes: Parameters<HtmlBuilder<M>['input']>[0],
): Html {
  return h.input([
    h.AriaLabel(`Label for ${context.port.id} port on ${context.node.label}`),
    h.Autofocus(true),
    ...attributes,
    h.Type('text'),
    h.Value(draft),
    ...protectionAttributes(h, context.labelControl),
    h.OnInput(changed),
  ]);
}

/** A policy-aware native submit control for flowPortLabelForm. */
export function flowPortLabelSave<M>(
  h: HtmlBuilder<M>,
  context: FlowPortInspectorEntry,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.button(
    [...attributes, h.Type('submit'), ...protectionAttributes(h, context.labelControl)],
    children,
  );
}

/** Cancel remains available while a draft is protected. */
export function flowPortLabelCancel<M>(
  h: HtmlBuilder<M>,
  cancelled: M,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.button([...attributes, h.Type('button'), h.OnClick(cancelled)], children);
}

/** Unstyled reason content associated with the native controls. Omit it when reason is null. */
export function flowPortProtectionReason<M>(
  h: HtmlBuilder<M>,
  context: FlowPortControlContext,
  attributes: Parameters<HtmlBuilder<M>['span']>[0],
  children: Children<M> = [context.reason ?? ''],
): Html {
  return h.span([...attributes, h.Id(context.reasonId)], children);
}
