import type { Html } from '@effect/ui/html';

import type {
  ZlozContextAction,
  ZlozContextMenuContext,
  ZlozGroupContextActions,
} from './context-menu';
import type { EditorEvent } from './types';

export type NativeContextMenuOptions<M> = Readonly<{
  id: string;
  design?: 'standard' | 'panel';
  onEvent: (event: EditorEvent) => M;
}>;

/** Render the actions for one editor-owned context panel. The surface owns positioning and focus. */
export function contextMenu<M>(
  h: Html.H<M>,
  context: ZlozContextMenuContext,
  { id, design, onEvent }: NativeContextMenuOptions<M>,
) {
  const panel = design === 'panel';
  const button = (action: ZlozContextAction) =>
    h.button
      .key(action.label)
      .attr('type', 'button')
      .attr('title', action.disabledReason)
      .attr('data-flow-context-close', action.event.type === 'ContextDismissed' ? '' : undefined)
      .attr('aria-pressed', action.pressed === undefined ? undefined : String(action.pressed))
      .disabled(action.disabledReason !== undefined)
      .on('click', onEvent(action.event))
      .children(action.label);
  const explanation = (reason: string | undefined) => (reason ? h.small.children(reason) : null);
  const dimensions = (group: ZlozGroupContextActions) => {
    const helpId = `${id}-group-size-help`;
    const labels = { width: 'Width', height: 'Height' };
    return [
      ...(panel ? (['width'] as const) : (['width', 'height'] as const)).map((dimension) =>
        h.label
          .key(dimension)
          .class('zloz-ui-context-dimension')
          .children(
            labels[dimension],
            h.input
              .attr('type', 'number')
              .attr('min', '0')
              .attr('step', String(group.dimensionStep))
              .attr('aria-label', `${labels[dimension]} of ${group.node.label}`)
              .attr('aria-describedby', helpId)
              .value(String(Number(group.node.size[dimension].toPrecision(12))))
              .disabled(group.dimensionsDisabled)
              .on('change', ({ value }) =>
                value.trim() !== '' && Number.isFinite(Number(value))
                  ? onEvent(group.changeDimension(dimension, Number(value)))
                  : undefined,
              ),
          ),
      ),
      h.small
        .id(helpId)
        .children(
          group.resizeDisabledReason ??
            (group.collapsed
              ? 'Expand the group to edit dimensions.'
              : 'Values follow grid, limits and locked proportions.'),
        ),
    ];
  };
  const nodeActions = (node: Extract<ZlozContextMenuContext, { kind: 'node' }>) => {
    const { group } = node;
    const fit = group ? [button(group.fit), button(group.lockProportions)] : [];
    const size = group?.showMeasurements
      ? dimensions(group)
      : panel
        ? [explanation(group?.resizeDisabledReason)]
        : [];
    return panel
      ? [...size, ...fit, button(node.duplicate)]
      : [
          button(node.duplicate),
          ...fit,
          ...size,
          button(node.deleteNode),
          explanation(node.deleteNode.disabledReason),
        ];
  };
  return h.div
    .class('zloz-ui-context-menu', panel ? 'custom-context-menu' : '')
    .children(
      panel
        ? h.strong.children(
            context.kind === 'node' ? context.node.label : (context.edge.label ?? 'Connection'),
          )
        : null,
      ...(context.kind === 'edge'
        ? [
            ...(panel ? [button(context.rename)] : []),
            button(context.deleteEdge),
            explanation(context.deleteEdge.disabledReason),
          ]
        : nodeActions(context)),
      button(context.close),
    );
}
