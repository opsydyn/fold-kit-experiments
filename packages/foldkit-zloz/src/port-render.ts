import type { Html, HtmlBuilder } from 'foldkit/html';

import { zlozPort } from './composition';
import { portAnchor } from './geometry';
import type { Endpoint, Point, Port } from './types';

type PortNodeContext = Parameters<typeof zlozPort>[1];
export type ZlozPortRenderContext = PortNodeContext &
  Readonly<{
    port: Port;
    label: string;
    /** Canonical normalized anchor within the node frame. */
    anchor: Point;
    active: boolean;
    /** Current accepted connection-drag target. */
    target: boolean;
    disabledReason: string | null;
  }>;
export type ZlozPortRenderer<M> = (
  context: ZlozPortRenderContext,
  h: HtmlBuilder<M>,
) => Html | null | undefined;

function defaultPort<M>(h: HtmlBuilder<M>, context: ZlozPortRenderContext): Html {
  const { port, target } = context;
  return zlozPort(
    h,
    context,
    port,
    [
      h.Style({
        position: 'absolute',
        'z-index': '1',
        width: '24px',
        height: '24px',
        padding: '0',
        'border-radius': '50%',
        border: target
          ? '3px solid var(--flow-node-color, #172033)'
          : '2px solid var(--flow-port-border, #fff)',
        'box-shadow': target ? '0 0 0 3px var(--flow-valid-target, #0f766e)' : 'none',
        background:
          port.kind === 'output'
            ? 'var(--flow-output-port, #2563eb)'
            : 'var(--flow-input-port, #0f766e)',
        color: 'var(--flow-control-color, #fff)',
        cursor: 'crosshair',
      }),
    ],
    [port.kind === 'output' ? '+' : '−'],
  );
}

/** Resolves native controls for default shells or a custom shell's ports collection. */
export function portRenderViews<M>(
  h: HtmlBuilder<M>,
  context: PortNodeContext,
  target: Endpoint | null,
  render: ZlozPortRenderer<M> | undefined,
): readonly Html[] {
  const { node, state } = context;
  return node.ports.flatMap((port) => {
    const endpoint = { node: node.id, port: port.id };
    const portContext: ZlozPortRenderContext = {
      ...context,
      port,
      label: port.label ?? port.id,
      anchor: portAnchor(port, node),
      active: state.connection?.node === node.id && state.connection.port === port.id,
      target: target?.node === node.id && target.port === port.id,
      disabledReason: context.canConnectPort?.(endpoint, state.graph) ?? null,
    };
    const custom = render?.(portContext, h);
    return custom === null ? [] : [custom ?? defaultPort(h, portContext)];
  });
}
