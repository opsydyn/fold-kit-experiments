import type { LayoutGroupHeader, ZlozNode } from '@opsydyn/foldkit-zloz';
import {
  zlozC4Group,
  zlozDddGroup,
  type ZlozNodeRenderContext,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

/** Shared by the native group renderer and explicit layout request. No source metadata is changed. */
export function alchemyGroupHeader(node: ZlozNode): LayoutGroupHeader | undefined {
  return node.kind === 'group' &&
    (node.architecture?.family === 'ddd' || node.architecture?.family === 'c4')
    ? {
        id: node.id,
        size: { width: 640, height: 112 },
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
        gap: 24,
      }
    : undefined;
}
export function alchemyGroupShell<M>(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<M>,
  expanded: boolean,
) {
  const header = expanded ? alchemyGroupHeader(context.node) : undefined;
  if (!header)
    return (
      zlozDddGroup(context, h, { renderControls: () => [] }) ??
      zlozC4Group(context, h, { renderControls: () => [] })
    );
  const options = {
    groupHeader: header,
    renderControls: () => [],
    renderBody: ({ node }: { node: ZlozNode }, builder: HtmlBuilder<M>) =>
      builder.div(
        [
          builder.DataAttribute('alchemy-group-heading', node.id),
          builder.Style({
            'box-sizing': 'border-box',
            width: `${header.size.width}px`,
            height: `${header.size.height}px`,
            padding: '12px 16px',
            border: '1px solid var(--flow-node-border, #64748b)',
            'border-radius': '8px',
            background: 'var(--flow-node-background, #fff)',
            color: 'var(--flow-node-color, #172033)',
            'text-align': 'left',
            overflow: 'hidden',
          }),
        ],
        [
          builder.div(
            [
              builder.Style({
                'font-size': '11px',
                'letter-spacing': '0.08em',
                'text-transform': 'uppercase',
              }),
            ],
            [
              node.architecture?.family === 'c4'
                ? 'C4 architecture boundary'
                : 'DDD bounded context',
            ],
          ),
          builder.div(
            [builder.Style({ 'font-size': '22px', 'font-weight': '700', 'line-height': '30px' })],
            [node.label],
          ),
          builder.div(
            [builder.Style({ 'font-size': '13px', 'line-height': '22px' })],
            ['Source identity retained · Read-only architecture review'],
          ),
        ],
      ),
  };
  return zlozDddGroup(context, h, options) ?? zlozC4Group(context, h, options);
}
