import { minimapGeometry } from './geometry';
import { groupsInPaintOrder, presentVisibleGraph } from './group-presentation';
import type { EditorState, ZlozMinimapGeometry, ZlozNode } from './types';

export type ZlozMinimapContext = Readonly<{
  state: EditorState;
  nodes: readonly ZlozNode[];
  geometry: ZlozMinimapGeometry;
}>;

/** Collapsed-group presentation, in paint order, shared by default and custom minimaps. */
export function minimapContext(state: EditorState): ZlozMinimapContext | undefined {
  if (!state.surface) return undefined;
  const presentation = presentVisibleGraph(state);
  if (!presentation.nodes.length) return undefined;
  return {
    state,
    nodes: [
      ...groupsInPaintOrder(presentation.nodes),
      ...presentation.nodes.filter((node) => node.kind !== 'group'),
    ],
    geometry: minimapGeometry(presentation, state.surface, state.viewport),
  };
}
