import type { ZlozNodeRenderContext } from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

/** App-owned layout for the native node-frame delivery attributes.
 * Fixed rules live beside the canvas stylesheet; geometry stays in Model. */
export function sharedNodeFrame<Message>(
  h: HtmlBuilder<Message>,
  { node, selectionPreview }: Pick<ZlozNodeRenderContext, 'node' | 'selectionPreview'>,
  attributes: Parameters<HtmlBuilder<Message>['div']>[0],
  children: Parameters<HtmlBuilder<Message>['div']>[1],
) {
  return h.div(
    [
      h.Key(node.id),
      h.Class('shared-node-frame'),
      h.Style({
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${node.size.width}px`,
      }),
      h.DataAttribute('flow-node', node.id),
      ...(selectionPreview ? [h.DataAttribute('flow-selection-preview', 'true')] : []),
      h.DataAttribute('flow-x', String(node.position.x)),
      h.DataAttribute('flow-y', String(node.position.y)),
    ],
    [h.div(attributes, children)],
  );
}
