import type {
  ZlozContextAction,
  ZlozContextMenuContext,
  ZlozGroupContextActions,
} from './context-menu';
import { resolveDeletion } from './deletion';
import type { ZlozDiagnostics } from './diagnostics';
import type { ZlozNodeToolbarContext } from './node-toolbar-layout';
import type { DeletionTargets, EditorPolicy, EditorState, ZlozGraph } from './types';

export function deletionReason(
  graph: ZlozGraph,
  targets: DeletionTargets,
  canDelete: EditorPolicy['canDelete'],
): string | undefined {
  if (!canDelete) return undefined;
  const decision = resolveDeletion(graph, targets, canDelete);
  return decision.type === 'blocked' ? decision.reason : undefined;
}

export function selectedNodeActions(
  state: EditorState,
  canDelete: EditorPolicy['canDelete'],
): ZlozNodeToolbarContext['actions'] {
  return {
    duplicate: { label: 'Duplicate node', event: { type: 'DuplicatePressed' } },
    deleteNode: {
      label: 'Delete node',
      event: { type: 'DeletePressed' },
      disabledReason: deletionReason(
        state.graph,
        { nodeIds: state.selectedNodes, edgeIds: state.selectedEdges },
        canDelete,
      ),
    },
  };
}

export function resolveContextMenu(
  state: EditorState,
  diagnostics: Pick<ZlozDiagnostics, 'measurements'>,
  canDelete: EditorPolicy['canDelete'],
  canResizeNode: EditorPolicy['canResizeNode'],
): ZlozContextMenuContext | undefined {
  const context = state.context;
  if (!context || state.readOnly) return undefined;
  const close: ZlozContextAction = { label: 'Close', event: { type: 'ContextDismissed' } };
  const { point, id, kind } = context;
  if (kind === 'edge') {
    const edge = state.graph.edges.find((edge) => edge.id === id);
    if (!edge) return undefined;
    return {
      kind,
      edge,
      point,
      close,
      deleteEdge: {
        label: 'Delete edge',
        event: { type: 'EdgeDeleted', id },
        disabledReason: deletionReason(state.graph, { nodeIds: [], edgeIds: [id] }, canDelete),
      },
      rename: { label: 'Rename', event: { type: 'EdgeLabelEditingStarted', id } },
    };
  }

  const node = state.graph.nodes.find((node) => node.id === id);
  if (!node) return undefined;
  const collapsed = state.collapsedGroups.includes(id);
  const resizeDisabledReason = canResizeNode?.(node, state.graph) ?? undefined;
  const group: ZlozGroupContextActions | undefined =
    node.kind === 'group'
      ? {
          node,
          collapsed,
          fit: {
            label: 'Fit group to contents',
            event: { type: 'GroupFitClicked', id },
            disabledReason: resizeDisabledReason,
          },
          lockProportions: {
            label: 'Lock proportions',
            event: { type: 'GroupAspectRatioToggled', id },
            pressed: node.keepAspectRatio ?? false,
          },
          showMeasurements: diagnostics.measurements,
          dimensionsDisabled:
            collapsed || state.gesture.type !== 'idle' || resizeDisabledReason !== undefined,
          resizeDisabledReason,
          dimensionStep: state.snapToGrid ? state.gridSpacing : 1,
          changeDimension: (dimension, value) => ({
            type: 'GroupDimensionChanged',
            id,
            dimension,
            value,
          }),
        }
      : undefined;
  return {
    kind,
    node,
    point,
    close,
    group,
    ...selectedNodeActions(state, canDelete),
  };
}

export function contextPanelPlacement(context: ZlozContextMenuContext) {
  const group = context.kind === 'node' ? context.group : undefined;
  const width = group ? 224 : 172;
  const height = group ? (group.showMeasurements ? 336 : 228) : 130;
  const top = `clamp(4px, ${context.point.y}px, max(4px, calc(100% - ${height}px)))`;
  return {
    left: `clamp(4px, ${context.point.x}px, max(4px, calc(100% - ${width + 4}px)))`,
    top,
    width: `min(${width}px, calc(100% - 8px))`,
    maxHeight: `calc(100% - ${top} - 4px)`,
  };
}
