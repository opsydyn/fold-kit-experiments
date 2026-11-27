import type { Html, HtmlBuilder } from 'foldkit/html';

import { zlozWorldOverlayItem } from './composition';
import {
  portLabelContexts,
  portLabelLayout,
  type ZlozPortLabelContext,
  type ZlozPortLabelOptions,
} from './port-label-presentation';
import type { ZlozNode } from './types';

export type { ZlozPortLabelContext, ZlozPortLabelOptions } from './port-label-presentation';
export type ZlozPortLabelRenderer<M> = (
  context: ZlozPortLabelContext,
  h: HtmlBuilder<M>,
) => Html | null | undefined;
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];

/** Decorative world-space label. Place it in Zloz's world overlay or return it from renderPortLabel. */
export function zlozPortLabel<M>(
  h: HtmlBuilder<M>,
  context: ZlozPortLabelContext,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  const { node, port } = context;
  const { position, transform } = portLabelLayout(context);
  return zlozWorldOverlayItem(
    h,
    { position },
    [
      ...attributes,
      h.Key('port-label:' + encodeURIComponent(node.id) + ':' + encodeURIComponent(port.id)),
      h.DataAttribute('flow-port-label', port.id),
      h.DataAttribute('flow-owner', node.id),
      h.AriaHidden(true),
      h.Style({ transform, 'white-space': 'nowrap' }),
    ],
    children,
  );
}

export function portLabelViews<M>(
  h: HtmlBuilder<M>,
  nodes: readonly ZlozNode[],
  options: boolean | ZlozPortLabelOptions | undefined,
  render: ZlozPortLabelRenderer<M> | undefined,
): readonly Html[] {
  return portLabelContexts(nodes, options).flatMap((context) => {
    const custom = render?.(context, h);
    if (custom === null) return [];
    return [
      custom ??
        zlozPortLabel(
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
  });
}
