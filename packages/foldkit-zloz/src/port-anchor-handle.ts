import type { Html, HtmlBuilder } from 'foldkit/html';

import { attributesWithGeometry, zlozWorldOverlayItem } from './composition';
import type { ZlozPortAnchorSnapBypassModifier } from './input-message';
import {
  portAnchorHandleContexts,
  portAnchorHandleTitle,
  type ZlozPortAnchorHandleContext,
  type ZlozPortAnchorHandleOptions,
} from './port-anchor-presentation';
import type { EditorPolicy, EditorState, ZlozNode } from './types';

export type {
  ZlozPortAnchorHandleContext,
  ZlozPortAnchorHandleOptions,
} from './port-anchor-presentation';
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
          h.Title(portAnchorHandleTitle(context)),
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
  return portAnchorHandleContexts(
    state,
    nodes,
    enabled,
    canEditPort,
    bypassModifier,
    keyboardTargets,
  ).flatMap((context) => {
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
  });
}
