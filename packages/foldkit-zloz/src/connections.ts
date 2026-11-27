import type { ZlozContextTrigger } from './context-menu';
import type { EditorPolicy, EditorState, ZlozEdge } from './types';

/** Model-derived state for one visible connection. */
export type ZlozConnectionEntry = Readonly<{
  edge: ZlozEdge;
  label: string;
  sourceLabel: string;
  targetLabel: string;
  selected: boolean;
  selectionDisabledReason?: string | undefined;
  contextAction?: ZlozContextTrigger;
  /** Present when the selected edge has a rendered action toolbar. */
  toolbarId?: string;
}>;

export type ZlozConnectionsContext = Readonly<{
  entries: readonly ZlozConnectionEntry[];
  compact: boolean;
  readOnly: boolean;
}>;

export function resolveConnectionList(
  state: EditorState,
  edges: readonly ZlozEdge[],
  options: Pick<EditorPolicy, 'canSelectEdge'> &
    Readonly<{
      id: string;
      compact: boolean;
      contextActions?: boolean;
      toolbarEdgeId: string | undefined;
    }>,
): ZlozConnectionsContext {
  const nodeLabels = new Map(state.graph.nodes.map((node) => [node.id, node.label]));
  const entries = edges.map((edge): ZlozConnectionEntry => {
    const selectionDisabledReason = options.canSelectEdge?.(edge, state.graph) ?? undefined;
    const sourceLabel = nodeLabels.get(edge.source.node) ?? 'Source';
    const targetLabel = nodeLabels.get(edge.target.node) ?? 'Target';
    const label =
      edge.label ??
      (options.compact
        ? `${sourceLabel} → ${targetLabel}`
        : `${edge.source.node}:${edge.source.port} → ${edge.target.node}:${edge.target.port}`);
    return {
      edge,
      label,
      sourceLabel,
      targetLabel,
      selected: state.selectedEdges.includes(edge.id),
      selectionDisabledReason,
      contextAction:
        options.contextActions && !state.readOnly && selectionDisabledReason === undefined
          ? {
              label: `More actions for ${label}`,
              expanded: state.context?.kind === 'edge' && state.context.id === edge.id,
              disabled: state.gesture.type !== 'idle',
              event: {
                type: 'ContextOpened',
                context: { kind: 'edge', id: edge.id, point: { x: 12, y: 12 } },
              },
            }
          : undefined,
      toolbarId:
        options.toolbarEdgeId === edge.id && selectionDisabledReason === undefined
          ? `${encodeURIComponent(options.id)}-edge-actions`
          : undefined,
    };
  });
  return { entries, compact: options.compact, readOnly: state.readOnly };
}

export const toolbarControl =
  ':is(button, select, input, textarea, a[href], [tabindex]):not(:disabled, input[type="hidden"], [tabindex^="-"], [hidden], [hidden] *, [inert], [inert] *)';
