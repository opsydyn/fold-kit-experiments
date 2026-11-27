import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { resolveResizeReadout, type ZlozResizeReadoutContext } from './resize-readout';
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
  surfaceId: string,
  descriptionId?: string,
) {
  if (
    editor.readOnly ||
    editor.collapsedGroups.includes(node.id) ||
    policy?.canSelectNode?.(node, editor.graph) != null ||
    policy?.canResizeNode?.(node, editor.graph) != null
  )
    return [];

  if (node.kind !== 'group') {
    return [
      h.lazy(
        widthButton,
        JSON.stringify([surfaceId, 'width', node.id]),
        node.id,
        node.label,
        descriptionId,
      ),
    ];
  }
  const button = (label: string) => resizeButton(h, node.id, label, descriptionId);
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

function resizeButton<M>(h: Html.H<M>, id: string, label: string, descriptionId?: string) {
  return h.button
    .class('zloz-ui-resize')
    .attr('type', 'button')
    .attr('data-flow-resize', id)
    .attr('aria-label', label)
    .attr('aria-describedby', descriptionId);
}

function widthButton<M>(
  h: Html.H<M>,
  _cacheKey: string,
  id: string,
  label: string,
  descriptionId: string | undefined,
) {
  return resizeButton(h, id, `Resize ${label}`, descriptionId)
    .key('resize:width')
    .class('zloz-ui-resize', 'zloz-ui-width-resize')
    .children('↔');
}

export type NativeResizeReadout<M> = (
  context: ZlozResizeReadoutContext,
  h: Html.H<M>,
) => View.Content<M> | null | undefined;

export function nodeResizeReadout<M>(
  h: Html.H<M>,
  editor: EditorState,
  visibleNodes: readonly ZlozNode[],
  render?: NativeResizeReadout<M>,
) {
  const context = resolveResizeReadout(editor, visibleNodes, true);
  if (!context) return null;
  const { node, widthText, heightText } = context;
  const content = render?.(context, h);
  if (content === null) return null;
  const text = `${node.label}: ${widthText} × ${heightText} graph units`;
  return h.div
    .key('resize-readout')
    .class('zloz-ui-resize-readout')
    .attr('data-flow-resize-readout', node.id)
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .attr('aria-label', `${node.label} dimensions in graph units`)
    .attr('title', text)
    .children(content ?? text);
}
