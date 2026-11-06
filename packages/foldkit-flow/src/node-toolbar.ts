import type { Html, HtmlBuilder } from 'foldkit/html';

import { flowContextAction, type FlowContextAction } from './context-menu';
import { FlowError } from './graph';
import type { EditorEvent, FlowNode, Point, Viewport } from './types';

export type FlowNodeToolbarPlacement = 'top' | 'right' | 'bottom' | 'left';

export type FlowNodeToolbarOptions = Readonly<{
  /** The default places the toolbar above the node, or below if the node is near the top. */
  placement?: FlowNodeToolbarPlacement;
  /** Gap between the node boundary and toolbar, in CSS pixels. Defaults to 8. */
  offset?: number;
}>;

export type FlowNodeToolbarContext = Readonly<{
  /** The selected node with its visible dimensions, including collapsed groups. */
  node: FlowNode;
  viewport: Viewport;
  /** Center of the chosen node side in canvas CSS pixels, before the offset. */
  anchor: Point;
  placement: FlowNodeToolbarPlacement;
  offset: number;
  actions: Readonly<{ duplicate: FlowContextAction; deleteNode: FlowContextAction }>;
}>;

export function nodeToolbarContext(
  node: FlowNode,
  viewport: Viewport,
  options: FlowNodeToolbarOptions,
  actions: FlowNodeToolbarContext['actions'],
): FlowNodeToolbarContext {
  const offset = options.offset ?? 8;
  if (!Number.isFinite(offset) || offset < 0)
    throw new FlowError('invalid-edit', 'Node toolbar offset must be finite and non-negative');
  const left = viewport.x + node.position.x * viewport.zoom;
  const top = viewport.y + node.position.y * viewport.zoom;
  const width = node.size.width * viewport.zoom;
  const height = node.size.height * viewport.zoom;
  const placement = options.placement ?? (top < 44 + offset ? 'bottom' : 'top');
  const anchors = {
    top: { x: left + width / 2, y: top },
    right: { x: left + width, y: top + height / 2 },
    bottom: { x: left + width / 2, y: top + height },
    left: { x: left, y: top + height / 2 },
  };
  return { node, viewport, anchor: anchors[placement], placement, offset, actions };
}

export function nodeToolbarView<M>(
  h: HtmlBuilder<M>,
  context: FlowNodeToolbarContext,
  onEvent: (event: EditorEvent) => M,
  content: Html | undefined,
): Html {
  const { node, anchor, placement, offset, actions } = context;
  const positions = {
    top: { x: anchor.x, y: anchor.y - offset, translate: '-50% -100%' },
    right: { x: anchor.x + offset, y: anchor.y, translate: '0 -50%' },
    bottom: { x: anchor.x, y: anchor.y + offset, translate: '-50% 0' },
    left: { x: anchor.x - offset, y: anchor.y, translate: '-100% -50%' },
  };
  const { x, y, translate } = positions[placement];
  return h.div(
    [
      h.Key('node-toolbar'),
      h.Role('group'),
      h.AriaLabel(`Actions for ${node.label}`),
      h.DataAttribute('flow-node-toolbar', node.id),
      h.DataAttribute('flow-no-drag', ''),
      h.Style({
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        translate,
        width: 'max-content',
        'z-index': '1',
      }),
    ],
    [
      content ??
        h.div(
          [
            h.Style({
              display: 'flex',
              gap: '4px',
              padding: '4px',
              'border-radius': '8px',
              border: '1px solid var(--flow-node-border, #cbd5e1)',
              background: 'var(--flow-node-background, #fff)',
              color: 'var(--flow-node-color, #172033)',
              'box-shadow': '0 2px 8px rgb(0 0 0 / 0.14)',
            }),
          ],
          [actions.duplicate, actions.deleteNode].map((action) =>
            flowContextAction(
              h,
              action,
              onEvent,
              [h.Style({ 'min-height': '36px', padding: '0 8px', cursor: 'pointer' })],
              [action.label],
            ),
          ),
        ),
    ],
  );
}
