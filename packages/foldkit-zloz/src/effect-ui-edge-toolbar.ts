import type { Html } from '@effect/ui/html';

import type { ZlozEdgeToolbarAction, ZlozEdgeToolbarContext } from './edge-toolbar';
import { edgePathStyles } from './edge-toolbar-placement';
import { endpointField } from './effect-ui-endpoints';
import type { EditorEvent } from './types';

export type NativeEdgeToolbarOptions<M> = Readonly<{
  design?: 'standard' | 'compact';
  pathLabel?: string;
  onEvent: (event: EditorEvent) => M | undefined;
}>;

/** Shared toolbar controls. The surface owns geometry and the host owns the editor. */
export function edgeToolbarContent<M>(
  h: Html.H<M>,
  context: ZlozEdgeToolbarContext,
  { onEvent, design, pathLabel = 'Selected edge path style' }: NativeEdgeToolbarOptions<M>,
) {
  const compact = design === 'compact';
  const { edge, actions, reconnection } = context;
  const button = (action: ZlozEdgeToolbarAction) =>
    h.button
      .key(action.label)
      .attr('type', 'button')
      .attr('title', action.disabledReason)
      .disabled(action.disabledReason !== undefined)
      .on('click', () => onEvent(action.event))
      .children(action.label);
  const style = h.select
    .key('path')
    .attr('aria-label', pathLabel)
    .value(edge.pathStyle ?? 'auto')
    .on('change', ({ value }) =>
      onEvent(
        actions.changePathStyle(edgePathStyles.find(({ style }) => style === value)?.style ?? null),
      ),
    )
    .children(
      ...edgePathStyles.map(({ label, style }) =>
        h.option
          .key(style ?? 'auto')
          .attr('value', style ?? 'auto')
          .children(label),
      ),
    );
  return h.div.class('zloz-ui-edge-toolbar', compact ? 'compact-edge-actions' : '').children(
    compact ? null : button(actions.rename),
    style,
    button(actions.deleteEdge),
    actions.deleteEdge.disabledReason ? h.small.children(actions.deleteEdge.disabledReason) : null,
    ...(reconnection
      ? [reconnection.source, reconnection.target].map((field) =>
          endpointField(h, field, {
            id: `${reconnection.idPrefix}-${field.end}`,
            onEvent,
          }),
        )
      : []),
  );
}
