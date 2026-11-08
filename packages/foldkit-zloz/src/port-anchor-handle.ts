import type { Html, HtmlBuilder } from 'foldkit/html';

import { attributesWithGeometry, zlozWorldOverlayItem } from './composition';
import { finitePoint, portAnchor } from './geometry';
import type { ZlozPortAnchorSnapBypassModifier } from './input-message';
import { resolvePortAnchorSnapSettings } from './port-anchor-snap';
import { portEditReason } from './port-edit';
import type {
  EditorPolicy,
  EditorState,
  ZlozNode,
  Point,
  Port,
  PortCorner,
  PortAnchorSnapSettings,
  PortSide,
} from './types';

export type ZlozPortAnchorHandleOptions = Readonly<{
  /** Handle displacement from the socket in world units; default follows its routing side. */
  offset?: Point;
}>;
/** World-layer context independent of socket appearance and connection permissions. */
export type ZlozPortAnchorHandleContext = Readonly<{
  node: ZlozNode;
  port: Port;
  anchor: Point;
  position: Point;
  active: boolean;
  /** Active pointer attraction only; null/absent outside a snapped drag. */
  snappedSide?: PortSide | null;
  /** Active corner attraction; null/absent outside a corner snap. */
  snappedCorner?: PortCorner | null;
  /** Active edge-midpoint attraction; null/absent outside a midpoint snap. */
  snappedMidpoint?: PortSide | null;
  snapBypassed?: boolean;
  snapBypassModifier?: ZlozPortAnchorSnapBypassModifier | undefined;
  /** Captured effective preferences during a drag, even while temporarily bypassed. */
  snapSettings?: PortAnchorSnapSettings;
  /** Native target-cycling shortcut mapping is enabled for this view. */
  keyboardTargets?: boolean;
  disabledReason: string | null;
}>;
export type ZlozPortAnchorHandleRenderer<M> = (
  context: ZlozPortAnchorHandleContext,
  h: HtmlBuilder<M>,
) => Html | null | undefined;

/** Native pointer capture and keyboard nudging are supplied by the Zloz input resource. */
export function zlozPortAnchorHandle<M>(
  h: HtmlBuilder<M>,
  context: ZlozPortAnchorHandleContext,
  attributes: Parameters<HtmlBuilder<M>['button']>[0],
  children: Parameters<HtmlBuilder<M>['button']>[1],
): Html {
  const modifierHint = context.snapBypassModifier
    ? ` Hold ${context.snapBypassModifier} to bypass snapping.`
    : '';
  const keyboardHint =
    context.keyboardTargets && !context.active
      ? ' Page Down/Up cycle snap targets. Home/End choose first/last.'
      : '';
  return zlozWorldOverlayItem(
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
              (context.snapBypassed
                ? `Snapping bypassed. Release ${context.snapBypassModifier ?? 'the modifier'} to restore snapping. Escape cancels.`
                : context.snappedCorner
                  ? `Snapped to ${context.snappedCorner} corner.${modifierHint} Escape cancels.`
                  : context.snappedMidpoint
                    ? `Snapped to ${context.snappedMidpoint} midpoint.${modifierHint} Escape cancels.`
                    : context.snappedSide
                      ? `Snapped to ${context.snappedSide} edge.${modifierHint} Escape cancels.`
                      : `Drag to position.${modifierHint} Arrow keys move 1%; Shift moves 10%.${keyboardHint} Escape cancels.`),
          ),
          ...attributesWithGeometry(h, attributes, {
            'pointer-events': 'auto',
            'touch-action': 'none',
            transform: 'translate(-50%, -50%)',
          }),
          h.Type('button'),
          ...(context.keyboardTargets && !context.active
            ? [h.Attribute('aria-keyshortcuts', 'PageDown PageUp Home End')]
            : []),
          h.Disabled(context.disabledReason !== null),
          h.DataAttribute('flow-anchor-node', context.node.id),
          h.DataAttribute('flow-anchor-port', context.port.id),
          ...(context.snapBypassed ? [h.DataAttribute('flow-anchor-bypassed', 'true')] : []),
          ...(context.snappedCorner
            ? [h.DataAttribute('flow-anchor-corner', context.snappedCorner)]
            : []),
          ...(context.snappedMidpoint
            ? [h.DataAttribute('flow-anchor-midpoint', context.snappedMidpoint)]
            : []),
          ...(context.snappedSide
            ? [h.DataAttribute('flow-anchor-snapped', context.snappedSide)]
            : []),
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
  nodes: readonly ZlozNode[],
  enabled: boolean | ZlozPortAnchorHandleOptions | undefined,
  canEditPort: EditorPolicy['canEditPort'],
  render: ZlozPortAnchorHandleRenderer<M> | undefined,
  bypassModifier?: ZlozPortAnchorSnapBypassModifier | undefined,
  keyboardTargets?: boolean | undefined,
): readonly Html[] {
  if (!enabled) return [];
  const configured = enabled === true ? undefined : enabled.offset;
  if (configured) finitePoint(configured);
  return nodes
    .filter((node) => node.kind !== 'group' && state.selectedNodes.includes(node.id))
    .flatMap((node) =>
      node.ports.flatMap((port) => {
        const anchor = portAnchor(port, node);
        const offset = configured ?? {
          x: port.side === 'left' ? -18 : 18,
          y: port.side === 'bottom' ? 18 : -18,
        };
        const drag = state.gesture.type === 'port-anchor-drag' ? state.gesture : undefined;
        const active = drag?.endpoint.node === node.id && drag.endpoint.port === port.id;
        const context: ZlozPortAnchorHandleContext = {
          node,
          port,
          anchor,
          position: {
            x: node.position.x + anchor.x * node.size.width + offset.x,
            y: node.position.y + anchor.y * node.size.height + offset.y,
          },
          active,
          snappedSide: active ? (drag?.snappedSide ?? null) : null,
          snappedCorner: active ? (drag?.snappedCorner ?? null) : null,
          snappedMidpoint: active ? (drag?.snappedMidpoint ?? null) : null,
          snapBypassed: active && (drag?.snapBypassed ?? false),
          snapBypassModifier: active ? (drag?.snapBypassModifier ?? undefined) : bypassModifier,
          snapSettings:
            active && drag?.snapSettings
              ? resolvePortAnchorSnapSettings(drag.snapSettings)
              : undefined,
          disabledReason: state.readOnly
            ? 'This diagram is read-only.'
            : portEditReason({ operation: 'position', node, port }, state.graph, canEditPort),
          keyboardTargets: keyboardTargets === true,
        };
        const custom = render?.(context, h);
        if (custom === null) return [];
        return [
          custom ??
            zlozPortAnchorHandle(
              h,
              context,
              [
                h.Style({
                  width: '18px',
                  height: '18px',
                  padding: '0',
                  'border-radius': '4px',
                  cursor: context.active ? 'grabbing' : 'grab',
                  border: context.snapBypassed
                    ? '2px dashed var(--flow-node-border, #64748b)'
                    : context.snappedSide || context.snappedCorner || context.snappedMidpoint
                      ? '2px solid var(--flow-selection, #2563eb)'
                      : '1px solid var(--flow-node-border, #64748b)',
                  background: 'var(--flow-node-background, #fff)',
                  color: 'var(--flow-node-color, #172033)',
                }),
              ],
              [context.snappedCorner ? '◆' : context.snappedMidpoint ? '⊙' : '⋮'],
            ),
        ];
      }),
    );
}
