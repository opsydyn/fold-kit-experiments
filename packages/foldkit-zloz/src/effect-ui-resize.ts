import type { Html } from '@effect/ui/html';

import type { EditorPolicy, EditorState, ResizeHandle, ZlozNode } from './types';

const groupHandles = {
  'top-left': { left: '-6px', top: '-6px', cursor: 'nwse-resize', symbol: '⤡' },
  top: { left: '50%', top: '-22px', cursor: 'ns-resize', symbol: '↕' },
  'top-right': { left: 'calc(100% + 6px)', top: '-6px', cursor: 'nesw-resize', symbol: '⤢' },
  right: { left: 'calc(100% + 22px)', top: '50%', cursor: 'ew-resize', symbol: '↔' },
  'bottom-right': {
    left: 'calc(100% + 6px)',
    top: 'calc(100% + 6px)',
    cursor: 'nwse-resize',
    symbol: '⤡',
  },
  bottom: { left: '50%', top: 'calc(100% + 22px)', cursor: 'ns-resize', symbol: '↕' },
  'bottom-left': { left: '-6px', top: 'calc(100% + 6px)', cursor: 'nesw-resize', symbol: '⤢' },
  left: { left: '-22px', top: '50%', cursor: 'ew-resize', symbol: '↔' },
} satisfies Record<ResizeHandle, { left: string; top: string; cursor: string; symbol: string }>;

export function nodeResizeControls<M>(
  h: Html.H<M>,
  node: ZlozNode,
  editor: EditorState,
  policy: EditorPolicy | undefined,
  descriptionId?: string,
) {
  if (
    editor.readOnly ||
    editor.collapsedGroups.includes(node.id) ||
    policy?.canSelectNode?.(node, editor.graph) != null ||
    policy?.canResizeNode?.(node, editor.graph) != null
  )
    return [];

  const button = (label: string) =>
    h.button
      .class('zloz-ui-resize')
      .attr('type', 'button')
      .attr('data-flow-resize', node.id)
      .attr('aria-label', label)
      .attr('aria-describedby', descriptionId);

  if (node.kind !== 'group') {
    return [
      button(`Resize ${node.label}`)
        .key('resize:width')
        .style({ left: '100%', top: '100%', cursor: 'ew-resize' })
        .children('↔'),
    ];
  }
  if (!editor.selectedNodes.includes(node.id)) return [];

  return Object.entries(groupHandles).map(([handle, { symbol, ...position }]) =>
    button(`Resize ${node.label} from ${handle.replaceAll('-', ' ')}`)
      .key(`resize:${handle}`)
      .attr('data-flow-group-resize', '')
      .attr('data-flow-resize-handle', handle)
      .style(position)
      .children(symbol),
  );
}

export function nodeResizeReadout<M>(
  h: Html.H<M>,
  editor: EditorState,
  visibleNodes: readonly ZlozNode[],
) {
  if (editor.readOnly) return null;
  const { gesture } = editor;
  const resizing = gesture.type === 'node-resize';
  const id = resizing
    ? gesture.ids[0]
    : gesture.type === 'idle' && editor.selectedNodes.length === 1
      ? editor.selectedNodes[0]
      : undefined;
  const node = visibleNodes.find((item) => item.id === id && (resizing || item.kind === 'group'));
  if (!node || editor.collapsedGroups.includes(node.id)) return null;
  const { width, height } = node.size;
  const dimensions = `${Number(width.toFixed(2))} × ${Number(height.toFixed(2))}`;
  return h.div
    .key('resize-readout')
    .class('zloz-ui-resize-readout')
    .attr('data-flow-resize-readout', node.id)
    .attr('role', 'status')
    .attr('aria-label', `${node.label} dimensions in graph units`)
    .children(`${node.label}: ${dimensions} graph units`);
}
