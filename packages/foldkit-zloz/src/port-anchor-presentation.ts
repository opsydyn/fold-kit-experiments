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
export function portAnchorHandleTitle(context: ZlozPortAnchorHandleContext): string {
  const modifierHint = context.snapBypassModifier
    ? ` Hold ${context.snapBypassModifier} to bypass snapping.`
    : '';
  const keyboardHint =
    context.keyboardTargets && !context.active
      ? ' Page Down/Up cycle snap targets. Home/End choose first/last.'
      : '';
  return (
    context.disabledReason ??
    (context.snapBypassed
      ? `Snapping bypassed. Release ${context.snapBypassModifier ?? 'the modifier'} to restore snapping. Escape cancels.`
      : context.snappedCorner
        ? `Snapped to ${context.snappedCorner} corner.${modifierHint} Escape cancels.`
        : context.snappedMidpoint
          ? `Snapped to ${context.snappedMidpoint} midpoint.${modifierHint} Escape cancels.`
          : context.snappedSide
            ? `Snapped to ${context.snappedSide} edge.${modifierHint} Escape cancels.`
            : `Drag to position.${modifierHint} Arrow keys move 1%; Shift moves 10%.${keyboardHint} Escape cancels.`)
  );
}

export function portAnchorHandleContexts(
  state: EditorState,
  nodes: readonly ZlozNode[],
  enabled: boolean | ZlozPortAnchorHandleOptions | undefined,
  canEditPort: EditorPolicy['canEditPort'],
  bypassModifier?: ZlozPortAnchorSnapBypassModifier,
  keyboardTargets?: boolean,
): readonly ZlozPortAnchorHandleContext[] {
  if (!enabled) return [];
  const configured = enabled === true ? undefined : enabled.offset;
  if (configured) finitePoint(configured);
  const selected = new Set(state.selectedNodes);
  const drag = state.gesture.type === 'port-anchor-drag' ? state.gesture : undefined;
  return nodes
    .filter((node) => node.kind !== 'group' && selected.has(node.id))
    .flatMap((node) =>
      node.ports.map((port) => {
        const anchor = portAnchor(port, node);
        const offset = configured ?? {
          x: port.side === 'left' ? -18 : 18,
          y: port.side === 'bottom' ? 18 : -18,
        };
        const active = drag?.endpoint.node === node.id && drag.endpoint.port === port.id;
        return {
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
      }),
    );
}
