import { deletionReason } from './context-menu-context';
import { resolveEdgeReconnection, type ZlozEdgeReconnectionOptions } from './edge-reconnection';
import type { ZlozEdgeToolbarContext } from './edge-toolbar';
import type { EditorPolicy, EditorState, Point, ZlozEdge } from './types';

/** Resolve the same toolbar actions and current policy in either renderer. */
export function resolveEdgeToolbar(
  state: EditorState,
  edge: ZlozEdge,
  labelPosition: Point,
  policy: EditorPolicy | undefined,
  reconnection?: Readonly<{ idPrefix: string; options: ZlozEdgeReconnectionOptions }>,
): ZlozEdgeToolbarContext {
  const { id } = edge;
  const source =
    reconnection && resolveEdgeReconnection(state, id, 'source', policy, reconnection.options);
  const target =
    reconnection && resolveEdgeReconnection(state, id, 'target', policy, reconnection.options);
  return {
    edge,
    labelPosition,
    reconnection:
      reconnection && source && target
        ? { idPrefix: reconnection.idPrefix, source, target }
        : undefined,
    actions: {
      rename: {
        label: 'Rename',
        event: { type: 'EdgeLabelEditingStarted', id },
      },
      deleteEdge: {
        label: 'Delete edge',
        event: { type: 'EdgeDeleted', id },
        disabledReason: deletionReason(
          state.graph,
          { nodeIds: [], edgeIds: [id] },
          policy?.canDelete,
        ),
      },
      changePathStyle: (pathStyle) => ({ type: 'EdgePathStyleChanged', id, pathStyle }),
    },
  };
}
