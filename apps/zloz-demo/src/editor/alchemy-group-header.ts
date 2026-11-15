import type { LayoutGroupHeader, LayoutGroupHeaderSpec, ZlozNode } from '@opsydyn/foldkit-zloz';
import {
  zlozC4Group,
  zlozDddGroup,
  type ZlozNodeRenderContext,
  type ZlozGroupHeaderOptions,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

/** Shared by the native group renderer and explicit layout request. No source metadata is changed. */
const declaredSize = { width: 640, height: 112 } as const;
export function alchemyGroupHeaderSpec(node: ZlozNode): LayoutGroupHeaderSpec | undefined {
  return node.kind === 'group' &&
    (node.architecture?.family === 'ddd' || node.architecture?.family === 'c4')
    ? {
        id: node.id,
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
        gap: 24,
      }
    : undefined;
}
export function alchemyGroupHeader(node: ZlozNode): LayoutGroupHeader | undefined {
  const spec = alchemyGroupHeaderSpec(node);
  return spec ? { ...spec, size: declaredSize } : undefined;
}
export function alchemyGroupShell<M>(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<M>,
  mode: 'default' | 'expanded' | 'measured',
  detail: 'summary' | 'provenance' = 'summary',
) {
  const header = mode !== 'default' ? alchemyGroupHeaderSpec(context.node) : undefined;
  if (!header)
    return (
      zlozDddGroup(context, h, { renderControls: () => [] }) ??
      zlozC4Group(context, h, { renderControls: () => [] })
    );
  const options = {
    groupHeader: (mode === 'measured'
      ? { ...header, sizing: 'intrinsic' }
      : { ...header, size: declaredSize }) satisfies ZlozGroupHeaderOptions,
    renderControls: () => [],
    renderBody: ({ node }: { node: ZlozNode }, builder: HtmlBuilder<M>) =>
      builder.div(
        [
          builder.DataAttribute('alchemy-group-heading', node.id),
          builder.Style({
            'box-sizing': 'border-box',
            width: mode === 'measured' ? 'max-content' : `${declaredSize.width}px`,
            height: mode === 'measured' ? 'auto' : `${declaredSize.height}px`,
            padding: '12px 16px',
            border: '1px solid var(--flow-node-border, #64748b)',
            'border-radius': '8px',
            background: 'var(--flow-node-background, #fff)',
            color: 'var(--flow-node-color, #172033)',
            'text-align': 'left',
            overflow: 'hidden',
            'white-space': mode === 'measured' ? 'nowrap' : 'normal',
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
            [
              mode === 'measured' && detail === 'summary'
                ? 'Read-only review'
                : 'Source identity retained · Read-only architecture review',
            ],
          ),
          ...(mode === 'measured' && detail === 'provenance'
            ? [
                builder.div(
                  [builder.Style({ 'font-size': '12px', 'line-height': '22px' })],
                  ['Source roles, relationships and findings stay unchanged.'],
                ),
              ]
            : []),
        ],
      ),
  };
  return zlozDddGroup(context, h, options) ?? zlozC4Group(context, h, options);
}
