import type { Size } from '@opsydyn/foldkit-zloz';
import type { ZlozEdgeLabelContext } from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';
/** Authored world-unit envelope, shared by the renderer and layout request. */
export const alchemyPreviewLabelSize = { width: 176, height: 36 } as const satisfies Size;
export function alchemyRelationBadge<M>(context: ZlozEdgeLabelContext, h: HtmlBuilder<M>) {
  return h.div(
    [
      h.DataAttribute('alchemy-relation-badge', context.edge.id),
      h.Title(context.edge.label ?? 'Relation'),
      h.Style({
        width: `${alchemyPreviewLabelSize.width}px`,
        height: `${alchemyPreviewLabelSize.height}px`,
        'box-sizing': 'border-box',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        gap: '6px',
        padding: '6px 8px',
        border: '1px solid var(--flow-node-border, #64748b)',
        'border-radius': '7px',
        background: 'var(--flow-node-background, #fff)',
        color: 'var(--flow-node-color, #172033)',
        'font-size': '12px',
        'line-height': '18px',
      }),
    ],
    [
      h.span(
        [
          h.Style({
            'min-width': '0',
            overflow: 'hidden',
            'text-overflow': 'ellipsis',
            'white-space': 'nowrap',
          }),
        ],
        [context.edge.label ?? 'Relation'],
      ),
      h.span(
        [
          h.Style({
            'font-size': '10px',
            'font-weight': '650',
            padding: '0 4px',
            'border-radius': '3px',
            background: 'var(--flow-group-background, #e2e8f0)',
          }),
        ],
        [context.edge.architecture?.family === 'ddd' ? 'DDD' : 'source'],
      ),
    ],
  );
}
