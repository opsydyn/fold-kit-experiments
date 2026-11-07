import type { Html, HtmlBuilder } from 'foldkit/html';

import { attributesWithGeometry, flowWorldOverlayItem } from './composition';
import { finitePoint, portAnchor } from './geometry';
import { portEditReason } from './port-edit';
import type { EditorPolicy, EditorState, FlowNode, Point, Port } from './types';

export type FlowPortAnchorHandleOptions = Readonly<{
  /** Handle displacement from the socket in world units; default follows its routing side. */
  offset?: Point;
}>;
/** World-layer context independent of socket appearance and connection permissions. */
export type FlowPortAnchorHandleContext = Readonly<{
  node: FlowNode;
  port: Port;
  anchor: Point;
  position: Point;
  active: boolean;
  disabledReason: string | null;
}>;
export type FlowPortAnchorHandleRenderer<M> = (
  context: FlowPortAnchorHandleContext,
  h: HtmlBuilder<M>,
) => Html | null | undefined;

/** Native pointer capture and keyboard nudging are supplied by the Flow input resource. */
export function flowPortAnchorHandle<M>(
  h: HtmlBuilder<M>,
  context: FlowPortAnchorHandleContext,
  attributes: Parameters<HtmlBuilder<M>['button']>[0],
  children: Parameters<HtmlBuilder<M>['button']>[1],
): Html {
  return flowWorldOverlayItem(
    h,
    { position: context.position },
    [
      h.Key('anchor:' + JSON.stringify([context.node.id, context.port.id])),
      h.Style({ 'z-index': '5' }),
    ],
    [
      h.button(
        [
          h.AriaLabel(`Position ${context.node.label}: ${context.port.label ?? context.port.id}`),
          h.Title(
            context.disabledReason ??
              'Drag to position. Arrow keys move 1%; Shift moves 10%. Escape cancels.',
          ),
          ...attributesWithGeometry(h, attributes, {
            'pointer-events': 'auto',
            'touch-action': 'none',
            transform: 'translate(-50%, -50%)',
          }),
          h.Type('button'),
          h.Disabled(context.disabledReason !== null),
          h.DataAttribute('flow-anchor-node', context.node.id),
          h.DataAttribute('flow-anchor-port', context.port.id),
        ],
        children,
      ),
    ],
  );
}

/** Render selected visible ports in the shared world layer, keeping custom node shells independent. */
export function portAnchorHandleViews<M>(
  h: HtmlBuilder<M>,
  state: EditorState,
  nodes: readonly FlowNode[],
  enabled: boolean | FlowPortAnchorHandleOptions | undefined,
  canEditPort: EditorPolicy['canEditPort'],
  render: FlowPortAnchorHandleRenderer<M> | undefined,
): readonly Html[] {
  if (!enabled) return [];
  const configured = enabled === true ? undefined : enabled.offset;
  if (configured) finitePoint(configured);
  return nodes
    .filter((node) => node.kind !== 'group' && state.selectedNodes.includes(node.id))
    .flatMap((node) =>
      node.ports.flatMap((port) => {
        const anchor = portAnchor(port);
        const offset = configured ?? {
          x: port.side === 'left' ? -18 : 18,
          y: port.side === 'bottom' ? 18 : -18,
        };
        const context: FlowPortAnchorHandleContext = {
          node,
          port,
          anchor,
          position: {
            x: node.position.x + anchor.x * node.size.width + offset.x,
            y: node.position.y + anchor.y * node.size.height + offset.y,
          },
          active:
            state.gesture.type === 'port-anchor-drag' &&
            state.gesture.endpoint.node === node.id &&
            state.gesture.endpoint.port === port.id,
          disabledReason: state.readOnly
            ? 'This diagram is read-only.'
            : portEditReason({ operation: 'position', node, port }, state.graph, canEditPort),
        };
        const custom = render?.(context, h);
        if (custom === null) return [];
        return [
          custom ??
            flowPortAnchorHandle(
              h,
              context,
              [
                h.Style({
                  width: '18px',
                  height: '18px',
                  padding: '0',
                  'border-radius': '4px',
                  cursor: 'grab',
                  border: '1px solid var(--flow-node-border, #64748b)',
                  background: 'var(--flow-node-background, #fff)',
                  color: 'var(--flow-node-color, #172033)',
                }),
              ],
              ['⋮'],
            ),
        ];
      }),
    );
}
