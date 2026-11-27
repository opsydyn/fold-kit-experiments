import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { selectedNodeActions } from './context-menu-context';
import {
  nodeToolbarContext,
  nodeToolbarPosition,
  type ZlozNodeToolbarOptions,
  type ZlozNodeToolbarContext,
} from './node-toolbar-layout';
import type { EditorEvent, EditorPolicy, EditorState, ZlozNode } from './types';

export type NativeNodeToolbar<M> = ZlozNodeToolbarOptions &
  Readonly<{
    compact?: boolean;
    render?: (context: ZlozNodeToolbarContext, h: Html.H<M>) => View.Content<M> | null | undefined;
    onEvent: (event: EditorEvent) => M;
  }>;

export function nodeToolbar<M>(
  h: Html.H<M>,
  state: EditorState,
  nodes: readonly ZlozNode[],
  policy: EditorPolicy | undefined,
  options: NativeNodeToolbar<M>,
) {
  if (
    state.readOnly ||
    state.gesture.type !== 'idle' ||
    state.context ||
    state.connection ||
    state.selectedNodes.length !== 1 ||
    state.selectedEdges.length !== 0
  )
    return null;
  const node = nodes.find(({ id }) => id === state.selectedNodes[0]);
  if (!node || policy?.canSelectNode?.(node, state.graph) != null) return null;
  const context = nodeToolbarContext(
    node,
    state.viewport,
    options,
    selectedNodeActions(state, policy?.canDelete),
  );
  const custom = options.render?.(context, h);
  if (custom === null) return null;
  const { x, y, translate } = nodeToolbarPosition(context);
  return h.div
    .key('node-toolbar')
    .class('zloz-ui-node-toolbar', options.compact && 'zloz-ui-node-toolbar--compact')
    .attr('role', 'group')
    .attr('aria-label', `Actions for ${node.label}`)
    .attr('data-flow-node-toolbar', node.id)
    .attr('data-flow-no-drag', '')
    .style({ left: `${x}px`, top: `${y}px`, translate })
    .children(
      custom ??
        [context.actions.duplicate, context.actions.deleteNode].map((action) =>
          h.button
            .key(action.label)
            .attr('type', 'button')
            .attr('title', action.disabledReason)
            .disabled(action.disabledReason !== undefined)
            .on('click', options.onEvent(action.event))
            .children(action.label),
        ),
    );
}
