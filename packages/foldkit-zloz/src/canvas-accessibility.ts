import type { ZlozWheelNavigation } from './navigation';
import type { EditorState } from './types';

/** Instructions for the current canvas interaction mode. */
export type ZlozCanvasHelpContext = Readonly<{
  defaultText: string;
  selectionMode: boolean;
  zoomAreaActive?: boolean;
  edgeToolbar: boolean;
  readOnly: boolean;
  visible: boolean;
  wheelNavigation: ZlozWheelNavigation;
  doubleClickZoom?: boolean;
  spaceToPan?: boolean;
  middleButtonPan?: boolean;
}>;

/** Current canvas notice or the summary used when no notice is active. */
export type ZlozCanvasStatusContext = Readonly<{
  defaultText: string;
  notice: string | null;
  nodeCount: number;
  connectionCount: number;
  visible: boolean;
}>;

type NavigationHelp = Readonly<{
  wheelNavigation?: ZlozWheelNavigation;
  doubleClickZoom?: boolean | number;
  spaceToPan?: boolean;
  middleButtonPan?: boolean;
}>;

export function canvasHelpContext(
  state: EditorState,
  options: NavigationHelp,
  edgeToolbar: boolean,
  visible: boolean,
): ZlozCanvasHelpContext {
  const zoomAreaActive = Boolean(state.zoomAreaMode) || state.gesture.type === 'zoom-area';
  const doubleClickZoom = Boolean(options.doubleClickZoom);
  const spaceToPan = options.spaceToPan === true;
  const middleButtonPan = options.middleButtonPan === true;
  const wheelNavigation = options.wheelNavigation ?? 'zoom';
  const wheelHelp =
    wheelNavigation === 'pan'
      ? 'Scroll to pan. Hold Ctrl or Command while scrolling to zoom. '
      : wheelNavigation === 'zoom'
        ? 'Scroll to zoom. '
        : '';
  const defaultText = [
    'Drag a node title to move it. ',
    zoomAreaActive
      ? 'Drag the background to zoom to an area. '
      : state.selectionMode
        ? 'Drag the background to select nodes. '
        : 'Drag the background to pan, or Shift-drag to select nodes. ',
    wheelHelp,
    ...(doubleClickZoom && !zoomAreaActive && !state.selectionMode
      ? ['Double-click the background to zoom in. ']
      : []),
    ...(spaceToPan ? ['Focus the canvas, then hold Space and drag the background to pan. '] : []),
    ...(middleButtonPan ? ['Middle-drag the background to pan. '] : []),
    state.connectionMode === 'loose'
      ? 'Tab to a title, then use arrow keys to move it. Drag from any port to any port, or activate the source then target with Enter or Space. Port kinds stay unchanged. Select an edge and drag an available endpoint handle to reconnect. Escape cancels.'
      : 'Tab to a title, then use arrow keys to move it. Drag from an output to an input, or activate the two ports in order with Enter or Space. Select an edge and drag an available endpoint handle to reconnect. Escape cancels.',
    ...(edgeToolbar
      ? [' In the Connections list, select an edge and press Up Arrow to reach its actions.']
      : []),
  ].join('');
  return {
    defaultText,
    selectionMode: state.selectionMode,
    zoomAreaActive,
    readOnly: state.readOnly,
    edgeToolbar,
    wheelNavigation,
    doubleClickZoom,
    spaceToPan,
    middleButtonPan,
    visible,
  };
}

export function canvasStatusContext(
  notice: string | null,
  nodeCount: number,
  connectionCount: number,
  visible: boolean,
): ZlozCanvasStatusContext {
  return {
    defaultText: notice ?? `${nodeCount} nodes, ${connectionCount} connections`,
    notice,
    nodeCount,
    connectionCount,
    visible,
  };
}
