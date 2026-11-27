import type { EditorState, ZlozNode } from './types';

/** Model dimensions for the current resize readout, before any view styling. */
export type ZlozResizeReadoutContext = Readonly<{
  node: ZlozNode;
  phase: 'resizing' | 'selected-group';
  /** Default formatting in graph units, rounded to two decimal places. */
  widthText: string;
  heightText: string;
}>;

export function resolveResizeReadout(
  state: EditorState,
  nodes: readonly ZlozNode[],
  showSelectedGroup: boolean,
): ZlozResizeReadoutContext | undefined {
  if (state.readOnly) return undefined;
  const { gesture } = state;
  const resizing = gesture.type === 'node-resize';
  const id = resizing
    ? gesture.ids[0]
    : gesture.type === 'idle' && showSelectedGroup && state.selectedNodes.length === 1
      ? state.selectedNodes[0]
      : undefined;
  const node = nodes.find((item) => item.id === id && (resizing || item.kind === 'group'));
  if (!node || state.collapsedGroups.includes(node.id)) return undefined;
  return {
    node,
    phase: resizing ? 'resizing' : 'selected-group',
    widthText: String(Number(node.size.width.toFixed(2))),
    heightText: String(Number(node.size.height.toFixed(2))),
  };
}
