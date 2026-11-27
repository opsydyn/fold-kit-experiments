import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { portConnectionEnd } from './connection-mode';
import { portAnchor, portPosition } from './geometry';
import {
  portLabelContexts,
  portLabelLayout,
  type ZlozPortLabelContext,
  type ZlozPortLabelOptions,
} from './port-label-presentation';
import type { EditorPolicy, EditorState, Point, Port, ZlozNode } from './types';

/** Customize the contents and appearance of the native input button. */
export type NativePortControl<M> = Readonly<{
  className?: string;
  style?: Html.Style;
  content?: string | View.Content<M>;
  describedBy?: string;
}>;

export type NativeSocketContext = Readonly<{
  node: ZlozNode;
  port: Port;
  anchor: Point;
  label: string;
  connectionEnd: 'source' | 'target';
  active: boolean;
  target: boolean;
  disabledReason: string | null;
}>;

export type NativePortLabelRenderer<M> = (
  context: ZlozPortLabelContext,
  h: Html.H<M>,
) => string | View.Content<M> | null | undefined;

export type GraphPortOptions<M> = Readonly<{
  portLabel?: (
    context: Readonly<{
      port: Port;
      end: 'source' | 'target';
      reason: string | null;
    }>,
  ) => string | undefined;
  /** Customize a socket while retaining the surface’s placement and input bindings. */
  renderPort?: (context: NativeSocketContext, h: Html.H<M>) => NativePortControl<M> | undefined;
  /** Display decorative labels beside visible sockets. */
  portLabels?: boolean | ZlozPortLabelOptions;
  /** Return null to omit this label, or undefined to keep the default. */
  renderPortLabel?: NativePortLabelRenderer<M>;
  policy?: EditorPolicy;
}>;

export function portSockets<M>(
  h: Html.H<M>,
  editor: EditorState,
  node: ZlozNode,
  options: GraphPortOptions<M>,
) {
  const drag = editor.gesture.type === 'connection-drag' ? editor.gesture : undefined;
  return node.ports.map((port) => {
    const point = portPosition(node, port.id);
    const end = portConnectionEnd(editor, port);
    const target = drag?.target?.node === node.id && drag.target.port === port.id;
    const active = editor.connection?.node === node.id && editor.connection.port === port.id;
    const reason = editor.readOnly
      ? 'This diagram is read-only.'
      : (options.policy?.canConnectPort?.({ node: node.id, port: port.id }, editor.graph) ?? null);
    const label = port.label ?? port.id;
    const custom = options.renderPort?.(
      {
        node,
        port,
        anchor: portAnchor(port, node),
        label,
        connectionEnd: end,
        active,
        target,
        disabledReason: reason,
      },
      h,
    );
    const badge = custom ? undefined : options.portLabel?.({ port, end, reason });
    return h.button
      .key(port.id)
      .class('zloz-ui-port', badge !== undefined && 'zloz-ui-port-custom', custom?.className)
      .attr('type', 'button')
      .attr('data-flow-owner', node.id)
      .attr('data-flow-port', port.id)
      .attr('data-flow-port-kind', port.kind)
      .attr('data-flow-connection-end', end)
      .attr('data-custom-intent', badge !== undefined || custom ? end : undefined)
      .attr('data-target', target ? 'true' : undefined)
      .attr('aria-label', `Connect ${end === 'source' ? 'from' : 'to'} ${node.label}: ${label}`)
      .attr('aria-pressed', String(active))
      .attr('aria-describedby', custom?.describedBy)
      .attr('title', reason ?? undefined)
      .disabled(reason !== null)
      .style({
        ...custom?.style,
        left: `${point.x - node.position.x}px`,
        top: `${point.y - node.position.y}px`,
      })
      .children(custom?.content ?? badge ?? '');
  });
}

export function portLabels<M>(
  h: Html.H<M>,
  nodes: readonly ZlozNode[],
  options: GraphPortOptions<M>,
) {
  return portLabelContexts(nodes, options.portLabels).flatMap((context) => {
    const custom = options.renderPortLabel?.(context, h);
    if (custom === null) return [];
    const { position, transform } = portLabelLayout(context);
    return [
      h.div
        .key(`port-label:${JSON.stringify([context.node.id, context.port.id])}`)
        .class('zloz-ui-port-label')
        .attr('data-flow-port-label', context.port.id)
        .attr('data-flow-owner', context.node.id)
        .attr('aria-hidden', 'true')
        .attr('inert', '')
        .style({
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        })
        .children(custom ?? context.label),
    ];
  });
}
