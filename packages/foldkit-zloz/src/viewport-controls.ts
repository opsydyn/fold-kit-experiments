import { presentEditorGroups } from './group-presentation';
import type { EditorEvent, EditorState } from './types';

/** A Model-derived action; consumers supply the content and appearance. */
export type ZlozViewportControl = Readonly<{
  label: string;
  event: EditorEvent;
  disabled: boolean;
  pressed?: boolean;
}>;
export type ZlozViewportActions = Readonly<{
  zoomIn: ZlozViewportControl;
  zoomOut: ZlozViewportControl;
  fitView: ZlozViewportControl;
  fitSelection: ZlozViewportControl;
  zoomArea: ZlozViewportControl;
  previousView: ZlozViewportControl;
  selectionMode: ZlozViewportControl;
}>;

/** Camera controls remain available for read-only inspection. */
export function viewportControlActions(state: EditorState): ZlozViewportActions {
  const point = { x: (state.surface?.width ?? 0) / 2, y: (state.surface?.height ?? 0) / 2 };
  const unavailable = !state.surface || state.gesture.type !== 'idle';
  const nodes = state.visibility?.hiddenNodeIds?.length
    ? presentEditorGroups(state).nodes
    : state.graph.nodes;
  return {
    zoomIn: {
      label: 'Zoom in',
      event: { type: 'Zoomed', point, factor: 1.25 },
      disabled: unavailable || state.viewport.zoom >= state.zoomLimits.maxZoom,
    },
    zoomOut: {
      label: 'Zoom out',
      event: { type: 'Zoomed', point, factor: 1 / 1.25 },
      disabled: unavailable || state.viewport.zoom <= state.zoomLimits.minZoom,
    },
    fitView: {
      label: 'Fit view',
      event: { type: 'FitViewClicked' },
      disabled: unavailable || nodes.length === 0,
    },
    fitSelection: {
      label: 'Fit selection',
      event: { type: 'FitSelectionClicked' },
      disabled: unavailable || (!state.selectedNodes.length && !state.selectedEdges.length),
    },
    zoomArea: {
      label: 'Zoom to area',
      event: { type: 'ZoomAreaModeToggled' },
      disabled: unavailable,
      pressed: Boolean(state.zoomAreaMode) || state.gesture.type === 'zoom-area',
    },
    previousView: {
      label: 'Back to previous view',
      event: { type: 'PreviousViewClicked' },
      disabled: unavailable || !state.previousViewport,
    },
    selectionMode: {
      label: 'Box select',
      event: { type: 'SelectionModeToggled' },
      disabled: unavailable,
      pressed: state.selectionMode,
    },
  };
}
