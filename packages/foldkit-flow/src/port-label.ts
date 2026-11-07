import type { Html, HtmlBuilder } from 'foldkit/html';

import { flowWorldOverlayItem } from './composition';
import { portPosition } from './geometry';
import { FlowError } from './graph';
import type { FlowNode, Point, Port, PortSide } from './types';

export type FlowPortLabelOptions = Readonly<{
  /** Defaults to the port's routing side. */
  placement?: PortSide;
  /** World-unit gap from the port center. Defaults to 18. */
  offset?: number;
}>;
export type FlowPortLabelContext = Readonly<{
  node: FlowNode;
  port: Port;
  label: string;
  /** Canonical port center in world coordinates. */
  position: Point;
  placement: PortSide;
  offset: number;
}>;
export type FlowPortLabelRenderer<M> = (
  context: FlowPortLabelContext,
  h: HtmlBuilder<M>,
) => Html | null | undefined;
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];

function validateOffset(offset: number): void {
  if (!Number.isFinite(offset) || offset < 0)
    throw new FlowError('invalid-edit', 'Port label offset must be finite and non-negative');
}

/** Decorative world-space label. Place it in Flow's world overlay or return it from renderPortLabel. */
export function flowPortLabel<M>(
  h: HtmlBuilder<M>,
  context: FlowPortLabelContext,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  const { node, port, position, placement, offset } = context;
  validateOffset(offset);
  const alignment = {
    left: { x: -offset, y: 0, transform: 'translate(-100%, -50%)' },
    right: { x: offset, y: 0, transform: 'translate(0, -50%)' },
    top: { x: 0, y: -offset, transform: 'translate(-50%, -100%)' },
    bottom: { x: 0, y: offset, transform: 'translate(-50%, 0)' },
  }[placement];
  return flowWorldOverlayItem(
    h,
    { position: { x: position.x + alignment.x, y: position.y + alignment.y } },
    [
      ...attributes,
      h.Key('port-label:' + encodeURIComponent(node.id) + ':' + encodeURIComponent(port.id)),
      h.DataAttribute('flow-port-label', port.id),
      h.DataAttribute('flow-owner', node.id),
      h.AriaHidden(true),
      h.Style({ transform: alignment.transform, 'white-space': 'nowrap' }),
    ],
    children,
  );
}

export function portLabelViews<M>(
  h: HtmlBuilder<M>,
  nodes: readonly FlowNode[],
  options: boolean | FlowPortLabelOptions | undefined,
  render: FlowPortLabelRenderer<M> | undefined,
): readonly Html[] {
  if (!options) return [];
  const settings = options === true ? {} : options;
  const offset = settings.offset ?? 18;
  validateOffset(offset);
  return nodes.flatMap((node) =>
    node.ports.flatMap((port) => {
      const context: FlowPortLabelContext = {
        node,
        port,
        label: port.label ?? port.id,
        position: portPosition(node, port.id),
        placement: settings.placement ?? port.side,
        offset,
      };
      const custom = render?.(context, h);
      if (custom === null) return [];
      return [
        custom ??
          flowPortLabel(
            h,
            context,
            [
              h.Style({
                'font-size': '12px',
                color: 'var(--flow-node-color, #172033)',
                'z-index': '2',
              }),
            ],
            [context.label],
          ),
      ];
    }),
  );
}
