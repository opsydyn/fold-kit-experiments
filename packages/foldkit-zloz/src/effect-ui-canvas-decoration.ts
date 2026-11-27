import type { View } from '@effect/ui';
import { Html } from '@effect/ui/html';

import {
  alignmentGuideContexts,
  backgroundPaint,
  type ZlozAlignmentGuideContext,
  type ZlozBackgroundPreset,
  type ZlozBackgroundRenderContext,
} from './canvas-decoration';
import type { EditorState } from './types';

export type NativeBackground<M> =
  | ZlozBackgroundPreset
  | Readonly<{ type: 'none' }>
  | Readonly<{
      type: 'custom';
      render: (context: ZlozBackgroundRenderContext, h: Html.H<M>) => View.Content<M>;
    }>;

export type NativeAlignmentGuide<M> = (
  context: ZlozAlignmentGuideContext,
  h: Html.H<M>,
) => View.Content<M> | null | undefined;

export function nativeBackground<M>(
  h: Html.H<M>,
  state: EditorState,
  id: string,
  background: NativeBackground<M>,
) {
  if (background.type === 'none') return null;
  return h.div
    .key('background')
    .attr('data-flow-background', background.type)
    .attr('aria-hidden', 'true')
    .style({
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      ...(background.type === 'custom' ? undefined : backgroundPaint(state, background)),
    })
    .children(
      background.type === 'custom'
        ? background.render(
            {
              id,
              viewport: state.viewport,
              surface: state.surface,
              spacing: state.gridSpacing,
            },
            h,
          )
        : null,
    );
}

export function nativeAlignmentGuides<M>(
  h: Html.H<M>,
  state: EditorState,
  render?: NativeAlignmentGuide<M>,
) {
  const svg = (tag: 'g' | 'line') => new Html.Element<M>(tag);
  return alignmentGuideContexts(state).flatMap((context) => {
    const {
      guide: { axis },
      start,
      end,
    } = context;
    const artwork = render?.(context, h);
    if (artwork === null) return [];
    return [
      svg('g')
        .key(`alignment:${axis}`)
        .attr('data-flow-alignment-guide', axis)
        .style({ pointerEvents: 'none' })
        .children(
          artwork ??
            svg('line')
              .attr('x1', String(start.x))
              .attr('y1', String(start.y))
              .attr('x2', String(end.x))
              .attr('y2', String(end.y))
              .attr('stroke', 'var(--flow-alignment-guide, #7c3aed)')
              .attr('stroke-width', '2')
              .attr('stroke-dasharray', '5 3')
              .attr('vector-effect', 'non-scaling-stroke'),
        ),
    ];
  });
}
