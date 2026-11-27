import type { Html, HtmlBuilder } from 'foldkit/html';

import { zlozContextAction } from './context-menu';
import { nodeToolbarPosition, type ZlozNodeToolbarContext } from './node-toolbar-layout';
import type { EditorEvent } from './types';

export {
  nodeToolbarContext,
  type ZlozNodeToolbarContext,
  type ZlozNodeToolbarOptions,
  type ZlozNodeToolbarPlacement,
} from './node-toolbar-layout';

export function nodeToolbarView<M>(
  h: HtmlBuilder<M>,
  context: ZlozNodeToolbarContext,
  onEvent: (event: EditorEvent) => M,
  content: Html | undefined,
): Html {
  const { node, actions } = context;
  const { x, y, translate } = nodeToolbarPosition(context);
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
            zlozContextAction(
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
